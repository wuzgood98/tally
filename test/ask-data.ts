/**
 * A fake for Ask Tally's data port that records every call, so tests can
 * see exactly which scope or branches each tool read.
 */

import type { AskData } from "@/lib/ask/data";

export interface Call {
  readonly name: keyof AskData;
  readonly args: readonly unknown[];
}

const NO_ROWS = { rows: [], total: 0 };

const DEFAULT_DATA: AskData = {
  bestSellers: async () => await Promise.resolve([]),
  product: async () => await Promise.resolve(null),
  productInTransit: async () => await Promise.resolve(new Map()),
  productLevels: async () => await Promise.resolve([]),
  productOnOrder: async () => await Promise.resolve(new Map()),
  productRequested: async () => await Promise.resolve(new Map()),
  productUnitsSold: async () => await Promise.resolve(new Map()),
  purchaseOrders: async () => await Promise.resolve(NO_ROWS),
  receipts: async () => await Promise.resolve(NO_ROWS),
  reorderLines: async () => await Promise.resolve([]),
  searchProducts: async () => await Promise.resolve([]),
  sellers: async () => await Promise.resolve([]),
  shrinkage: async () =>
    await Promise.resolve({ lines: [], salesCost: {}, transit: [] }),
  stockRequests: async () => await Promise.resolve(NO_ROWS),
  stockTotals: async () =>
    await Promise.resolve({
      costValue: 0,
      linesInStock: 0,
      lowLines: 0,
      outLines: 0,
      retailValue: 0,
      units: 0,
    }),
  stockValue: async () => await Promise.resolve([]),
  todaySales: async () => await Promise.resolve({ count: 0, total: 0 }),
  transfers: async () => await Promise.resolve(NO_ROWS),
};

/** A data port that records every call and answers with `answers`. */
export const fakeData = (answers: Partial<AskData> = {}) => {
  const calls: Call[] = [];
  const real: AskData = { ...DEFAULT_DATA, ...answers };

  const log = (name: keyof AskData, args: readonly unknown[]): void => {
    calls.push({ args, name });
  };

  const data: AskData = {
    bestSellers: async (...args) => {
      log("bestSellers", args);

      return await real.bestSellers(...args);
    },
    product: async (...args) => {
      log("product", args);

      return await real.product(...args);
    },
    productInTransit: async (...args) => {
      log("productInTransit", args);

      return await real.productInTransit(...args);
    },
    productLevels: async (...args) => {
      log("productLevels", args);

      return await real.productLevels(...args);
    },
    productOnOrder: async (...args) => {
      log("productOnOrder", args);

      return await real.productOnOrder(...args);
    },
    productRequested: async (...args) => {
      log("productRequested", args);

      return await real.productRequested(...args);
    },
    productUnitsSold: async (...args) => {
      log("productUnitsSold", args);

      return await real.productUnitsSold(...args);
    },
    purchaseOrders: async (...args) => {
      log("purchaseOrders", args);

      return await real.purchaseOrders(...args);
    },
    receipts: async (...args) => {
      log("receipts", args);

      return await real.receipts(...args);
    },
    reorderLines: async (...args) => {
      log("reorderLines", args);

      return await real.reorderLines(...args);
    },
    searchProducts: async (...args) => {
      log("searchProducts", args);

      return await real.searchProducts(...args);
    },
    sellers: async (...args) => {
      log("sellers", args);

      return await real.sellers(...args);
    },
    shrinkage: async (...args) => {
      log("shrinkage", args);

      return await real.shrinkage(...args);
    },
    stockRequests: async (...args) => {
      log("stockRequests", args);

      return await real.stockRequests(...args);
    },
    stockTotals: async (...args) => {
      log("stockTotals", args);

      return await real.stockTotals(...args);
    },
    stockValue: async (...args) => {
      log("stockValue", args);

      return await real.stockValue(...args);
    },
    todaySales: async (...args) => {
      log("todaySales", args);

      return await real.todaySales(...args);
    },
    transfers: async (...args) => {
      log("transfers", args);

      return await real.transfers(...args);
    },
  };

  return { calls, data };
};
