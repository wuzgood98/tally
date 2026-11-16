/**
 * The till's data, as it travels between the browser's collections and the
 * till endpoints (`/api/till/*`). Shared by both sides, so it must stay free
 * of the database schema: the browser bundles it.
 *
 * Nothing here carries a cost. Cashiers use the till and may not see costs,
 * so the till's rows never have the field at all, for anyone.
 */

import { z } from "zod";

import { MAX_SALE_LINES, MAX_SALE_QUANTITY, PRODUCT_UNITS } from "@/lib/limits";
import { PAYMENT_METHODS } from "@/lib/stock/payment";

/** A product the till can sell: what a scan or a search needs, and the shelf price. */
export const tillProduct = z.object({
  barcode: z.string().nullable(),
  id: z.int().positive(),
  name: z.string(),
  /** Shelf price including VAT, in pesewas. */
  sellPrice: z.int().nonnegative(),
  sku: z.string(),
  unit: z.enum(PRODUCT_UNITS),
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

/**
 * A charge: what the till queues and posts to `/api/till/sales`. Everything
 * needed to send it again after a reload, so it is parsed again when it comes
 * back out of the browser's storage rather than trusted, and parsed before it
 * is sent, which drops anything else. Prices are never sent: the server
 * charges the shelf price.
 */
export const tillCharge = z.object({
  branchId: z.string().min(1),
  /** Who charged it. The server holds it (401) if someone else is signed in. */
  cashierId: z.string().min(1),
  clientRef: z.string().trim().min(8).max(64),
  expectedTotal: z.int().nonnegative(),
  lines: z
    .array(
      z.object({
        productId: z.int().positive(),
        quantity: z.int().positive().max(MAX_SALE_QUANTITY),
      })
    )
    .min(1)
    .max(MAX_SALE_LINES),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

export type TillCharge = z.output<typeof tillCharge>;

/**
 * A sale Tally refused after the till had already let the customer go: kept
 * on this device, outside the outbox, so a manager can see what left the
 * shop and put it right (sell it again, or count the shelf).
 */
export const attentionSale = z.object({
  branchId: z.string(),
  /** When the till charged it. */
  chargedAt: z.iso.datetime({ offset: true }),
  clientRef: z.string(),
  expectedTotal: z.int().nonnegative(),
  /** When Tally refused it. */
  failedAt: z.iso.datetime({ offset: true }),
  lines: z.array(
    z.object({
      name: z.string(),
      productId: z.int().positive(),
      quantity: z.int().positive(),
    })
  ),
  paymentMethod: z.enum(PAYMENT_METHODS),
  /** Tally's reason, written for a person. */
  reason: z.string(),
});

export type AttentionSale = z.output<typeof attentionSale>;
