import "server-only";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db";
import {
  branch,
  product,
  stockLevel,
  stockRequest,
  stockRequestLine,
  stockTransfer,
  user,
} from "@/lib/db/schema";
import type { StockRequestStatus } from "@/lib/db/schema";
import type { Scope } from "@/lib/scope";

export const REQUESTS_PAGE_SIZE = 30;

const store = alias(branch, "request_store");
const warehouse = alias(branch, "request_warehouse");
const requester = alias(user, "request_creator");

/** One branch on screen: requests it made, or requests made to it. */
const inScope = (scope: Scope) =>
  scope.kind === "branch"
    ? or(
        eq(stockRequest.branchId, scope.branchId),
        eq(stockRequest.fromBranchId, scope.branchId)
      )
    : undefined;

export const listStockRequests = async (
  scope: Scope,
  status: StockRequestStatus | null,
  page: number
) => {
  const where = and(
    inScope(scope),
    status === null ? undefined : eq(stockRequest.status, status)
  );

  const [rows, [count]] = await Promise.all([
    getDb()
      .select({
        createdAt: stockRequest.createdAt,
        id: stockRequest.id,
        number: stockRequest.number,
        requestedBy: requester.name,
        status: stockRequest.status,
        storeName: store.name,
        // Unique alias: subquery columns are emitted without a table prefix.
        // The query joins other tables, so the outer column keeps its prefix.
        units:
          sql<number>`(select coalesce(sum(${stockRequestLine.quantity}), 0)::int from ${stockRequestLine} where ${stockRequestLine.requestId} = ${stockRequest.id})`.as(
            "request_units"
          ),
      })
      .from(stockRequest)
      .innerJoin(store, eq(store.id, stockRequest.branchId))
      .leftJoin(requester, eq(requester.id, stockRequest.createdById))
      .where(where)
      .orderBy(desc(stockRequest.createdAt), desc(stockRequest.id))
      .limit(REQUESTS_PAGE_SIZE)
      .offset((page - 1) * REQUESTS_PAGE_SIZE),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(stockRequest)
      .where(where),
  ]);

  return { rows, total: count?.count ?? 0 };
};

/** Open requests waiting on these warehouses: the badge for whoever fulfils them. */
export const countOpenRequests = async (
  warehouseIds: readonly string[]
): Promise<number> => {
  if (warehouseIds.length === 0) {
    return 0;
  }

  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(stockRequest)
    .where(
      and(
        eq(stockRequest.status, "requested"),
        or(...warehouseIds.map((id) => eq(stockRequest.fromBranchId, id)))
      )
    );

  return row?.count ?? 0;
};

export const getStockRequest = async (id: number) => {
  const [header] = await getDb()
    .select({
      branchId: stockRequest.branchId,
      cancelledAt: stockRequest.cancelledAt,
      createdAt: stockRequest.createdAt,
      fromBranchId: stockRequest.fromBranchId,
      fulfilledAt: stockRequest.fulfilledAt,
      id: stockRequest.id,
      note: stockRequest.note,
      number: stockRequest.number,
      requestedBy: requester.name,
      status: stockRequest.status,
      storeName: store.name,
      transferId: stockRequest.transferId,
      transferNumber: stockTransfer.number,
      warehouseName: warehouse.name,
    })
    .from(stockRequest)
    .innerJoin(store, eq(store.id, stockRequest.branchId))
    .innerJoin(warehouse, eq(warehouse.id, stockRequest.fromBranchId))
    .leftJoin(requester, eq(requester.id, stockRequest.createdById))
    .leftJoin(stockTransfer, eq(stockTransfer.id, stockRequest.transferId))
    .where(eq(stockRequest.id, id));

  if (header === undefined) {
    return null;
  }

  const lines = await getDb()
    .select({
      // What the warehouse holds now, to judge what it can send.
      atWarehouse: sql<number>`coalesce(${stockLevel.onHand}, 0)::int`,
      name: product.name,
      productId: product.id,
      quantity: stockRequestLine.quantity,
      sku: product.sku,
    })
    .from(stockRequestLine)
    .innerJoin(product, eq(product.id, stockRequestLine.productId))
    .leftJoin(
      stockLevel,
      and(
        eq(stockLevel.productId, stockRequestLine.productId),
        eq(stockLevel.branchId, header.fromBranchId)
      )
    )
    .where(eq(stockRequestLine.requestId, id))
    .orderBy(asc(product.name));

  return { ...header, lines };
};

export type StockRequestDetail = NonNullable<
  Awaited<ReturnType<typeof getStockRequest>>
>;
