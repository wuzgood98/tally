import { and, desc, ilike, inArray, or, sql } from "drizzle-orm";
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
import { DOCUMENT_PREFIXES, parseDocumentQuery } from "@/lib/document-query";
import type { DocumentPrefix, DocumentQuery } from "@/lib/document-query";
import { canBrowseBackOffice, visibleBranchIds } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
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

/** What this person may open: which branches' documents, and which kinds. */
export interface DocumentAccess {
  /** Null for every branch. */
  readonly branchIds: readonly string[] | null;
  readonly prefixes: readonly DocumentPrefix[];
}

export const EVERY_DOCUMENT: DocumentAccess = {
  branchIds: null,
  prefixes: DOCUMENT_PREFIXES,
};

/**
 * Everything for back-office staff, who can open any document's page; a
 * cashier only finds their own store's sales and returns.
 */
export const documentAccessFor = (
  actor: Actor,
  allBranchIds: readonly string[]
): DocumentAccess =>
  canBrowseBackOffice(actor)
    ? EVERY_DOCUMENT
    : {
        branchIds: visibleBranchIds(actor, allBranchIds),
        prefixes: ["SAL", "RET"],
      };

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

type Finder = (
  db: Db,
  query: DocumentQuery,
  branchIds: readonly string[] | null
) => Promise<Found[]>;

/** Only the branches this person may see; no condition for every branch. */
const atBranches = (
  column: AnyColumn,
  branchIds: readonly string[] | null
): SQL | undefined =>
  branchIds === null ? undefined : inArray(column, [...branchIds]);

const findPurchaseOrders: Finder = async (db, query, branchIds) => {
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
    .where(and(match.where, atBranches(purchaseOrder.branchId, branchIds)))
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

const findReceipts: Finder = async (db, query, branchIds) => {
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
    .where(and(match.where, atBranches(goodsReceipt.branchId, branchIds)))
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

const findTransfers: Finder = async (db, query, branchIds) => {
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
    .where(
      and(
        match.where,
        branchIds === null
          ? undefined
          : or(
              atBranches(stockTransfer.fromBranchId, branchIds),
              atBranches(stockTransfer.toBranchId, branchIds)
            )
      )
    )
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

const findRequests: Finder = async (db, query, branchIds) => {
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
    .where(and(match.where, atBranches(stockRequest.branchId, branchIds)))
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

const findSales: Finder = async (db, query, branchIds) => {
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
    .where(and(match.where, atBranches(sale.branchId, branchIds)))
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

const findReturns: Finder = async (db, query, branchIds) => {
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
    .where(and(match.where, atBranches(saleReturn.branchId, branchIds)))
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
 * Documents for the command palette, by number, limited to what `access`
 * allows: the same documents the person could open by link. The branch is
 * shown on each result.
 */
export const searchPaletteDocuments = async (
  db: Db,
  text: string,
  access: DocumentAccess = EVERY_DOCUMENT
): Promise<DocumentResults> => {
  const query = parseDocumentQuery(text);

  if (query === null) {
    return { documentLike: false, documents: [] };
  }

  const prefixes = access.prefixes.filter(
    (prefix) => query.prefix === null || prefix === query.prefix
  );

  const [found, branches] = await Promise.all([
    Promise.all(
      prefixes.map(
        async (prefix) => await FINDERS[prefix](db, query, access.branchIds)
      )
    ),
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
