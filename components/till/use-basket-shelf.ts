"use client";

import { coalesce, eq, inArray, useLiveQuery } from "@tanstack/react-db";

import { useTillData } from "@/components/till/till-data-provider";

export interface ShelfFacts {
  /** Shelf price the till knows now, in pesewas. */
  readonly sellPrice: number;
  /** On hand at the till's store; 0 when never stocked there. */
  readonly onHand: number;
}

/**
 * The live price and shelf count of each product in the basket, at one store:
 * a join across two collections (products, and the store's slice of the
 * stock levels). It updates on its own when the catalogue refreshes, when
 * another till's sale or a delivery moves the count, and the moment this till
 * charges a sale (the optimistic decrement).
 */
export const useBasketShelf = (
  storeId: string,
  productIds: readonly number[]
): ReadonlyMap<number, ShelfFacts> => {
  const { products, stockLevels } = useTillData();

  const { data } = useLiveQuery({
    query: (q) => {
      const atStore = q
        .from({ level: stockLevels })
        .where(({ level }) => eq(level.branchId, storeId));

      return q
        .from({ product: products })
        .leftJoin({ level: atStore }, ({ product, level }) =>
          eq(product.id, level.productId)
        )
        .where(({ product }) => inArray(product.id, [...productIds]))
        .select(({ product, level }) => ({
          id: product.id,
          onHand: coalesce(level?.onHand, 0),
          sellPrice: product.sellPrice,
        }));
    },
  });

  return new Map(
    data.map((row) => [
      row.id,
      { onHand: row.onHand, sellPrice: row.sellPrice },
    ])
  );
};
