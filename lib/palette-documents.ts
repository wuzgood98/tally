import { desc, ilike, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

import type { Db } from "@/lib/db/client";
import {
  branch,
  goodsReceipt,
  purchaseOrder,
  sale,
  saleReturn,
  stockRequest,
  stockTransfer,
} from "@/lib/db/schema";
import { parseDocumentQuery } from "@/lib/document-query";
import type { DocumentPrefix, DocumentQuery } from "@/lib/document-query";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/lib/stock/purchase-order-status";
import { STOCK_REQUEST_STATUS_LABELS } from "@/lib/stock/request-status";
import { TRANSFER_STATUS_LABELS } from "@/lib/stock/transfer-status";

export interface PaletteDocument {
  /** The document number, which is unique: also the palette's key. */
  readonly number: string;
  readonly kind: string;
  readonly href: string;
  /** Branch (or route), and status where the document has one. */
  readonly detail: string;
  /** Every part of the number was typed: Enter opens it. */
  readonly exact: boolean;
}

export interface DocumentResults {
  readonly documents: readonly PaletteDocument[];
  /** Typed like a document number: show documents before products. */
  readonly documentLike: boolean;
}

export const PALETTE_DOCUMENT_LIMIT = 5;
const LIKE_SPECIALS = /[\\%_]/gu;

const escapeLike = (text: string): string =>
  text.replaceAll(LIKE_SPECIALS, (match) => `\\${match}`);

interface Match {
  readonly where: SQL | undefined;
  readonly sameSerial: SQL<boolean>;
}

/** The parts typed, as a pattern over PREFIX-BRANCH-SERIAL. */
const matchNumber = (
  number: AnyColumn,
  prefix: DocumentPrefix,
  query: DocumentQuery
): Match => {
  const branchPart =
    query.branch === null ? "%" : `${escapeLike(query.branch)}%`;

  return {
    sameSerial: sql<boolean>`split_part(${number}, '-', 3)::bigint = ${Number(query.serial)}`,
    where: ilike(number, `${prefix}-${branchPart}-%${query.serial}%`),
  };
};

interface Found {
  readonly number: string;
  readonly kind: string;
  readonly href: string;
  readonly branchIds: readonly string[];
  readonly status: string | null;
  readonly sameSerial: boolean;
  readonly createdAt: Date;
}

type Finder = (db: Db, query: DocumentQuery) => Promise<Found[]>;

const findPurchaseOrders: Finder = async (db, query) => {
  const match = matchNumber(purchaseOrder.number, "PO", query);

  const rows = await db
    .select({
      branchId: purchaseOrder.branchId,
      createdAt: purchaseOrder.createdAt,
      id: purchaseOrder.id,
      number: purchaseOrder.number,
      sameSerial: match.sameSerial,
      status: purchaseOrder.status,
    })
    .from(purchaseOrder)
    .where(match.where)
    .orderBy(desc(match.sameSerial), desc(purchaseOrder.createdAt))
    .limit(PALETTE_DOCUMENT_LIMIT);

  return rows.map((row) => ({
    branchIds: [row.branchId],
    createdAt: row.createdAt,
    href: `/purchase-orders/${row.id}`,
    kind: "Purchase order",
    number: row.number,
    sameSerial: row.sameSerial,
    status: PURCHASE_ORDER_STATUS_LABELS[row.status],
  }));
};

const findReceipts: Finder = async (db, query) => {
  const match = matchNumber(goodsReceipt.number, "GRN", query);

  const rows = await db
    .select({
      branchId: goodsReceipt.branchId,
      createdAt: goodsReceipt.createdAt,
      id: goodsReceipt.id,
      number: goodsReceipt.number,
      sameSerial: match.sameSerial,
    })
    .from(goodsReceipt)
    .where(match.where)
    .orderBy(desc(match.sameSerial), desc(goodsReceipt.createdAt))
    .limit(PALETTE_DOCUMENT_LIMIT);

  return rows.map((row) => ({
    branchIds: [row.branchId],
    createdAt: row.createdAt,
    href: `/receipts/${row.id}`,
    kind: "Goods received",
    number: row.number,
    sameSerial: row.sameSerial,
    status: null,
  }));
};

const findTransfers: Finder = async (db, query) => {
  const match = matchNumber(stockTransfer.number, "TRF", query);

  const rows = await db
    .select({
      createdAt: stockTransfer.createdAt,
      fromBranchId: stockTransfer.fromBranchId,
      id: stockTransfer.id,
      number: stockTransfer.number,
      sameSerial: match.sameSerial,
      status: stockTransfer.status,
      toBranchId: stockTransfer.toBranchId,
    })
    .from(stockTransfer)
    .where(match.where)
    .orderBy(desc(match.sameSerial), desc(stockTransfer.createdAt))
    .limit(PALETTE_DOCUMENT_LIMIT);

  return rows.map((row) => ({
    branchIds: [row.fromBranchId, row.toBranchId],
    createdAt: row.createdAt,
    href: `/transfers/${row.id}`,
    kind: "Transfer",
    number: row.number,
    sameSerial: row.sameSerial,
    status: TRANSFER_STATUS_LABELS[row.status],
  }));
};

const findRequests: Finder = async (db, query) => {
  const match = matchNumber(stockRequest.number, "REQ", query);

  const rows = await db
    .select({
      branchId: stockRequest.branchId,
      createdAt: stockRequest.createdAt,
      id: stockRequest.id,
      number: stockRequest.number,
      sameSerial: match.sameSerial,
      status: stockRequest.status,
    })
    .from(stockRequest)
    .where(match.where)
    .orderBy(desc(match.sameSerial), desc(stockRequest.createdAt))
    .limit(PALETTE_DOCUMENT_LIMIT);

  return rows.map((row) => ({
    branchIds: [row.branchId],
    createdAt: row.createdAt,
    href: `/requests/${row.id}`,
    kind: "Stock request",
    number: row.number,
    sameSerial: row.sameSerial,
    status: STOCK_REQUEST_STATUS_LABELS[row.status],
  }));
};

const findSales: Finder = async (db, query) => {
  const match = matchNumber(sale.number, "SAL", query);

  const rows = await db
    .select({
      branchId: sale.branchId,
      createdAt: sale.createdAt,
      id: sale.id,
      number: sale.number,
      sameSerial: match.sameSerial,
    })
    .from(sale)
    .where(match.where)
    .orderBy(desc(match.sameSerial), desc(sale.createdAt))
    .limit(PALETTE_DOCUMENT_LIMIT);

  return rows.map((row) => ({
    branchIds: [row.branchId],
    createdAt: row.createdAt,
    href: `/sales/${row.id}`,
    kind: "Sale",
    number: row.number,
    sameSerial: row.sameSerial,
    status: null,
  }));
};

const findReturns: Finder = async (db, query) => {
  const match = matchNumber(saleReturn.number, "RET", query);

  const rows = await db
    .select({
      branchId: saleReturn.branchId,
      createdAt: saleReturn.createdAt,
      number: saleReturn.number,
      saleId: saleReturn.saleId,
      sameSerial: match.sameSerial,
    })
    .from(saleReturn)
    .where(match.where)
    .orderBy(desc(match.sameSerial), desc(saleReturn.createdAt))
    .limit(PALETTE_DOCUMENT_LIMIT);

  // A return is shown on its sale's page.
  return rows.map((row) => ({
    branchIds: [row.branchId],
    createdAt: row.createdAt,
    href: `/sales/${row.saleId}`,
    kind: "Customer return",
    number: row.number,
    sameSerial: row.sameSerial,
    status: null,
  }));
};

const FINDERS: Record<DocumentPrefix, Finder> = {
  GRN: findReceipts,
  PO: findPurchaseOrders,
  REQ: findRequests,
  RET: findReturns,
  SAL: findSales,
  TRF: findTransfers,
};

const byBestMatch = (a: Found, b: Found): number =>
  Number(b.sameSerial) - Number(a.sameSerial) ||
  b.createdAt.getTime() - a.createdAt.getTime();

/**
 * Documents for the command palette, by number. Every signed-in person can
 * open any document's page, so this searches all branches; the branch is
 * shown on each result instead.
 */
export const searchPaletteDocuments = async (
  db: Db,
  text: string
): Promise<DocumentResults> => {
  const query = parseDocumentQuery(text);

  if (query === null) {
    return { documentLike: false, documents: [] };
  }

  const finders =
    query.prefix === null ? Object.values(FINDERS) : [FINDERS[query.prefix]];

  const [found, branches] = await Promise.all([
    Promise.all(finders.map(async (find) => await find(db, query))),
    db.select({ id: branch.id, name: branch.name }).from(branch),
  ]);

  const names = new Map(branches.map((item) => [item.id, item.name]));
  const nameOf = (id: string): string => names.get(id) ?? id;
  const whole = query.prefix !== null && query.branch !== null;

  const documents = found
    .flat()
    .toSorted(byBestMatch)
    .slice(0, PALETTE_DOCUMENT_LIMIT)
    .map((item) => ({
      detail: [item.branchIds.map(nameOf).join(" → "), item.status]
        .filter((part) => part !== null)
        .join(" · "),
      exact:
        whole &&
        item.sameSerial &&
        item.number
          .toUpperCase()
          .startsWith(`${query.prefix}-${query.branch}-`),
      href: item.href,
      kind: item.kind,
      number: item.number,
    }));

  return { documentLike: query.documentLike, documents };
};
