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
import { jsonFailure } from "@/lib/http";
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
  TillCharge,
  TillProduct,
  TillSale,
  TillSaleReply,
  TillStockLevel,
} from "@/lib/till/schema";

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

/**
 * Who may use a till endpoint, or the reply to send instead: 401 when signed
 * out (the proxy lets `/api/till` through, so a queued sale replayed after
 * the session ended gets a 401 it can wait on, not a sign-in page that would
 * look like success), 404 for someone with no till (storekeepers), so the
 * endpoint doesn't hint that it exists.
 *
 * For a charge, `chargedBy` is who the till says charged it. A sale charged
 * by someone other than the person signed in gets 401 `wrong_user` before
 * anything else is checked: the queue holds it until its cashier signs in
 * again, rather than taking the other person's 404 as a refusal for good.
 */
export const tillAccess = async <Who extends Actor>(
  db: Db,
  who: Who | null,
  chargedBy?: string
): Promise<Who | Response> => {
  if (who === null) {
    return jsonFailure(401, "unauthorized", "Sign in again.");
  }

  if (chargedBy !== undefined && chargedBy !== who.id) {
    return jsonFailure(
      401,
      "wrong_user",
      "This sale was charged by someone else. It will be sent when they sign in."
    );
  }

  const stores = await tillStoreIds(db, who);

  if (stores.length === 0) {
    return jsonFailure(404, "not_found", "Not found.");
  }

  return who;
};

/**
 * Every product the till can sell, for someone with a till; nothing for
 * anyone else. Discontinued lines can't be scanned in, as on the other forms.
 */
export const getTillCatalogue = async (
  db: Db,
  actor: Actor
): Promise<TillProduct[]> => {
  const stores = await tillStoreIds(db, actor);

  if (stores.length === 0) {
    return [];
  }

  return await db
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
};

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

/** A sale row as it travels: the time as an ISO string. */
const withIsoTime = <Row extends { readonly createdAt: Date }>(
  row: Row
): Omit<Row, "createdAt"> & { createdAt: string } => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Today's sales this person rang up at their tills, newest first. Every one
 * of them, with no cap: one person's day is bounded on its own, and the till
 * counts and sums this list for "Your sales today", so a cap would undercount.
 * A join (not a correlated subquery) counts the units: in a single-table
 * select, Drizzle writes outer columns without a table prefix, so Postgres
 * binds them to the inner table's column of the same name.
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
    .orderBy(desc(sale.createdAt), desc(sale.id));

  return rows.map(withIsoTime);
};

/**
 * Charges a sale from the till. The server prices it from the shelf, keeps
 * the total the till showed beside it, and answers with the sale as recorded
 * and the new balances of its products, so the till can confirm its own rows
 * without fetching everything again. Sending the same clientRef twice returns
 * the first sale (`duplicate`), but only to the person who charged it: a
 * reference already used by someone else's sale is a conflict, never their
 * sale handed back as this one.
 */
export const chargeTillSale = async (
  db: Db,
  actor: Actor,
  charge: Omit<TillCharge, "cashierId">
): Promise<TillSaleReply> => {
  const recorded = await recordSale(db, actor, charge);

  const [found] = await db
    .select({ ...saleColumns, cashierId: sale.cashierId })
    .from(sale)
    .leftJoin(saleLine, eq(saleLine.saleId, sale.id))
    .where(eq(sale.id, recorded.id))
    .groupBy(sale.id);

  if (found === undefined) {
    throw new Error(
      `Sale ${String(recorded.id)} vanished after it was recorded.`
    );
  }

  const { cashierId, ...row } = found;

  if (recorded.duplicate && cashierId !== actor.id) {
    throw new StockError(
      "conflict",
      "Another sale already uses this till reference."
    );
  }

  const levels = await levelRows(
    db,
    [charge.branchId],
    charge.lines.map((line) => line.productId)
  );

  return { duplicate: recorded.duplicate, levels, sale: withIsoTime(row) };
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

  return rows.map(withIsoTime);
};
