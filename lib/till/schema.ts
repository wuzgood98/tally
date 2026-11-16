/**
 * The till's data, as it travels between the browser's collections and the
 * till endpoints (`/api/till/*`). Shared by both sides, so it must stay free
 * of the database schema: the browser bundles it.
 *
 * Nothing here carries a cost. Cashiers use the till and may not see costs,
 * so the till's rows never have the field at all, for anyone.
 */

import { z } from "zod";

import type { Unit } from "@/lib/db/schema";
import { PAYMENT_METHODS } from "@/lib/stock/payment";

const UNITS = [
  "each",
  "pack",
  "kg",
  "litre",
  "pair",
] as const satisfies readonly Unit[];

/** Kept in step with `MAX_SALE_LINES` and `MAX_SALE_QUANTITY` in `lib/stock/sales.ts`. */
const MAX_LINES = 200;
const MAX_QUANTITY = 10_000;

/** A product the till can sell: what a scan or a search needs, and the shelf price. */
export const tillProduct = z.object({
  barcode: z.string().nullable(),
  id: z.int().positive(),
  name: z.string(),
  /** Shelf price including VAT, in pesewas. */
  sellPrice: z.int().nonnegative(),
  sku: z.string(),
  unit: z.enum(UNITS),
});

export type TillProduct = z.output<typeof tillProduct>;

/** One product's balance at one store; keyed by both, see `stockLevelKey`. */
export const tillStockLevel = z.object({
  branchId: z.string(),
  key: z.string(),
  /** May be below zero: a sale is never refused for lack of stock. */
  onHand: z.int(),
  productId: z.int().positive(),
});

export type TillStockLevel = z.output<typeof tillStockLevel>;

export const stockLevelKey = (branchId: string, productId: number): string =>
  `${branchId}:${String(productId)}`;

/**
 * A sale as the till lists it. Keyed by `clientRef`, the till's own id for
 * the sale, so the row the till adds the moment it charges and the row the
 * server confirms are the same row: `id` and `number` stay null until then.
 */
export const tillSale = z.object({
  branchId: z.string(),
  clientRef: z.string(),
  /** ISO time: when the till charged it until the server confirms, then when it was recorded. */
  createdAt: z.iso.datetime({ offset: true }),
  /** What the till showed; differs from `total` if a shelf price changed before it synced. */
  expectedTotal: z.int().nonnegative().nullable(),
  id: z.int().positive().nullable(),
  number: z.string().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  total: z.int().nonnegative(),
  units: z.int().nonnegative(),
});

export type TillSale = z.output<typeof tillSale>;

/** What the till posts to charge a sale. Prices are never sent: the server charges the shelf price. */
export const tillSaleBody = z.object({
  branchId: z.string().min(1),
  /** Who charged it. The server refuses (401) if someone else is signed in. */
  cashierId: z.string().min(1),
  clientRef: z.string().trim().min(8).max(64),
  expectedTotal: z.int().nonnegative(),
  lines: z
    .array(
      z.object({
        productId: z.int().positive(),
        quantity: z.int().positive().max(MAX_QUANTITY),
      })
    )
    .min(1)
    .max(MAX_LINES),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

export type TillSaleBody = z.output<typeof tillSaleBody>;

/** The server's answer: the sale as recorded and the stores' new balances for its products. */
export const tillSaleReply = z.object({
  /** True when this clientRef was already recorded: nothing new was written. */
  duplicate: z.boolean(),
  levels: z.array(tillStockLevel),
  sale: tillSale,
});

export type TillSaleReply = z.output<typeof tillSaleReply>;

export const tillCatalogueReply = z.object({ products: z.array(tillProduct) });

export const tillStockLevelsReply = z.object({
  levels: z.array(tillStockLevel),
});

export const tillSalesReply = z.object({ sales: z.array(tillSale) });
