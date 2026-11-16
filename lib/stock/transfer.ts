/**
 * Transfers: stock moving from one branch to another, usually from the
 * warehouse to a store. A transfer happens in two steps:
 *
 * 1. Dispatch: the sending branch takes the stock out (a `transfer_out`
 *    movement per line). It is now in transit, on no branch's shelf.
 * 2. Receive: the receiving branch counts in what arrived (`transfer_in`).
 *    Anything short is lost in transit: it stays on the transfer's lines and
 *    is never added to either branch.
 *
 * A manager at the sending branch can cancel a transfer still in transit,
 * which puts the stock back where it came from.
 *
 * Transfers move stock at its average cost, so they never change it.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db, Tx } from "@/lib/db/client";
import {
  branch,
  product,
  stockTransfer,
  stockTransferLine,
} from "@/lib/db/schema";
import type { TransferStatus } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/notify";
import {
  canCancelTransfer,
  canDispatchTransfer,
  canReceiveTransfer,
} from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import { applyMovement, nextDocumentNumber } from "@/lib/stock/ledger";

export const MAX_TRANSFER_LINES = 200;

/** A sanity cap per line, so a barcode scanned into the quantity box is caught. */
export const MAX_TRANSFER_QUANTITY = 100_000;

const note = z.string().trim().max(500).optional();

const distinctProducts = (lines: readonly { productId: number }[]): boolean =>
  new Set(lines.map((line) => line.productId)).size === lines.length;

export const dispatchInput = z
  .object({
    fromBranchId: z.string().min(1),
    lines: z
      .array(
        z.object({
          productId: z.int().positive(),
          quantity: z
            .int("Quantities are whole units.")
            .positive("Quantities must be at least 1.")
            .max(MAX_TRANSFER_QUANTITY, "That quantity looks wrong: check it."),
        })
      )
      .min(1, "Add at least one product.")
      .max(MAX_TRANSFER_LINES)
      .refine(
        distinctProducts,
        "Each product can appear only once on a transfer."
      ),
    note,
    toBranchId: z.string().min(1, "Choose the branch to send to."),
  })
  .refine((input) => input.fromBranchId !== input.toBranchId, {
    message: "A branch can't send stock to itself.",
  });

export type DispatchRawInput = z.input<typeof dispatchInput>;

export const receiveTransferInput = z.object({
  lines: z
    .array(
      z.object({
        productId: z.int().positive(),
        quantityReceived: z
          .int("Quantities are whole units.")
          .nonnegative("A quantity received can't be negative."),
      })
    )
    .min(1)
    .max(MAX_TRANSFER_LINES)
    .refine(distinctProducts, "Each product can appear only once."),
  note,
  transferId: z.int().positive(),
});

export type ReceiveTransferRawInput = z.input<typeof receiveTransferInput>;

export const cancelTransferInput = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Say why the transfer is being cancelled.")
    .max(500),
  transferId: z.int().positive(),
});

export type CancelTransferRawInput = z.input<typeof cancelTransferInput>;

export interface TransferResult {
  readonly id: number;
  readonly number: string;
  readonly status: TransferStatus;
}

export interface ReceiveTransferResult extends TransferResult {
  /** Units sent but not received, across all lines. */
  readonly unitsLost: number;
}

const parse = <S extends z.ZodType>(
  schema: S,
  raw: z.input<S>,
  fallback: string
): z.output<S> => {
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? fallback
    );
  }

  return parsed.data;
};

const textOrNull = (value: string | undefined): string | null =>
  (value ?? "") === "" ? null : (value ?? null);

// ---------------------------------------------------------------------------
// Dispatch.
// ---------------------------------------------------------------------------

interface DispatchProduct {
  readonly averageCost: number;
  readonly name: string;
}

const loadDispatchReferences = async (
  db: Db,
  input: z.infer<typeof dispatchInput>
): Promise<Map<number, DispatchProduct>> => {
  const productIds = input.lines.map((line) => line.productId);

  const [branches, products] = await Promise.all([
    db
      .select({ id: branch.id })
      .from(branch)
      .where(inArray(branch.id, [input.fromBranchId, input.toBranchId])),
    db
      .select({
        active: product.active,
        averageCost: product.averageCost,
        id: product.id,
        name: product.name,
      })
      .from(product)
      .where(inArray(product.id, productIds)),
  ]);

  if (branches.length !== 2) {
    throw new StockError("not_found", "That branch doesn't exist.");
  }

  if (products.length !== productIds.length) {
    throw new StockError(
      "not_found",
      "A product on this transfer doesn't exist."
    );
  }

  const inactive = products.find((row) => !row.active);

  if (inactive !== undefined) {
    throw new StockError(
      "invalid_input",
      `${inactive.name} is discontinued and can't be transferred.`
    );
  }

  return new Map(products.map((row) => [row.id, row]));
};

export const dispatchTransfer = async (
  db: Db,
  actor: Actor,
  rawInput: DispatchRawInput
): Promise<TransferResult> => {
  const input = parse(dispatchInput, rawInput, "Check the transfer.");

  if (!canDispatchTransfer(actor, input.fromBranchId)) {
    throw new StockError("forbidden", "You can't send stock from this branch.");
  }

  const products = await loadDispatchReferences(db, input);

  // Cost is snapshotted at dispatch: it values the goods while in transit.
  const lines = input.lines
    .map((line) => ({
      ...line,
      name: products.get(line.productId)?.name ?? "",
      unitCost: products.get(line.productId)?.averageCost ?? 0,
    }))
    .toSorted((a, b) => a.productId - b.productId);

  const totalCost = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitCost,
    0
  );

  return await db.transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, "TRF", input.fromBranchId);

    const [transfer] = await tx
      .insert(stockTransfer)
      .values({
        dispatchedById: actor.id,
        fromBranchId: input.fromBranchId,
        note: textOrNull(input.note),
        number,
        toBranchId: input.toBranchId,
        totalCost,
      })
      .returning({ id: stockTransfer.id });

    if (transfer === undefined) {
      throw new Error("Inserting a stock transfer returned no row.");
    }

    // One transaction runs on one connection, and rows must lock in product
    // order (sorted above) so two transactions can never deadlock each other.
    /* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- see above */
    for (const line of lines) {
      try {
        await applyMovement(tx, {
          branchId: input.fromBranchId,
          kind: "transfer_out",
          productId: line.productId,
          quantity: -line.quantity,
          transferId: transfer.id,
          unitCost: line.unitCost,
          userId: actor.id,
        });
      } catch (error) {
        // applyMovement's message can't name the product; a transfer has many.
        if (
          error instanceof StockError &&
          error.code === "insufficient_stock"
        ) {
          throw new StockError(
            "insufficient_stock",
            `${line.name}: ${error.message}`
          );
        }

        throw error;
      }
    }
    /* oxlint-enable no-await-in-loop, react-doctor/async-await-in-loop */

    await tx.insert(stockTransferLine).values(
      lines.map((line) => ({
        productId: line.productId,
        quantitySent: line.quantity,
        transferId: transfer.id,
        unitCost: line.unitCost,
      }))
    );

    await notify(tx, actor, {
      fromBranchId: input.fromBranchId,
      kind: "transfer_dispatched",
      toBranchId: input.toBranchId,
      transferId: transfer.id,
    });

    return { id: transfer.id, number, status: "in_transit" };
  });
};

// ---------------------------------------------------------------------------
// Receive and cancel.
// ---------------------------------------------------------------------------

interface LoadedTransfer {
  readonly id: number;
  readonly number: string;
  readonly fromBranchId: string;
  readonly toBranchId: string;
  readonly status: TransferStatus;
  readonly lines: readonly {
    readonly productId: number;
    readonly quantitySent: number;
    readonly unitCost: number;
  }[];
}

const loadTransfer = async (
  db: Db,
  transferId: number
): Promise<LoadedTransfer> => {
  const [header] = await db
    .select({
      fromBranchId: stockTransfer.fromBranchId,
      id: stockTransfer.id,
      number: stockTransfer.number,
      status: stockTransfer.status,
      toBranchId: stockTransfer.toBranchId,
    })
    .from(stockTransfer)
    .where(eq(stockTransfer.id, transferId));

  if (header === undefined) {
    throw new StockError("not_found", "That transfer doesn't exist.");
  }

  const lines = await db
    .select({
      productId: stockTransferLine.productId,
      quantitySent: stockTransferLine.quantitySent,
      unitCost: stockTransferLine.unitCost,
    })
    .from(stockTransferLine)
    .where(eq(stockTransferLine.transferId, transferId))
    .orderBy(stockTransferLine.productId);

  return { ...header, lines };
};

const SETTLED_MESSAGES: Record<
  Exclude<TransferStatus, "in_transit">,
  string
> = {
  cancelled: "This transfer was cancelled.",
  received: "This transfer has already been received.",
};

const assertInTransit = (status: TransferStatus): void => {
  if (status !== "in_transit") {
    throw new StockError("conflict", SETTLED_MESSAGES[status]);
  }
};

/**
 * Moves the transfer out of `in_transit` with a conditional UPDATE, so if two
 * people receive or cancel at once, only one of them gets the row.
 */
const claimTransfer = async (
  tx: Tx,
  transfer: LoadedTransfer,
  settle: {
    readonly status: Exclude<TransferStatus, "in_transit">;
    readonly by: string;
    readonly note: string | null;
  }
): Promise<void> => {
  const now = sql`now()`;

  const fields =
    settle.status === "received"
      ? { receivedAt: now, receivedById: settle.by }
      : { cancelledAt: now, cancelledById: settle.by };

  const claimed = await tx
    .update(stockTransfer)
    .set({ ...fields, receiveNote: settle.note, status: settle.status })
    .where(
      and(
        eq(stockTransfer.id, transfer.id),
        eq(stockTransfer.status, "in_transit")
      )
    )
    .returning({ id: stockTransfer.id });

  if (claimed.length === 0) {
    const [current] = await tx
      .select({ status: stockTransfer.status })
      .from(stockTransfer)
      .where(eq(stockTransfer.id, transfer.id));

    assertInTransit(current?.status ?? "cancelled");
    throw new Error("A transfer in transit could not be claimed.");
  }
};

/** Matches what was counted to what was sent, line by line. */
const receivedQuantities = (
  transfer: LoadedTransfer,
  lines: readonly { productId: number; quantityReceived: number }[]
): Map<number, number> => {
  const counted = new Map(
    lines.map((line) => [line.productId, line.quantityReceived])
  );

  if (
    counted.size !== transfer.lines.length ||
    transfer.lines.some((line) => !counted.has(line.productId))
  ) {
    throw new StockError(
      "invalid_input",
      "Count every product on the transfer, and nothing else."
    );
  }

  for (const line of transfer.lines) {
    if ((counted.get(line.productId) ?? 0) > line.quantitySent) {
      throw new StockError(
        "invalid_input",
        `More arrived than was sent (${line.quantitySent}). Receive what was sent, then record the extra as a "found" adjustment.`
      );
    }
  }

  return counted;
};

export const receiveTransfer = async (
  db: Db,
  actor: Actor,
  rawInput: ReceiveTransferRawInput
): Promise<ReceiveTransferResult> => {
  const input = parse(receiveTransferInput, rawInput, "Check the quantities.");
  const transfer = await loadTransfer(db, input.transferId);

  if (!canReceiveTransfer(actor, transfer.toBranchId)) {
    throw new StockError(
      "forbidden",
      "Only the receiving branch can receive this transfer."
    );
  }

  assertInTransit(transfer.status);

  const counted = receivedQuantities(transfer, input.lines);

  const unitsLost = transfer.lines.reduce(
    (sum, line) => sum + line.quantitySent - (counted.get(line.productId) ?? 0),
    0
  );

  const receiveNote = textOrNull(input.note);

  if (unitsLost > 0 && receiveNote === null) {
    throw new StockError(
      "invalid_input",
      "Some units are missing: add a note saying what happened."
    );
  }

  await db.transaction(async (tx) => {
    await claimTransfer(tx, transfer, {
      by: actor.id,
      note: receiveNote,
      status: "received",
    });

    // transfer.lines is sorted by product id, so rows lock in a fixed order.
    /* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- see above */
    for (const line of transfer.lines) {
      const quantityReceived = counted.get(line.productId) ?? 0;

      if (quantityReceived > 0) {
        await applyMovement(tx, {
          branchId: transfer.toBranchId,
          kind: "transfer_in",
          productId: line.productId,
          quantity: quantityReceived,
          transferId: transfer.id,
          unitCost: line.unitCost,
          userId: actor.id,
        });
      }

      await tx
        .update(stockTransferLine)
        .set({ quantityReceived })
        .where(
          and(
            eq(stockTransferLine.transferId, transfer.id),
            eq(stockTransferLine.productId, line.productId)
          )
        );
    }
    /* oxlint-enable no-await-in-loop, react-doctor/async-await-in-loop */

    if (unitsLost > 0) {
      await notify(tx, actor, {
        fromBranchId: transfer.fromBranchId,
        kind: "transfer_received_short",
        toBranchId: transfer.toBranchId,
        transferId: transfer.id,
        units: unitsLost,
      });
    }
  });

  return {
    id: transfer.id,
    number: transfer.number,
    status: "received",
    unitsLost,
  };
};

export const cancelTransfer = async (
  db: Db,
  actor: Actor,
  rawInput: CancelTransferRawInput
): Promise<TransferResult> => {
  const input = parse(cancelTransferInput, rawInput, "Check the cancellation.");
  const transfer = await loadTransfer(db, input.transferId);

  if (!canCancelTransfer(actor, transfer.fromBranchId)) {
    throw new StockError(
      "forbidden",
      "Only a manager at the sending branch can cancel a transfer."
    );
  }

  assertInTransit(transfer.status);

  await db.transaction(async (tx) => {
    await claimTransfer(tx, transfer, {
      by: actor.id,
      note: input.note,
      status: "cancelled",
    });

    // Sorted by product id (see loadTransfer), so rows lock in a fixed order.
    /* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- see above */
    for (const line of transfer.lines) {
      await applyMovement(tx, {
        branchId: transfer.fromBranchId,
        kind: "transfer_in",
        note: input.note,
        productId: line.productId,
        quantity: line.quantitySent,
        transferId: transfer.id,
        unitCost: line.unitCost,
        userId: actor.id,
      });
    }
    /* oxlint-enable no-await-in-loop, react-doctor/async-await-in-loop */

    await notify(tx, actor, {
      fromBranchId: transfer.fromBranchId,
      kind: "transfer_cancelled",
      toBranchId: transfer.toBranchId,
      transferId: transfer.id,
    });
  });

  return { id: transfer.id, number: transfer.number, status: "cancelled" };
};
