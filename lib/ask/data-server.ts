import "server-only";
import type { AskData } from "@/lib/ask/data";
import { getDb } from "@/lib/db";
import { searchPaletteProducts } from "@/lib/palette-search";
import { getOverviewTotals, getReorderLines } from "@/lib/queries/overview";
import { getProduct, getProductLevels } from "@/lib/queries/products";
import {
  getProductOnOrder,
  listPurchaseOrders,
} from "@/lib/queries/purchase-orders";
import { listReceipts } from "@/lib/queries/receipts";
import { getProductRequested, listStockRequests } from "@/lib/queries/requests";
import {
  getBestSellers,
  getProductUnitsSold,
  getTodaySales,
} from "@/lib/queries/sales";
import { getProductInTransit, listTransfers } from "@/lib/queries/transfers";
import { getSellers } from "@/lib/reports/sellers";
import { getShrinkage } from "@/lib/reports/shrinkage";
import { getStockValueSeries } from "@/lib/reports/stock-value";

const FIRST_PAGE = 1;

/** Ask Tally's port, bound to the app's own queries. */
export const serverAskData: AskData = {
  bestSellers: async (scope, days, limit) =>
    await getBestSellers(scope, days, limit),
  product: async (id) => await getProduct(id),
  productInTransit: async (id) => await getProductInTransit(id),
  productLevels: async (id) => await getProductLevels(id),
  productOnOrder: async (id) => await getProductOnOrder(id),
  productRequested: async (id) => await getProductRequested(id),
  productUnitsSold: async (id, days) => await getProductUnitsSold(id, days),
  purchaseOrders: async (scope, status) =>
    await listPurchaseOrders(scope, status, FIRST_PAGE),
  receipts: async (scope) => await listReceipts(scope, FIRST_PAGE),
  reorderLines: async (scope) => await getReorderLines(scope),
  searchProducts: async (scope, text) =>
    await searchPaletteProducts(getDb(), scope, text),
  sellers: async (branchIds, period) =>
    await getSellers(getDb(), branchIds, period),
  shrinkage: async (branchIds, period) =>
    await getShrinkage(getDb(), branchIds, period),
  stockRequests: async (scope, status) =>
    await listStockRequests(scope, status, FIRST_PAGE),
  stockTotals: async (scope) => await getOverviewTotals(scope),
  stockValue: async (branchIds, period) =>
    await getStockValueSeries(getDb(), branchIds, period),
  todaySales: async (scope) => await getTodaySales(scope),
  transfers: async (scope, status, direction) =>
    await listTransfers(scope, { direction, status }, FIRST_PAGE),
};
