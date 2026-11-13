import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { Db } from "@/lib/db/client";
import { product, stockLevel } from "@/lib/db/schema";
import type { Scope } from "@/lib/scope";

export interface PaletteProduct {
  readonly id: number;
  readonly name: string;
  readonly sku: string;
  readonly active: boolean;
  /** The text was this product's barcode or whole SKU: Enter opens it. */
  readonly exact: boolean;
  /** On hand in the scope; null when it was never stocked there. */
  readonly onHand: number | null;
}

export const PALETTE_PRODUCT_LIMIT = 8;
const MAX_QUERY_LENGTH = 100;
const LIKE_SPECIALS = /[\\%_]/gu;

const escapeLike = (text: string): string =>
  text.replaceAll(LIKE_SPECIALS, (match) => `\\${match}`);

const onHandIn = async (
  db: Db,
  scope: Scope,
  productIds: readonly number[]
): Promise<Map<number, number>> => {
  const levels = await db
    .select({ onHand: stockLevel.onHand, productId: stockLevel.productId })
    .from(stockLevel)
    .where(
      scope.kind === "all"
        ? inArray(stockLevel.productId, [...productIds])
        : and(
            inArray(stockLevel.productId, [...productIds]),
            eq(stockLevel.branchId, scope.branchId)
          )
    );

  const totals = new Map<number, number>();

  for (const level of levels) {
    totals.set(
      level.productId,
      (totals.get(level.productId) ?? 0) + level.onHand
    );
  }

  return totals;
};

/**
 * Products for the command palette: a scanned barcode or a whole SKU first,
 * then SKUs that start with the text, then names that contain it. Unlike
 * the forms' lookup it includes discontinued lines, since people still look
 * them up.
 */
export const searchPaletteProducts = async (
  db: Db,
  scope: Scope,
  text: string
): Promise<PaletteProduct[]> => {
  const query = text.trim().slice(0, MAX_QUERY_LENGTH);

  if (query === "") {
    return [];
  }

  const literal = escapeLike(query);
  // coalesce: a missing barcode compares as NULL, which `desc` sorts first.
  const isExact = sql<boolean>`coalesce(${product.barcode} = ${query}, false) or ${product.sku} ilike ${literal}`;

  const rows = await db
    .select({
      active: product.active,
      exact: isExact,
      id: product.id,
      name: product.name,
      sku: product.sku,
    })
    .from(product)
    .where(
      or(
        eq(product.barcode, query),
        ilike(product.sku, `${literal}%`),
        ilike(product.name, `%${literal}%`)
      )
    )
    .orderBy(
      desc(isExact),
      desc(sql`${product.sku} ilike ${`${literal}%`}`),
      desc(product.active),
      asc(product.name)
    )
    .limit(PALETTE_PRODUCT_LIMIT);

  if (rows.length === 0) {
    return [];
  }

  const totals = await onHandIn(
    db,
    scope,
    rows.map((row) => row.id)
  );

  return rows.map((row) => ({
    ...row,
    exact: row.exact,
    onHand: totals.get(row.id) ?? null,
  }));
};
