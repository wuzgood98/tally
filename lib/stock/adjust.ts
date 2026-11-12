/**
 * Stock adjustments: everything that changes stock other than a delivery.
 * Write-offs (damaged, expired, theft, internal use) take stock out, "found"
 * puts it back, and a count correction sets the balance to what was counted
 * on the shelf.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/lib/db/client";
import { branch, product } from "@/lib/db/schema";
import type { AdjustmentReason } from "@/lib/db/schema";
import { canAdjust } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import { applyMovement, lockOnHand } from "@/lib/stock/ledger";
import {
  ADJUSTMENT_REASONS,
  NOTE_REQUIRED,
  REASON_DIRECTION,
  REASON_LABELS,
} from "@/lib/stock/reasons";

const MAX_ADJUSTMENT = 100_000;

const base = {
  branchId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
  productId: z.int().positive(),
};

export const adjustmentInput = z.discriminatedUnion("mode", [
  z.object({
    ...base,
    mode: z.literal("change"),
    /** Units to take out or put back; the direction comes from the reason. */
    quantity: z
      .int("Quantities are whole units.")
      .positive("Enter how many units.")
      .max(MAX_ADJUSTMENT),
    reason: z.enum(ADJUSTMENT_REASONS).exclude(["count_correction"]),
  }),
  z.object({
    ...base,
    /** What is physically on the shelf; the change is worked out for you. */
    counted: z
      .int("Counts are whole units.")
      .nonnegative("A count can't be negative.")
      .max(MAX_ADJUSTMENT),
    mode: z.literal("count"),
  }),
]);

export type AdjustmentInput = z.infer<typeof adjustmentInput>;

export type AdjustmentRawInput = z.input<typeof adjustmentInput>;

export interface AdjustmentResult {
  readonly movementId: number;
  readonly productId: number;
  /** Signed change applied. */
  readonly quantity: number;
  readonly balanceAfter: number;
}

const reasonOf = (input: AdjustmentInput): AdjustmentReason =>
  input.mode === "count" ? "count_correction" : input.reason;

const assertReferencesExist = async (
  db: Db,
  input: AdjustmentInput
): Promise<void> => {
  const [[branchRow], [productRow]] = await Promise.all([
    db
      .select({ id: branch.id })
      .from(branch)
      .where(eq(branch.id, input.branchId)),
    db
      .select({ id: product.id })
      .from(product)
      .where(eq(product.id, input.productId)),
  ]);

  if (branchRow === undefined) {
    throw new StockError("not_found", "That branch doesn't exist.");
  }

  if (productRow === undefined) {
    throw new StockError("not_found", "That product doesn't exist.");
  }
};

export const adjustStock = async (
  db: Db,
  actor: Actor,
  rawInput: AdjustmentRawInput
): Promise<AdjustmentResult> => {
  const parsed = adjustmentInput.safeParse(rawInput);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check the adjustment."
    );
  }

  const input = parsed.data;
  const reason = reasonOf(input);

  if (!canAdjust(actor, input.branchId, reason)) {
    const atOwnBranch = actor.branchId === input.branchId;
    throw new StockError(
      "forbidden",
      atOwnBranch
        ? `Only a manager can record "${REASON_LABELS[reason]}" adjustments.`
        : "You can't adjust stock at this branch."
    );
  }

  if (NOTE_REQUIRED.has(reason) && (input.note ?? "") === "") {
    throw new StockError(
      "invalid_input",
      `Add a note explaining the ${REASON_LABELS[reason].toLowerCase()} adjustment.`
    );
  }

  await assertReferencesExist(db, input);

  return await db.transaction(async (tx) => {
    let quantity: number;

    if (input.mode === "count") {
      const onHand = await lockOnHand(tx, input.branchId, input.productId);
      quantity = input.counted - onHand;

      if (quantity === 0) {
        throw new StockError(
          "no_change",
          `The count matches the system (${onHand}): nothing to adjust.`
        );
      }
    } else {
      quantity =
        REASON_DIRECTION[input.reason] === "out"
          ? -input.quantity
          : input.quantity;
    }

    const applied = await applyMovement(tx, {
      adjustmentReason: reason,
      branchId: input.branchId,
      kind: "adjustment",
      note: (input.note ?? "") || null,
      productId: input.productId,
      quantity,
      userId: actor.id,
    });

    return { ...applied, productId: input.productId, quantity };
  });
};
