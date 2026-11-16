/**
 * The sales API's request body, as a POS till sends it. Tills know products
 * by SKU or barcode, not by Tally's ids, so this resolves them and then
 * records the sale like any other (`recordTillSale`).
 */

import { inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/lib/db/client";
import { product } from "@/lib/db/schema";
import { MAX_SALE_LINES } from "@/lib/limits";
import { StockError } from "@/lib/stock/errors";
import { PAYMENT_METHODS } from "@/lib/stock/payment";
import { recordTillSale } from "@/lib/stock/sales";
import type { SaleResult, TillIdentity } from "@/lib/stock/sales";

const apiLine = z
  .object({
    barcode: z.string().trim().min(1).max(32).optional(),
    quantity: z.int().positive(),
    sku: z.string().trim().min(1).max(32).optional(),
    /** Pesewas per unit, for the POS's own prices and discounts. */
    unitPrice: z.int().nonnegative().optional(),
  })
  .refine((line) => line.sku !== undefined || line.barcode !== undefined, {
    message: "Each line needs a sku or a barcode.",
  });

export const apiSaleBody = z.object({
  clientRef: z.string(),
  lines: z.array(apiLine).min(1).max(MAX_SALE_LINES),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

export type ApiSaleBody = z.output<typeof apiSaleBody>;

/** A line's product, by SKU (any case) or barcode. */
const resolveProducts = async (
  db: Db,
  lines: ApiSaleBody["lines"]
): Promise<number[]> => {
  const skus = lines.flatMap((line) =>
    line.sku === undefined ? [] : [line.sku.toUpperCase()]
  );

  const barcodes = lines.flatMap((line) =>
    line.barcode === undefined ? [] : [line.barcode]
  );

  const found = await db
    .select({ barcode: product.barcode, id: product.id, sku: product.sku })
    .from(product)
    .where(
      or(
        skus.length > 0 ? inArray(sql`upper(${product.sku})`, skus) : undefined,
        barcodes.length > 0 ? inArray(product.barcode, barcodes) : undefined
      )
    );

  const bySku = new Map(found.map((row) => [row.sku.toUpperCase(), row.id]));

  const byBarcode = new Map(
    found.flatMap((row) =>
      row.barcode === null ? [] : [[row.barcode, row.id]]
    )
  );

  return lines.map((line) => {
    const id =
      line.sku === undefined
        ? byBarcode.get(line.barcode ?? "")
        : bySku.get(line.sku.toUpperCase());

    if (id === undefined) {
      throw new StockError(
        "not_found",
        `No product with ${line.sku === undefined ? `barcode ${line.barcode ?? ""}` : `SKU ${line.sku}`}.`
      );
    }

    return id;
  });
};

export const postTillSale = async (
  db: Db,
  identity: TillIdentity,
  body: ApiSaleBody
): Promise<SaleResult> => {
  const productIds = await resolveProducts(db, body.lines);

  return await recordTillSale(db, identity, {
    clientRef: body.clientRef,
    lines: body.lines.map((line, index) => ({
      productId: productIds[index] ?? 0,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    paymentMethod: body.paymentMethod,
  });
};
