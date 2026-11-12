"use server";

import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { product, stockLevel } from "@/lib/db/schema";
import type { Unit } from "@/lib/db/schema";
import { requireViewer } from "@/lib/session";

export interface PickedProduct {
  readonly id: number;
  readonly name: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly unit: Unit;
  readonly averageCost: number;
  /** On hand per branch id; missing means never stocked there. */
  readonly onHand: Readonly<Record<string, number>>;
}

export interface LookupResult {
  /** Set when the text was an exact barcode or SKU: add it straight away. */
  readonly exact: PickedProduct | null;
  /** Otherwise, name matches to choose from. */
  readonly matches: readonly PickedProduct[];
}

const MAX_MATCHES = 8;

const withStock = async (
  rows: readonly Omit<PickedProduct, "onHand">[]
): Promise<PickedProduct[]> => {
  if (rows.length === 0) {
    return [];
  }

  const levels = await getDb()
    .select({
      branchId: stockLevel.branchId,
      onHand: stockLevel.onHand,
      productId: stockLevel.productId,
    })
    .from(stockLevel)
    .where(
      inArray(
        stockLevel.productId,
        rows.map((row) => row.id)
      )
    );

  const byProduct = new Map<number, Record<string, number>>();

  for (const level of levels) {
    const onHand = byProduct.get(level.productId) ?? {};
    onHand[level.branchId] = level.onHand;
    byProduct.set(level.productId, onHand);
  }

  return rows.map((row) => ({ ...row, onHand: byProduct.get(row.id) ?? {} }));
};

const columns = {
  averageCost: product.averageCost,
  barcode: product.barcode,
  id: product.id,
  name: product.name,
  sku: product.sku,
  unit: product.unit,
};

/** Finds active products by scanned barcode, SKU or part of the name. */
export const lookupProducts = async (text: string): Promise<LookupResult> => {
  await requireViewer();
  const query = text.trim().slice(0, 100);

  if (!query) {
    return { exact: null, matches: [] };
  }

  const [exact] = await getDb()
    .select(columns)
    .from(product)
    .where(
      and(
        eq(product.active, true),
        or(
          eq(product.barcode, query),
          ilike(product.sku, query.replaceAll(/[\\%_]/gu, ""))
        )
      )
    )
    .limit(1);

  if (exact !== undefined) {
    const [picked] = await withStock([exact]);

    return { exact: picked ?? null, matches: [] };
  }

  const pattern = `%${query.replaceAll(/[\\%_]/gu, (match) => `\\${match}`)}%`;

  const rows = await getDb()
    .select(columns)
    .from(product)
    .where(and(eq(product.active, true), ilike(product.name, pattern)))
    .orderBy(asc(product.name))
    .limit(MAX_MATCHES);

  return { exact: null, matches: await withStock(rows) };
};

/** One product by id, for forms opened from a product page. */
export const getPickedProduct = async (
  id: number
): Promise<PickedProduct | null> => {
  await requireViewer();

  const [row] = await getDb()
    .select(columns)
    .from(product)
    .where(and(eq(product.id, id), eq(product.active, true)));

  if (row === undefined) {
    return null;
  }

  const [picked] = await withStock([row]);

  return picked ?? null;
};
