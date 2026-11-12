import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  branch,
  category,
  goodsReceipt,
  product,
  purchaseOrder,
  purchaseOrderLine,
  stockLevel,
  stockTransfer,
  stockTransferLine,
  supplier,
} from "@/lib/db/schema";
import {
  effectiveReorderPoint,
  isLow,
  isOut,
  levelInScope,
} from "@/lib/queries/stock-status";
import type { Scope } from "@/lib/scope";

const WEEK_MS = 7 * 86_400_000;

export interface OverviewTotals {
  /** On hand × moving average cost, in pesewas. */
  readonly costValue: number;
  /** On hand × shelf price, in pesewas. */
  readonly retailValue: number;
  readonly units: number;
  readonly linesInStock: number;
  readonly lowLines: number;
  readonly outLines: number;
}

export const getOverviewTotals = async (
  scope: Scope
): Promise<OverviewTotals> => {
  const [row] = await getDb()
    .select({
      costValue: sql<number>`coalesce(sum(greatest(${stockLevel.onHand}, 0)::bigint * ${product.averageCost}), 0)::float8`,
      linesInStock: sql<number>`count(*) filter (where ${stockLevel.onHand} > 0)::int`,
      lowLines: sql<number>`count(*) filter (where ${isLow})::int`,
      outLines: sql<number>`count(*) filter (where ${isOut})::int`,
      retailValue: sql<number>`coalesce(sum(greatest(${stockLevel.onHand}, 0)::bigint * ${product.sellPrice}), 0)::float8`,
      units: sql<number>`coalesce(sum(greatest(${stockLevel.onHand}, 0)), 0)::float8`,
    })
    .from(stockLevel)
    .innerJoin(product, eq(product.id, stockLevel.productId))
    .where(and(levelInScope(scope), eq(product.active, true)));

  return (
    row ?? {
      costValue: 0,
      linesInStock: 0,
      lowLines: 0,
      outLines: 0,
      retailValue: 0,
      units: 0,
    }
  );
};

export interface BranchHealth {
  readonly id: string;
  readonly name: string;
  readonly kind: "store" | "warehouse";
  readonly costValue: number;
  readonly lowLines: number;
  readonly outLines: number;
  readonly lines: number;
}

/** One row per branch, for head office's comparison table. */
export const getBranchHealth = async (): Promise<BranchHealth[]> =>
  await getDb()
    .select({
      costValue: sql<number>`coalesce(sum(greatest(${stockLevel.onHand}, 0)::bigint * ${product.averageCost}), 0)::float8`,
      id: branch.id,
      kind: branch.kind,
      lines: sql<number>`count(${product.id})::int`,
      lowLines: sql<number>`count(*) filter (where ${isLow})::int`,
      name: branch.name,
      outLines: sql<number>`count(*) filter (where ${isOut})::int`,
    })
    .from(branch)
    .leftJoin(stockLevel, eq(stockLevel.branchId, branch.id))
    .leftJoin(
      product,
      and(eq(product.id, stockLevel.productId), eq(product.active, true))
    )
    .groupBy(branch.id, branch.name, branch.kind)
    .orderBy(branch.kind, branch.name);

export interface ReorderLine {
  readonly productId: number;
  readonly sku: string;
  readonly name: string;
  readonly branchId: string;
  readonly branchName: string;
  readonly onHand: number;
  readonly reorderPoint: number;
  /** Units already on a transfer to this branch, so nobody orders them twice. */
  readonly inTransit: number;
  /** Units still due on approved purchase orders for this branch. */
  readonly onOrder: number;
  readonly supplierId: number | null;
  readonly supplierName: string | null;
  readonly categoryName: string;
}

/**
 * Lines at or below their reorder point, emptiest first (relative to the
 * threshold), so a shelf with 0 of 40 comes before one with 9 of 10.
 */
export const getReorderLines = async (
  scope: Scope,
  limit: number
): Promise<ReorderLine[]> =>
  await getDb()
    .select({
      branchId: stockLevel.branchId,
      branchName: branch.name,
      categoryName: category.name,
      // Unique alias: subquery columns are emitted without a table prefix.
      inTransit: sql<number>`(
        select coalesce(sum(${stockTransferLine.quantitySent}), 0)::int
        from ${stockTransferLine}
        join ${stockTransfer} on ${stockTransfer.id} = ${stockTransferLine.transferId}
        where ${stockTransfer.status} = 'in_transit'
          and ${stockTransfer.toBranchId} = ${stockLevel.branchId}
          and ${stockTransferLine.productId} = ${stockLevel.productId}
      )`.as("reorder_in_transit"),
      onOrder: sql<number>`(
        select coalesce(sum(${purchaseOrderLine.quantity} - ${purchaseOrderLine.quantityReceived}), 0)::int
        from ${purchaseOrderLine}
        join ${purchaseOrder} on ${purchaseOrder.id} = ${purchaseOrderLine.purchaseOrderId}
        where ${purchaseOrder.status} in ('approved', 'partly_received')
          and ${purchaseOrder.branchId} = ${stockLevel.branchId}
          and ${purchaseOrderLine.productId} = ${stockLevel.productId}
      )`.as("reorder_on_order"),
      name: product.name,
      onHand: stockLevel.onHand,
      productId: product.id,
      reorderPoint: effectiveReorderPoint,
      sku: product.sku,
      supplierId: supplier.id,
      supplierName: supplier.name,
    })
    .from(stockLevel)
    .innerJoin(product, eq(product.id, stockLevel.productId))
    .innerJoin(branch, eq(branch.id, stockLevel.branchId))
    .innerJoin(category, eq(category.id, product.categoryId))
    .leftJoin(supplier, eq(supplier.id, product.defaultSupplierId))
    .where(
      and(
        levelInScope(scope),
        eq(product.active, true),
        sql`${stockLevel.onHand} <= ${effectiveReorderPoint}`
      )
    )
    .orderBy(
      sql`${stockLevel.onHand}::float8 / greatest(${effectiveReorderPoint}, 1)`,
      product.name
    )
    .limit(limit);

export interface WeekReceipts {
  readonly count: number;
  readonly totalCost: number;
}

export const getWeekReceipts = async (
  scope: Scope,
  now = new Date()
): Promise<WeekReceipts> => {
  const [row] = await getDb()
    .select({
      count: sql<number>`count(*)::int`,
      totalCost: sql<number>`coalesce(sum(${goodsReceipt.totalCost}), 0)::float8`,
    })
    .from(goodsReceipt)
    .where(
      and(
        gte(goodsReceipt.createdAt, new Date(now.getTime() - WEEK_MS)),
        scope.kind === "branch"
          ? eq(goodsReceipt.branchId, scope.branchId)
          : undefined
      )
    );

  return row ?? { count: 0, totalCost: 0 };
};
