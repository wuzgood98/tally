import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  branch,
  goodsReceipt,
  product,
  stockMovement,
  user,
} from "@/lib/db/schema";
import type { AdjustmentReason, MovementKind } from "@/lib/db/schema";

export interface MovementRow {
  readonly id: number;
  readonly createdAt: Date;
  readonly kind: MovementKind;
  readonly reason: AdjustmentReason | null;
  readonly quantity: number;
  readonly balanceAfter: number;
  readonly unitCost: number | null;
  readonly note: string | null;
  readonly branchId: string;
  readonly branchName: string;
  readonly productId: number;
  readonly productName: string;
  readonly sku: string;
  readonly receiptId: number | null;
  readonly receiptNumber: string | null;
  readonly userName: string | null;
}

export interface MovementFilter {
  readonly branchId?: string;
  readonly productId?: number;
  readonly kind?: MovementKind;
  readonly since?: Date;
  /** Keyset pagination: rows with an id below this. */
  readonly beforeId?: number;
}

export const listMovements = async (
  filter: MovementFilter,
  limit: number
): Promise<MovementRow[]> => {
  const conditions: (SQL | undefined)[] = [
    filter.branchId === undefined
      ? undefined
      : eq(stockMovement.branchId, filter.branchId),
    filter.productId === undefined
      ? undefined
      : eq(stockMovement.productId, filter.productId),
    filter.kind ? eq(stockMovement.kind, filter.kind) : undefined,
    filter.since ? gte(stockMovement.createdAt, filter.since) : undefined,
    filter.beforeId === undefined
      ? undefined
      : lt(stockMovement.id, filter.beforeId),
  ];

  return await getDb()
    .select({
      balanceAfter: stockMovement.balanceAfter,
      branchId: stockMovement.branchId,
      branchName: branch.name,
      createdAt: stockMovement.createdAt,
      id: stockMovement.id,
      kind: stockMovement.kind,
      note: stockMovement.note,
      productId: stockMovement.productId,
      productName: product.name,
      quantity: stockMovement.quantity,
      reason: stockMovement.adjustmentReason,
      receiptId: stockMovement.receiptId,
      receiptNumber: goodsReceipt.number,
      sku: product.sku,
      unitCost: stockMovement.unitCost,
      userName: user.name,
    })
    .from(stockMovement)
    .innerJoin(branch, eq(branch.id, stockMovement.branchId))
    .innerJoin(product, eq(product.id, stockMovement.productId))
    .leftJoin(goodsReceipt, eq(goodsReceipt.id, stockMovement.receiptId))
    .leftJoin(user, eq(user.id, stockMovement.userId))
    .where(and(...conditions))
    // Ids follow insertion order; the seed's backdating keeps them in time order too.
    .orderBy(desc(stockMovement.id))
    .limit(limit);
};

export const countMovements = async (
  filter: MovementFilter
): Promise<number> => {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(stockMovement)
    .where(
      and(
        filter.branchId === undefined
          ? undefined
          : eq(stockMovement.branchId, filter.branchId),
        filter.productId === undefined
          ? undefined
          : eq(stockMovement.productId, filter.productId),
        filter.kind ? eq(stockMovement.kind, filter.kind) : undefined
      )
    );

  return row?.count ?? 0;
};
