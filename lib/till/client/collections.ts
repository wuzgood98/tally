/**
 * The till's collections: typed, client-side copies of what the till
 * endpoints serve, kept fresh by TanStack Query and queried with live queries.
 *
 * This is the "adopt collections first" step: each one is the same
 * `queryKey` + `queryFn` a `useQuery` call would have used, wrapped in
 * `queryCollectionOptions`, so the data lands in a collection that components
 * can join, filter and mutate optimistically instead of in a per-hook cache.
 * They load everything at once (`syncMode: "eager"`, the default): the
 * catalogue must be in the browser for a scan to work without a connection.
 */

import type { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { BasicIndex, BTreeIndex, createCollection } from "@tanstack/react-db";

import { requestJson } from "@/lib/till/client/http";
import {
  tillCatalogueReply,
  tillProduct,
  tillSale,
  tillSalesReply,
  tillStockLevel,
  tillStockLevelsReply,
} from "@/lib/till/schema";
import { MINUTE_MS } from "@/lib/time";

/** Collection ids. Stable, because the offline queue (batch 3) finds collections by id. */
export const TILL_COLLECTION_IDS = {
  products: "till-products",
  sales: "till-sales",
  stockLevels: "till-stock-levels",
} as const;

export const createTillCollections = (queryClient: QueryClient) => {
  const products = createCollection(
    queryCollectionOptions({
      getKey: (item) => item.id,
      id: TILL_COLLECTION_IDS.products,
      queryClient,
      queryFn: async ({ signal }) =>
        await requestJson("/api/till/catalogue", tillCatalogueReply, {
          signal,
        }),
      queryKey: ["till", "products"],
      schema: tillProduct,
      select: (reply) => reply.products,
      // Prices change a few times a day; refreshed on focus after this.
      staleTime: 5 * MINUTE_MS,
    })
  );

  const stockLevels = createCollection(
    queryCollectionOptions({
      getKey: (item) => item.key,
      id: TILL_COLLECTION_IDS.stockLevels,
      queryClient,
      queryFn: async ({ signal }) =>
        await requestJson("/api/till/stock-levels", tillStockLevelsReply, {
          signal,
        }),
      queryKey: ["till", "stock-levels"],
      // Other tills and deliveries move stock too: catch up every minute
      // while the till is in front of someone.
      refetchInterval: MINUTE_MS,
      schema: tillStockLevel,
      select: (reply) => reply.levels,
      staleTime: MINUTE_MS / 2,
    })
  );

  const sales = createCollection(
    queryCollectionOptions({
      getKey: (item) => item.clientRef,
      id: TILL_COLLECTION_IDS.sales,
      queryClient,
      queryFn: async ({ signal }) =>
        await requestJson("/api/till/sales", tillSalesReply, { signal }),
      queryKey: ["till", "sales"],
      schema: tillSale,
      select: (reply) => reply.sales,
      staleTime: 5 * MINUTE_MS,
    })
  );

  // What the till's live queries look rows up by: the basket joins levels on
  // product and filters them by store; "Your sales today" filters by store
  // and sorts by time (a B-tree, for the ordering).
  stockLevels.createIndex((row) => row.productId, { indexType: BasicIndex });
  stockLevels.createIndex((row) => row.branchId, { indexType: BasicIndex });
  sales.createIndex((row) => row.branchId, { indexType: BasicIndex });
  sales.createIndex((row) => row.createdAt, { indexType: BTreeIndex });

  return { products, sales, stockLevels };
};

export type TillCollections = ReturnType<typeof createTillCollections>;
