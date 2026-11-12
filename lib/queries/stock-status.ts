import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { product, stockLevel } from "@/lib/db/schema";
import type { Scope } from "@/lib/scope";

/** A branch's threshold if it set one, otherwise the product's. */
export const effectiveReorderPoint = sql<number>`coalesce(${stockLevel.reorderPoint}, ${product.reorderPoint})`;

/** At or below the reorder point, but not empty. */
export const isLow = sql<boolean>`(${stockLevel.onHand} > 0 and ${stockLevel.onHand} <= ${effectiveReorderPoint})`;

/** Empty, or below zero after selling stock the record said wasn't there. */
export const isOut = sql<boolean>`(${stockLevel.onHand} <= 0)`;

export type StockStatus = "out" | "low" | "ok";

export const stockStatus = (
  onHand: number,
  reorderPoint: number
): StockStatus => {
  if (onHand <= 0) {
    return "out";
  }

  return onHand <= reorderPoint ? "low" : "ok";
};

/** Restricts stock_level rows to the scope's branch, or to nothing extra. */
export const levelInScope = (scope: Scope): SQL =>
  scope.kind === "branch"
    ? sql`${stockLevel.branchId} = ${scope.branchId}`
    : sql`true`;
