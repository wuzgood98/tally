/**
 * Customer returns against an earlier sale. A manager approves every one,
 * because a fake return is an easy way to hide stock walking out the door.
 *
 * Each returned line goes back into stock as a `sale_return` movement. If the
 * item can't be resold, a `damaged` adjustment takes it straight back out, so
 * the loss shows up with the other write-offs instead of vanishing.
 */

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db, Tx } from "@/lib/db/client";
import {
  returnDispositionEnum,
  sale,
  saleLine,
  saleReturn,
  saleReturnLine,
} from "@/lib/db/schema";
import { canApproveReturn } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import { applyMovement, nextDocumentNumber } from "@/lib/stock/ledger";

export const returnInput = z.object({
  lines: z
    .array(
      z.object({
        disposition: z.enum(returnDispositionEnum.enumValues),
        productId: z.int().positive(),
        quantity: z
          .int("Quantities are whole units.")
          .positive("Quantities must be at least 1."),
      })
    )
    .min(1, "Choose at least one item to return.")
    .refine(
      (lines) =>
        new Set(lines.map((line) => line.productId)).size === lines.length,
      "Each product can appear only once on a return."
    ),
  reason: z
    .string()
    .trim()
    .min(1, "Say why the customer is returning it.")
    .max(500),
  saleId: z.int().positive(),
});

export type ReturnRawInput = z.input<typeof returnInput>;

export interface ReturnResult {
  readonly id: number;
  readonly number: string;
  readonly refund: number;
}

interface Returnable {
  readonly unitPrice: number;
  /** Sold on this sale, minus everything already returned against it. */
  readonly remaining: number;
}

/** What can still be returned per product, read under the sale's row lock. */
const returnableLines = async (
  tx: Tx,
  saleId: number
): Promise<Map<number, Returnable>> => {
  const rows = await tx
    .select({
      productId: saleLine.productId,
      returned: sql<number>`coalesce((
        select sum(${saleReturnLine.quantity})
        from ${saleReturnLine}
        join ${saleReturn} on ${saleReturn.id} = ${saleReturnLine.returnId}
        where ${saleReturn.saleId} = ${saleLine.saleId}
          and ${saleReturnLine.productId} = ${saleLine.productId}
      ), 0)::int`,
      sold: saleLine.quantity,
      unitPrice: saleLine.unitPrice,
    })
    .from(saleLine)
    .where(eq(saleLine.saleId, saleId));

  return new Map(
    rows.map((row) => [
      row.productId,
      { remaining: row.sold - row.returned, unitPrice: row.unitPrice },
    ])
  );
};

export const returnSale = async (
  db: Db,
  actor: Actor,
  rawInput: ReturnRawInput
): Promise<ReturnResult> => {
  const parsed = returnInput.safeParse(rawInput);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check the return."
    );
  }

  const input = parsed.data;

  const [original] = await db
    .select({ branchId: sale.branchId })
    .from(sale)
    .where(eq(sale.id, input.saleId));

  if (original === undefined) {
    throw new StockError("not_found", "That sale doesn't exist.");
  }

  if (!canApproveReturn(actor, original.branchId)) {
    throw new StockError(
      "forbidden",
      "Only a manager at this branch can approve a return."
    );
  }

  // Lock rows in a fixed order so concurrent returns and sales can't deadlock.
  const lines = input.lines.toSorted((a, b) => a.productId - b.productId);

  return await db.transaction(async (tx) => {
    // Two returns against one sale take turns, so together they can't exceed it.
    await tx
      .select({ id: sale.id })
      .from(sale)
      .where(eq(sale.id, input.saleId))
      .for("update");

    const returnable = await returnableLines(tx, input.saleId);
    let refund = 0;

    for (const line of lines) {
      const sold = returnable.get(line.productId);

      if (sold === undefined) {
        throw new StockError(
          "invalid_input",
          "An item being returned isn't on that sale."
        );
      }

      if (line.quantity > sold.remaining) {
        throw new StockError(
          "invalid_input",
          sold.remaining === 0
            ? "That item has already been returned in full."
            : `Only ${sold.remaining} of that item can still be returned.`
        );
      }

      refund += line.quantity * sold.unitPrice;
    }

    const number = await nextDocumentNumber(tx, "RET", original.branchId);

    const [header] = await tx
      .insert(saleReturn)
      .values({
        approvedById: actor.id,
        branchId: original.branchId,
        number,
        reason: input.reason,
        refund,
        saleId: input.saleId,
      })
      .returning({ id: saleReturn.id });

    if (header === undefined) {
      throw new Error("Inserting a sale return returned no row.");
    }

    // One transaction runs on one connection, in product order (see above).
    /* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- see above */
    for (const line of lines) {
      await applyMovement(tx, {
        branchId: original.branchId,
        kind: "sale_return",
        note: input.reason,
        productId: line.productId,
        quantity: line.quantity,
        saleReturnId: header.id,
        userId: actor.id,
      });

      if (line.disposition === "damaged") {
        // Only cancels the units just put back, so it may go wherever the
        // balance was before the return, including below zero.
        await applyMovement(tx, {
          adjustmentReason: "damaged",
          allowNegative: true,
          branchId: original.branchId,
          kind: "adjustment",
          note: `Returned damaged on ${number}`,
          productId: line.productId,
          quantity: -line.quantity,
          saleReturnId: header.id,
          userId: actor.id,
        });
      }
    }
    /* oxlint-enable no-await-in-loop, react-doctor/async-await-in-loop */

    await tx
      .insert(saleReturnLine)
      .values(lines.map((line) => ({ ...line, returnId: header.id })));

    return { id: header.id, number, refund };
  });
};
