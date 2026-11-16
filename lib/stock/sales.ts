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
import { MAX_SALE_LINES, MAX_SALE_QUANTITY } from "@/lib/limits";
import { canSell } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import { applyMovement, nextDocumentNumber } from "@/lib/stock/ledger";

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
  /**
   * The total the till showed, in pesewas. Kept beside the real total so a
   * shelf price changed while the sale sat in an offline queue shows up.
   */
  expectedTotal: z.int().nonnegative().optional(),
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

/** Who a sale is recorded against: a person at the in-app till, or a POS till. */
interface SaleSource {
  readonly cashierId: string | null;
  readonly tillId: number | null;
}

type SaleInput = z.infer<typeof saleInput>;

const parseSale = (rawInput: SaleRawInput): SaleInput => {
  const parsed = saleInput.safeParse(rawInput);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check the sale."
    );
  }

  return parsed.data;
};

/** The part every sale shares, once the caller is known to be allowed. */
const writeSale = async (
  db: Db,
  source: SaleSource,
  input: SaleInput
): Promise<SaleResult> => {
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
          cashierId: source.cashierId,
          clientRef: input.clientRef,
          expectedTotal: input.expectedTotal ?? null,
          number,
          paymentMethod: input.paymentMethod,
          tillId: source.tillId,
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
          userId: source.cashierId,
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

/** A sale rung up by a signed-in person on the in-app till. */
export const recordSale = async (
  db: Db,
  actor: Actor,
  rawInput: SaleRawInput
): Promise<SaleResult> => {
  const input = parseSale(rawInput);

  if (!canSell(actor, input.branchId)) {
    throw new StockError("forbidden", "You can't sell at this branch.");
  }

  return await writeSale(db, { cashierId: actor.id, tillId: null }, input);
};

/** An authenticated POS till: it can only ever sell at its own store. */
export interface TillIdentity {
  readonly tillId: number;
  readonly branchId: string;
}

/** A sale posted by a POS till through the sales API. */
export const recordTillSale = async (
  db: Db,
  identity: TillIdentity,
  rawInput: Omit<SaleRawInput, "branchId">
): Promise<SaleResult> => {
  const input = parseSale({ ...rawInput, branchId: identity.branchId });

  return await writeSale(
    db,
    { cashierId: null, tillId: identity.tillId },
    input
  );
};
