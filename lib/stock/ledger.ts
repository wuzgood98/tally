/**
 * The one place stock changes. Each movement updates the running balance in
 * `stock_level` and appends to `stock_movement` in the caller's transaction,
 * so the ledger and the balance can never disagree.
 *
 * The balance is changed with a single conditional UPDATE (`on_hand + q >= 0`),
 * so two tills or storekeepers racing for the last unit can't both win:
 * Postgres serialises the row and the loser sees no row updated.
 */

import { and, eq, sql } from "drizzle-orm";

import type { Tx } from "@/lib/db/client";
import { documentCounter, stockLevel, stockMovement } from "@/lib/db/schema";
import type { AdjustmentReason, MovementKind } from "@/lib/db/schema";
import { StockError } from "@/lib/stock/errors";

export interface MovementInput {
  readonly branchId: string;
  readonly productId: number;
  /** Signed: positive into the branch, negative out. */
  readonly quantity: number;
  readonly kind: MovementKind;
  readonly adjustmentReason?: AdjustmentReason;
  readonly unitCost?: number;
  readonly receiptId?: number;
  readonly note?: string | null;
  readonly userId?: string | null;
}

export interface AppliedMovement {
  readonly movementId: number;
  readonly balanceAfter: number;
}

const changeBalance = async (
  tx: Tx,
  { branchId, productId, quantity }: MovementInput
): Promise<number | null> => {
  if (quantity > 0) {
    const [row] = await tx
      .insert(stockLevel)
      .values({ branchId, onHand: quantity, productId })
      .onConflictDoUpdate({
        set: { onHand: sql`${stockLevel.onHand} + ${quantity}` },
        target: [stockLevel.branchId, stockLevel.productId],
      })
      .returning({ onHand: stockLevel.onHand });

    return row?.onHand ?? null;
  }

  const [row] = await tx
    .update(stockLevel)
    .set({ onHand: sql`${stockLevel.onHand} + ${quantity}` })
    .where(
      and(
        eq(stockLevel.branchId, branchId),
        eq(stockLevel.productId, productId),
        sql`${stockLevel.onHand} + ${quantity} >= 0`
      )
    )
    .returning({ onHand: stockLevel.onHand });

  return row?.onHand ?? null;
};

export const applyMovement = async (
  tx: Tx,
  input: MovementInput
): Promise<AppliedMovement> => {
  if (!Number.isSafeInteger(input.quantity) || input.quantity === 0) {
    throw new StockError("invalid_input", "Quantity must be a whole number.");
  }

  const balanceAfter = await changeBalance(tx, input);

  if (balanceAfter === null) {
    throw new StockError(
      "insufficient_stock",
      `Only ${await currentOnHand(tx, input.branchId, input.productId)} in stock: can't take out ${-input.quantity}.`
    );
  }

  const [movement] = await tx
    .insert(stockMovement)
    .values({
      adjustmentReason: input.adjustmentReason,
      balanceAfter,
      branchId: input.branchId,
      kind: input.kind,
      note: input.note ?? null,
      productId: input.productId,
      quantity: input.quantity,
      receiptId: input.receiptId,
      unitCost: input.unitCost,
      userId: input.userId ?? null,
    })
    .returning({ id: stockMovement.id });

  if (movement === undefined) {
    throw new Error("Inserting a stock movement returned no row.");
  }

  return { balanceAfter, movementId: movement.id };
};

export const currentOnHand = async (
  tx: Tx,
  branchId: string,
  productId: number
): Promise<number> => {
  const [row] = await tx
    .select({ onHand: stockLevel.onHand })
    .from(stockLevel)
    .where(
      and(
        eq(stockLevel.branchId, branchId),
        eq(stockLevel.productId, productId)
      )
    );

  return row?.onHand ?? 0;
};

/** Locks this branch's row for the product (creating it at zero) and returns on_hand. */
export const lockOnHand = async (
  tx: Tx,
  branchId: string,
  productId: number
): Promise<number> => {
  await tx
    .insert(stockLevel)
    .values({ branchId, onHand: 0, productId })
    .onConflictDoNothing();

  const [row] = await tx
    .select({ onHand: stockLevel.onHand })
    .from(stockLevel)
    .where(
      and(
        eq(stockLevel.branchId, branchId),
        eq(stockLevel.productId, productId)
      )
    )
    .for("update");

  return row?.onHand ?? 0;
};

const DOCUMENT_NUMBER_DIGITS = 6;

/** Claims the next number for a document type at a branch: "GRN-SPX-000042". */
export const nextDocumentNumber = async (
  tx: Tx,
  prefix: string,
  branchId: string
): Promise<string> => {
  const [row] = await tx
    .insert(documentCounter)
    .values({ branchId, kind: prefix, lastNumber: 1 })
    .onConflictDoUpdate({
      set: { lastNumber: sql`${documentCounter.lastNumber} + 1` },
      target: [documentCounter.kind, documentCounter.branchId],
    })
    .returning({ lastNumber: documentCounter.lastNumber });

  if (row === undefined) {
    throw new Error("Claiming a document number returned no row.");
  }

  return `${prefix}-${branchId}-${String(row.lastNumber).padStart(DOCUMENT_NUMBER_DIGITS, "0")}`;
};
