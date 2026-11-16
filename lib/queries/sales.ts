import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  branch,
  product,
  sale,
  saleLine,
  saleReturn,
  saleReturnLine,
  till,
  user,
} from "@/lib/db/schema";
import type { Scope } from "@/lib/scope";
import { DAY_MS } from "@/lib/time";

export const SALES_PAGE_SIZE = 50;

/** Ghana keeps GMT all year, so "today" starts at UTC midnight. */
const startOfToday = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const inScope = (scope: Scope) =>
  scope.kind === "branch" ? eq(sale.branchId, scope.branchId) : undefined;

export const listSales = async (scope: Scope, page: number) => {
  const where = inScope(scope);

  const [rows, [count]] = await Promise.all([
    getDb()
      .select({
        branchName: branch.name,
        // A POS sale has no cashier in Tally: name the till instead.
        cashier: sql<string | null>`coalesce(${user.name}, ${till.name})`,
        createdAt: sale.createdAt,
        id: sale.id,
        number: sale.number,
        paymentMethod: sale.paymentMethod,
        total: sale.total,
        // Unique alias: subquery columns are emitted without a table prefix.
        units:
          sql<number>`(select coalesce(sum(${saleLine.quantity}), 0)::int from ${saleLine} where ${saleLine.saleId} = ${sale.id})`.as(
            "sale_units"
          ),
      })
      .from(sale)
      .innerJoin(branch, eq(branch.id, sale.branchId))
      .leftJoin(user, eq(user.id, sale.cashierId))
      .leftJoin(till, eq(till.id, sale.tillId))
      .where(where)
      .orderBy(desc(sale.createdAt), desc(sale.id))
      .limit(SALES_PAGE_SIZE)
      .offset((page - 1) * SALES_PAGE_SIZE),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(sale)
      .where(where),
  ]);

  return { rows, total: count?.count ?? 0 };
};

export interface DaySales {
  readonly count: number;
  readonly total: number;
}

export const getTodaySales = async (
  scope: Scope,
  now = new Date()
): Promise<DaySales> => {
  const [row] = await getDb()
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${sale.total}), 0)::float8`,
    })
    .from(sale)
    .where(and(inScope(scope), gte(sale.createdAt, startOfToday(now))));

  return row ?? { count: 0, total: 0 };
};

export const getSale = async (id: number) => {
  const [header] = await getDb()
    .select({
      branchId: sale.branchId,
      branchName: branch.name,
      // A POS sale has no cashier in Tally: name the till instead.
      cashier: sql<string | null>`coalesce(${user.name}, ${till.name})`,
      clientRef: sale.clientRef,
      createdAt: sale.createdAt,
      expectedTotal: sale.expectedTotal,
      id: sale.id,
      number: sale.number,
      paymentMethod: sale.paymentMethod,
      total: sale.total,
    })
    .from(sale)
    .innerJoin(branch, eq(branch.id, sale.branchId))
    .leftJoin(user, eq(user.id, sale.cashierId))
    .leftJoin(till, eq(till.id, sale.tillId))
    .where(eq(sale.id, id));

  if (header === undefined) {
    return null;
  }

  const lines = await getDb()
    .select({
      name: product.name,
      productId: product.id,
      quantity: saleLine.quantity,
      // Unique alias: subquery columns are emitted without a table prefix.
      returned: sql<number>`(
        select coalesce(sum(${saleReturnLine.quantity}), 0)::int
        from ${saleReturnLine}
        join ${saleReturn} on ${saleReturn.id} = ${saleReturnLine.returnId}
        where ${saleReturn.saleId} = ${saleLine.saleId}
          and ${saleReturnLine.productId} = ${saleLine.productId}
      )`.as("line_returned"),
      sku: product.sku,
      unitPrice: saleLine.unitPrice,
    })
    .from(saleLine)
    .innerJoin(product, eq(product.id, saleLine.productId))
    .where(eq(saleLine.saleId, id))
    .orderBy(asc(product.name));

  return { ...header, lines };
};

/** Returns against one sale, oldest first, each with its lines. */
export const getSaleReturns = async (saleId: number) => {
  const headers = await getDb()
    .select({
      approvedBy: user.name,
      createdAt: saleReturn.createdAt,
      id: saleReturn.id,
      number: saleReturn.number,
      reason: saleReturn.reason,
      refund: saleReturn.refund,
    })
    .from(saleReturn)
    .leftJoin(user, eq(user.id, saleReturn.approvedById))
    .where(eq(saleReturn.saleId, saleId))
    .orderBy(asc(saleReturn.id));

  if (headers.length === 0) {
    return [];
  }

  const lines = await getDb()
    .select({
      disposition: saleReturnLine.disposition,
      name: product.name,
      productId: saleReturnLine.productId,
      quantity: saleReturnLine.quantity,
      returnId: saleReturnLine.returnId,
    })
    .from(saleReturnLine)
    .innerJoin(saleReturn, eq(saleReturn.id, saleReturnLine.returnId))
    .innerJoin(product, eq(product.id, saleReturnLine.productId))
    .where(eq(saleReturn.saleId, saleId))
    .orderBy(asc(product.name));

  return headers.map((header) => ({
    ...header,
    lines: lines.filter((line) => line.returnId === header.id),
  }));
};

export type SaleReturnSummary = Awaited<
  ReturnType<typeof getSaleReturns>
>[number];

export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSale>>>;

/** The products that sold most units in the last `days`, in the scope. */
export const getBestSellers = async (
  scope: Scope,
  days: number,
  limit: number,
  now = new Date()
) =>
  await getDb()
    .select({
      name: product.name,
      productId: product.id,
      revenue: sql<number>`sum(${saleLine.quantity}::bigint * ${saleLine.unitPrice})::float8`,
      sku: product.sku,
      units: sql<number>`sum(${saleLine.quantity})::int`,
    })
    .from(saleLine)
    .innerJoin(sale, eq(sale.id, saleLine.saleId))
    .innerJoin(product, eq(product.id, saleLine.productId))
    .where(
      and(
        inScope(scope),
        gte(sale.createdAt, new Date(now.getTime() - days * DAY_MS))
      )
    )
    .groupBy(product.id, product.name, product.sku)
    .orderBy(desc(sql`sum(${saleLine.quantity})`), asc(product.name))
    .limit(limit);

export type BestSeller = Awaited<ReturnType<typeof getBestSellers>>[number];

/** Units of one product sold in the last `days`, by branch id. */
export const getProductUnitsSold = async (
  productId: number,
  days: number,
  now = new Date()
): Promise<Map<string, number>> => {
  const rows = await getDb()
    .select({
      branchId: sale.branchId,
      units: sql<number>`sum(${saleLine.quantity})::int`,
    })
    .from(saleLine)
    .innerJoin(sale, eq(sale.id, saleLine.saleId))
    .where(
      and(
        eq(saleLine.productId, productId),
        gte(sale.createdAt, new Date(now.getTime() - days * DAY_MS))
      )
    )
    .groupBy(sale.branchId);

  return new Map(rows.map((row) => [row.branchId, row.units]));
};
