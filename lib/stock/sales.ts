/**
 * Sales: stock leaving a store with a customer. One sale, many lines; each
 * line is a `sale` movement and keeps the price charged and the average cost
 * at that moment, for margin reports.
 *
 * A sale is never refused for lack of stock: the customer is holding the item,
 * so the record is what's wrong. The balance goes below zero and the line
 * shows up as needing a count (see `allowNegative` in the ledger).
 *
 * Tills retry when the network drops, so every sale carries the till's own id
 * for it (`clientRef`). Sending the same one twice returns the first sale.
 */

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/lib/db/client";
import {
  branch,
  product,
  sale,
  saleLine,
  paymentMethodEnum,
} from "@/lib/db/schema";
import { canSell } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import { applyMovement, nextDocumentNumber } from "@/lib/stock/ledger";

export const MAX_SALE_LINES = 200;

/** A sanity cap per line, so a barcode scanned into the quantity box is caught. */
export const MAX_SALE_QUANTITY = 10_000;

export const saleInput = z.object({
  branchId: z.string().min(1),
  /** The till's id for this sale: a UUID or the POS's own receipt number. */
  clientRef: z
    .string()
    .trim()
    .min(8, "The sale needs a reference from the till.")
    .max(64),
  lines: z
    .array(
      z.object({
        productId: z.int().positive(),
        quantity: z
          .int("Quantities are whole units.")
          .positive("Quantities must be at least 1.")
          .max(MAX_SALE_QUANTITY, "That quantity looks wrong: check it."),
        /**
         * Pesewas per unit, for a POS that applies its own prices or
         * discounts. Left out, the shelf price is charged.
         */
        unitPrice: z.int().nonnegative().optional(),
      })
    )
    .min(1, "The basket is empty.")
    .max(MAX_SALE_LINES)
    .refine(
      (lines) =>
        new Set(lines.map((line) => line.productId)).size === lines.length,
      "Each product can appear only once on a sale."
    ),
  paymentMethod: z.enum(paymentMethodEnum.enumValues),
});

export type SaleRawInput = z.input<typeof saleInput>;

export interface SaleResult {
  readonly id: number;
  readonly number: string;
  readonly total: number;
  /** True when this clientRef was already recorded: nothing new was written. */
  readonly duplicate: boolean;
}

/** Thrown inside the transaction to roll it back when the sale already exists. */
class DuplicateSaleError extends Error {
  constructor() {
    super("This sale was already recorded.");
    this.name = "DuplicateSaleError";
  }
}

const findByClientRef = async (
  db: Db,
  branchId: string,
  clientRef: string
): Promise<SaleResult | null> => {
  const [row] = await db
    .select({ id: sale.id, number: sale.number, total: sale.total })
    .from(sale)
    .where(and(eq(sale.branchId, branchId), eq(sale.clientRef, clientRef)));

  return row === undefined ? null : { ...row, duplicate: true };
};

interface PricedProduct {
  readonly averageCost: number;
  readonly sellPrice: number;
}

const loadSaleReferences = async (
  db: Db,
  branchId: string,
  productIds: readonly number[]
): Promise<Map<number, PricedProduct>> => {
  const [[store], products] = await Promise.all([
    db
      .select({ kind: branch.kind })
      .from(branch)
      .where(eq(branch.id, branchId)),
    // Discontinued lines still on the shelf can be sold; only receiving stops.
    db
      .select({
        averageCost: product.averageCost,
        id: product.id,
        sellPrice: product.sellPrice,
      })
      .from(product)
      .where(inArray(product.id, [...productIds])),
  ]);

  if (store === undefined) {
    throw new StockError("not_found", "That branch doesn't exist.");
  }

  if (store.kind !== "store") {
    throw new StockError(
      "invalid_input",
      "The warehouse doesn't sell to customers."
    );
  }

  if (products.length !== productIds.length) {
    throw new StockError("not_found", "A product in the basket doesn't exist.");
  }

  return new Map(products.map((row) => [row.id, row]));
};

export const recordSale = async (
  db: Db,
  actor: Actor,
  rawInput: SaleRawInput
): Promise<SaleResult> => {
  const parsed = saleInput.safeParse(rawInput);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check the sale."
    );
  }

  const input = parsed.data;

  if (!canSell(actor, input.branchId)) {
    throw new StockError("forbidden", "You can't sell at this branch.");
  }

  const earlier = await findByClientRef(db, input.branchId, input.clientRef);

  if (earlier !== null) {
    return earlier;
  }

  const products = await loadSaleReferences(
    db,
    input.branchId,
    input.lines.map((line) => line.productId)
  );

  // Lock rows in a fixed order so concurrent sales can't deadlock.
  const lines = input.lines
    .map((line) => {
      const item = products.get(line.productId);

      return {
        productId: line.productId,
        quantity: line.quantity,
        unitCost: item?.averageCost ?? 0,
        unitPrice: line.unitPrice ?? item?.sellPrice ?? 0,
      };
    })
    .toSorted((a, b) => a.productId - b.productId);

  const total = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  );

  try {
    return await db.transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, "SAL", input.branchId);

      const [header] = await tx
        .insert(sale)
        .values({
          branchId: input.branchId,
          cashierId: actor.id,
          clientRef: input.clientRef,
          number,
          paymentMethod: input.paymentMethod,
          total,
        })
        .onConflictDoNothing({ target: [sale.branchId, sale.clientRef] })
        .returning({ id: sale.id });

      // Another request with the same clientRef got there first.
      if (header === undefined) {
        throw new DuplicateSaleError();
      }

      // One transaction runs on one connection, in product order (see above).
      /* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- see above */
      for (const line of lines) {
        await applyMovement(tx, {
          allowNegative: true,
          branchId: input.branchId,
          kind: "sale",
          productId: line.productId,
          quantity: -line.quantity,
          saleId: header.id,
          unitCost: line.unitCost,
          userId: actor.id,
        });
      }
      /* oxlint-enable no-await-in-loop, react-doctor/async-await-in-loop */

      await tx
        .insert(saleLine)
        .values(lines.map((line) => ({ ...line, saleId: header.id })));

      return { duplicate: false, id: header.id, number, total };
    });
  } catch (error) {
    if (!(error instanceof DuplicateSaleError)) {
      throw error;
    }

    const first = await findByClientRef(db, input.branchId, input.clientRef);

    if (first === null) {
      throw new Error("A duplicate sale vanished after its conflict.", {
        cause: error,
      });
    }

    return first;
  }
};
