/**
 * Goods received notes (GRNs): stock arriving from a supplier at a branch.
 * One receipt, many lines; each line is a stock movement carrying its unit
 * cost, and updates the product's moving average cost.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db, Tx } from "@/lib/db/client";
import {
  branch,
  goodsReceipt,
  product,
  purchaseOrder,
  purchaseOrderLine,
  supplier,
} from "@/lib/db/schema";
import { canReceive } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import { companyUnitsHeld } from "@/lib/stock/holdings";
import { applyMovement, nextDocumentNumber } from "@/lib/stock/ledger";

/** One delivery rarely has more lines than this; it also bounds the work. */
export const MAX_RECEIPT_LINES = 200;

/** A sanity cap per line, so a barcode scanned into the quantity box is caught. */
export const MAX_LINE_QUANTITY = 100_000;

const receiptLine = z.object({
  productId: z.int().positive(),
  quantity: z
    .int("Quantities are whole units.")
    .positive("Quantities must be at least 1.")
    .max(MAX_LINE_QUANTITY, "That quantity looks wrong: check it."),
  /** Pesewas per unit. Zero is allowed for free samples and replacements. */
  unitCost: z.int().nonnegative(),
});

export const receiptInput = z.object({
  branchId: z.string().min(1),
  lines: z
    .array(receiptLine)
    .min(1, "Add at least one product.")
    .max(MAX_RECEIPT_LINES)
    .refine(
      (lines) =>
        new Set(lines.map((line) => line.productId)).size === lines.length,
      "Each product can appear only once on a receipt."
    ),
  note: z.string().trim().max(500).optional(),
  /** Set when the delivery is against a purchase order. */
  purchaseOrderId: z.int().positive().optional(),
  supplierId: z.int().positive(),
  supplierReference: z.string().trim().max(60).optional(),
});

export type ReceiptInput = z.infer<typeof receiptInput>;

export type ReceiptRawInput = z.input<typeof receiptInput>;

export interface ReceiptResult {
  readonly id: number;
  readonly number: string;
  readonly totalCost: number;
}

/**
 * New average = (units already held × old average + units received × their
 * cost) ÷ all units. Held stock is counted across every branch, because cost
 * is a company-wide figure.
 */
export const movingAverageCost = (
  heldUnits: number,
  averageCost: number,
  receivedUnits: number,
  unitCost: number
): number => {
  const totalUnits = Math.max(heldUnits, 0) + receivedUnits;

  if (totalUnits === 0) {
    return averageCost;
  }

  return Math.round(
    (Math.max(heldUnits, 0) * averageCost + receivedUnits * unitCost) /
      totalUnits
  );
};

const updateAverageCost = async (
  tx: Tx,
  productId: number,
  quantity: number,
  unitCost: number
): Promise<void> => {
  // Lock the product so two receipts of the same product average in turn.
  const [row] = await tx
    .select({ averageCost: product.averageCost })
    .from(product)
    .where(eq(product.id, productId))
    .for("update");

  if (row === undefined) {
    throw new StockError(
      "not_found",
      "A product on this receipt no longer exists."
    );
  }

  const heldUnits = await companyUnitsHeld(tx, productId);

  await tx
    .update(product)
    .set({
      averageCost: movingAverageCost(
        heldUnits,
        row.averageCost,
        quantity,
        unitCost
      ),
    })
    .where(eq(product.id, productId));
};

const assertReferencesExist = async (
  db: Db,
  input: ReceiptInput
): Promise<void> => {
  const productIds = input.lines.map((line) => line.productId);

  const [[branchRow], [supplierRow], products] = await Promise.all([
    db
      .select({ id: branch.id })
      .from(branch)
      .where(eq(branch.id, input.branchId)),
    db
      .select({ id: supplier.id })
      .from(supplier)
      .where(eq(supplier.id, input.supplierId)),
    db
      .select({ active: product.active, id: product.id, name: product.name })
      .from(product)
      .where(inArray(product.id, productIds)),
  ]);

  if (branchRow === undefined) {
    throw new StockError("not_found", "That branch doesn't exist.");
  }

  if (supplierRow === undefined) {
    throw new StockError("not_found", "That supplier doesn't exist.");
  }

  if (products.length !== productIds.length) {
    throw new StockError(
      "not_found",
      "A product on this receipt doesn't exist."
    );
  }

  const inactive = products.find((row) => !row.active);

  if (inactive) {
    throw new StockError(
      "invalid_input",
      `${inactive.name} is discontinued and can't be received.`
    );
  }
};

/**
 * Checks a delivery against its purchase order and adds it to the order's
 * lines, under a lock on the order. Refuses anything not ordered, or more than
 * is still outstanding: extras go on a separate receipt without an order.
 */
const fillPurchaseOrder = async (
  tx: Tx,
  purchaseOrderId: number,
  input: ReceiptInput
): Promise<void> => {
  const [order] = await tx
    .select({
      branchId: purchaseOrder.branchId,
      number: purchaseOrder.number,
      status: purchaseOrder.status,
      supplierId: purchaseOrder.supplierId,
    })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.id, purchaseOrderId))
    .for("update");

  if (order === undefined) {
    throw new StockError("not_found", "That purchase order doesn't exist.");
  }

  if (
    order.branchId !== input.branchId ||
    order.supplierId !== input.supplierId
  ) {
    throw new StockError(
      "invalid_input",
      `${order.number} is for a different branch or supplier.`
    );
  }

  if (order.status !== "approved" && order.status !== "partly_received") {
    throw new StockError(
      "conflict",
      `${order.number} isn't open for deliveries.`
    );
  }

  const ordered = await tx
    .select({
      productId: purchaseOrderLine.productId,
      quantity: purchaseOrderLine.quantity,
      quantityReceived: purchaseOrderLine.quantityReceived,
    })
    .from(purchaseOrderLine)
    .where(eq(purchaseOrderLine.purchaseOrderId, purchaseOrderId));

  const byProduct = new Map(ordered.map((line) => [line.productId, line]));

  for (const line of input.lines) {
    const orderLine = byProduct.get(line.productId);

    if (orderLine === undefined) {
      throw new StockError(
        "invalid_input",
        `A product on this delivery isn't on ${order.number}. Receive it on a separate receipt.`
      );
    }

    const outstanding = orderLine.quantity - orderLine.quantityReceived;

    if (line.quantity > outstanding) {
      throw new StockError(
        "invalid_input",
        `Only ${outstanding} of a product are still due on ${order.number}. Receive the extra on a separate receipt.`
      );
    }
  }

  // Sorted by product id, like every other multi-row write.
  /* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- see above */
  for (const line of input.lines.toSorted(
    (a, b) => a.productId - b.productId
  )) {
    await tx
      .update(purchaseOrderLine)
      .set({
        quantityReceived: sql`${purchaseOrderLine.quantityReceived} + ${line.quantity}`,
      })
      .where(
        and(
          eq(purchaseOrderLine.purchaseOrderId, purchaseOrderId),
          eq(purchaseOrderLine.productId, line.productId)
        )
      );
  }
  /* oxlint-enable no-await-in-loop, react-doctor/async-await-in-loop */

  const delivered = new Map(
    input.lines.map((line) => [line.productId, line.quantity])
  );

  const complete = ordered.every(
    (line) =>
      line.quantityReceived + (delivered.get(line.productId) ?? 0) >=
      line.quantity
  );

  await tx
    .update(purchaseOrder)
    .set(
      complete
        ? { closedAt: new Date(), status: "received" }
        : { status: "partly_received" }
    )
    .where(eq(purchaseOrder.id, purchaseOrderId));
};

export const receiveGoods = async (
  db: Db,
  actor: Actor,
  rawInput: ReceiptRawInput
): Promise<ReceiptResult> => {
  const parsed = receiptInput.safeParse(rawInput);

  if (!parsed.success) {
    throw new StockError(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "Check the receipt."
    );
  }

  const input = parsed.data;

  if (!canReceive(actor, input.branchId)) {
    throw new StockError(
      "forbidden",
      "You can't receive goods at this branch."
    );
  }

  await assertReferencesExist(db, input);

  const totalCost = input.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitCost,
    0
  );

  // Lock rows in a fixed order so concurrent receipts can't deadlock.
  const lines = input.lines.toSorted((a, b) => a.productId - b.productId);

  return await db.transaction(async (tx) => {
    // First, before any stock rows: two deliveries against one order take turns.
    if (input.purchaseOrderId !== undefined) {
      await fillPurchaseOrder(tx, input.purchaseOrderId, input);
    }

    const number = await nextDocumentNumber(tx, "GRN", input.branchId);

    const [receipt] = await tx
      .insert(goodsReceipt)
      .values({
        branchId: input.branchId,
        note: (input.note ?? "") || null,
        number,
        purchaseOrderId: input.purchaseOrderId ?? null,
        receivedById: actor.id,
        supplierId: input.supplierId,
        supplierReference: (input.supplierReference ?? "") || null,
        totalCost,
      })
      .returning({ id: goodsReceipt.id });

    if (receipt === undefined) {
      throw new Error("Inserting a goods receipt returned no row.");
    }

    // One transaction runs on one connection, and rows must lock in product
    // order (sorted above) so two receipts can never deadlock each other.
    /* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- see above */
    for (const line of lines) {
      await updateAverageCost(tx, line.productId, line.quantity, line.unitCost);
      await applyMovement(tx, {
        branchId: input.branchId,
        kind: "receipt",
        productId: line.productId,
        quantity: line.quantity,
        receiptId: receipt.id,
        unitCost: line.unitCost,
        userId: actor.id,
      });
    }
    /* oxlint-enable no-await-in-loop, react-doctor/async-await-in-loop */

    return { id: receipt.id, number, totalCost };
  });
};
