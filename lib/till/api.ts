/**
 * What the till endpoints (`app/api/till/*`) read and write, taking the
 * database and the signed-in person so tests can pass an in-memory one.
 *
 * Reads are limited to the stores this person may sell at. Writes go through
 * `recordSale`, which checks permissions again and moves stock through the
 * ledger; the till's own idea of the balance is only ever a display.
 */

import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { Db } from "@/lib/db/client";
import { branch, product, sale, saleLine, stockLevel } from "@/lib/db/schema";
import { canSeeBranch, sellableBranchIds } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import { recordSale } from "@/lib/stock/sales";
import { HISTORY_WINDOW_MAX } from "@/lib/till/history-contract";
import type {
  HistoryQuery,
  HistorySale,
  HistorySortField,
} from "@/lib/till/history-contract";
import { stockLevelKey } from "@/lib/till/schema";
import type {
  TillProduct,
  TillSale,
  TillSaleBody,
  TillSaleReply,
  TillStockLevel,
} from "@/lib/till/schema";

/** How many of today's sales the till lists. */
export const TILL_SALES_LIMIT = 100;

/** The stores whose tills this person may use; empty for storekeepers. */
export const tillStoreIds = async (db: Db, actor: Actor): Promise<string[]> => {
  const stores = await db
    .select({ id: branch.id })
    .from(branch)
    .where(eq(branch.kind, "store"))
    .orderBy(asc(branch.id));

  return sellableBranchIds(
    actor,
    stores.map((store) => store.id)
  );
};

/** Every product the till can sell. Discontinued lines can't be scanned in, as on the other forms. */
export const getTillCatalogue = async (db: Db): Promise<TillProduct[]> =>
  await db
    .select({
      barcode: product.barcode,
      id: product.id,
      name: product.name,
      sellPrice: product.sellPrice,
      sku: product.sku,
      unit: product.unit,
    })
    .from(product)
    .where(eq(product.active, true))
    .orderBy(asc(product.name), asc(product.id));

const levelRows = async (
  db: Db,
  branchIds: readonly string[],
  productIds?: readonly number[]
): Promise<TillStockLevel[]> => {
  if (branchIds.length === 0 || productIds?.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      branchId: stockLevel.branchId,
      onHand: stockLevel.onHand,
      productId: stockLevel.productId,
    })
    .from(stockLevel)
    .where(
      and(
        inArray(stockLevel.branchId, [...branchIds]),
        productIds === undefined
          ? undefined
          : inArray(stockLevel.productId, [...productIds])
      )
    );

  return rows.map((row) => ({
    ...row,
    key: stockLevelKey(row.branchId, row.productId),
  }));
};

/** Balances at the stores this person may sell at. */
export const getTillStockLevels = async (
  db: Db,
  actor: Actor
): Promise<TillStockLevel[]> =>
  await levelRows(db, await tillStoreIds(db, actor));

/** Ghana keeps GMT all year, so "today" starts at UTC midnight. */
const startOfToday = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const saleColumns = {
  branchId: sale.branchId,
  clientRef: sale.clientRef,
  createdAt: sale.createdAt,
  expectedTotal: sale.expectedTotal,
  id: sale.id,
  number: sale.number,
  paymentMethod: sale.paymentMethod,
  total: sale.total,
  units: sql<number>`coalesce(sum(${saleLine.quantity}), 0)::int`,
};

type SaleRow = Omit<TillSale, "createdAt"> & { readonly createdAt: Date };

const toTillSale = (row: SaleRow): TillSale => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Today's sales this person rang up at their tills, newest first. A join
 * (not a correlated subquery) counts the units: see "Drizzle and correlated
 * subqueries" in docs/CONTEXT.md.
 */
export const getTillSales = async (
  db: Db,
  actor: Actor,
  now: Date = new Date()
): Promise<TillSale[]> => {
  const storeIds = await tillStoreIds(db, actor);

  if (storeIds.length === 0) {
    return [];
  }

  const rows = await db
    .select(saleColumns)
    .from(sale)
    .leftJoin(saleLine, eq(saleLine.saleId, sale.id))
    .where(
      and(
        inArray(sale.branchId, storeIds),
        eq(sale.cashierId, actor.id),
        gte(sale.createdAt, startOfToday(now))
      )
    )
    .groupBy(sale.id)
    .orderBy(desc(sale.createdAt), desc(sale.id))
    .limit(TILL_SALES_LIMIT);

  return rows.map(toTillSale);
};

/**
 * Charges a sale from the till. The server prices it from the shelf, keeps
 * the total the till showed beside it, and answers with the sale as recorded
 * and the new balances of its products, so the till can confirm its own rows
 * without fetching everything again. Sending the same clientRef twice returns
 * the first sale (`duplicate`).
 */
export const chargeTillSale = async (
  db: Db,
  actor: Actor,
  body: Omit<TillSaleBody, "cashierId">
): Promise<TillSaleReply> => {
  const recorded = await recordSale(db, actor, {
    branchId: body.branchId,
    clientRef: body.clientRef,
    expectedTotal: body.expectedTotal,
    lines: body.lines.map(({ productId, quantity }) => ({
      productId,
      quantity,
    })),
    paymentMethod: body.paymentMethod,
  });

  const [row] = await db
    .select(saleColumns)
    .from(sale)
    .leftJoin(saleLine, eq(saleLine.saleId, sale.id))
    .where(eq(sale.id, recorded.id))
    .groupBy(sale.id);

  if (row === undefined) {
    throw new Error(
      `Sale ${String(recorded.id)} vanished after it was recorded.`
    );
  }

  const levels = await levelRows(
    db,
    [body.branchId],
    body.lines.map((line) => line.productId)
  );

  return { duplicate: recorded.duplicate, levels, sale: toTillSale(row) };
};

/** The only columns the history sorts by: the allow-list's other half. */
const HISTORY_SORT_COLUMNS: Readonly<Record<HistorySortField, AnyPgColumn>> = {
  createdAt: sale.createdAt,
  total: sale.total,
};

/**
 * A page of a store's recorded sales, filtered and sorted on the server: what
 * the till's on-demand history collection asks for, one subset at a time.
 * Anyone may look at a branch except a cashier, who sees only their own store.
 */
export const getSaleHistory = async (
  db: Db,
  actor: Actor,
  query: HistoryQuery
): Promise<HistorySale[]> => {
  if (!canSeeBranch(actor, query.branchId)) {
    throw new StockError("forbidden", "You can't see this branch's sales.");
  }

  const order = query.sort.direction === "asc" ? asc : desc;

  const rows = await db
    .select(saleColumns)
    .from(sale)
    .leftJoin(saleLine, eq(saleLine.saleId, sale.id))
    .where(
      and(
        eq(sale.branchId, query.branchId),
        query.from === undefined
          ? undefined
          : gte(sale.createdAt, new Date(query.from)),
        query.to === undefined
          ? undefined
          : lt(sale.createdAt, new Date(query.to)),
        query.at === undefined
          ? undefined
          : eq(sale.createdAt, new Date(query.at)),
        query.totalIs === undefined ? undefined : eq(sale.total, query.totalIs),
        query.paymentMethods === undefined
          ? undefined
          : inArray(sale.paymentMethod, query.paymentMethods)
      )
    )
    .groupBy(sale.id)
    // The id breaks ties, so pages never overlap or skip a sale.
    .orderBy(order(HISTORY_SORT_COLUMNS[query.sort.field]), order(sale.id))
    // A whole window asks for one more than allowed, to know if it's too big.
    .limit(query.limit ?? HISTORY_WINDOW_MAX + 1)
    .offset(query.offset);

  if (query.limit === undefined && rows.length > HISTORY_WINDOW_MAX) {
    throw new StockError(
      "invalid_input",
      `More than ${String(HISTORY_WINDOW_MAX)} sales match: pick a shorter time.`
    );
  }

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
};
