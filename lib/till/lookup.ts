/**
 * Finding a product at the till without the server: the same rules as
 * `lookupProducts` (an exact barcode or SKU is an instant add; otherwise part
 * of the name lists matches), run over the till's products collection, so a
 * scan works while the connection is down.
 */

import type { LookupResult, PickedProduct } from "@/app/(app)/lookup-action";
import { LOOKUP_MATCHES_MAX, LOOKUP_TEXT_MAX } from "@/lib/limits";
import type { TillProduct, TillStockLevel } from "@/lib/till/schema";

/** The picker's shape: the till never knows costs, and on-hand comes from the levels. */
export const toPicked = (
  item: TillProduct,
  levels: readonly TillStockLevel[]
): PickedProduct => {
  const onHand: Record<string, number> = {};

  for (const level of levels) {
    if (level.productId === item.id) {
      onHand[level.branchId] = level.onHand;
    }
  }

  return { ...item, averageCost: null, onHand };
};

export const lookupTillProducts = (
  text: string,
  products: readonly TillProduct[],
  levels: readonly TillStockLevel[]
): LookupResult => {
  const query = text.trim().slice(0, LOOKUP_TEXT_MAX);

  if (query === "") {
    return { exact: null, matches: [] };
  }

  const sku = query.toUpperCase();

  const exact = products.find(
    (item) => item.barcode === query || item.sku.toUpperCase() === sku
  );

  if (exact !== undefined) {
    return { exact: toPicked(exact, levels), matches: [] };
  }

  const name = query.toLocaleLowerCase();

  const matches = products
    .filter((item) => item.name.toLocaleLowerCase().includes(name))
    .toSorted((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    .slice(0, LOOKUP_MATCHES_MAX)
    .map((item) => toPicked(item, levels));

  return { exact: null, matches };
};
