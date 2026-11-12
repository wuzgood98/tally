import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { branch, product, sale, saleLine, till, user } from "@/lib/db/schema";
import type { Scope } from "@/lib/scope";

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
      sku: product.sku,
      unitPrice: saleLine.unitPrice,
    })
    .from(saleLine)
    .innerJoin(product, eq(product.id, saleLine.productId))
    .where(eq(saleLine.saleId, id))
    .orderBy(asc(product.name));

  return { ...header, lines };
};

export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSale>>>;
