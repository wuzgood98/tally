/**
 * Purchase orders: what a branch has asked a supplier for. A manager drafts
 * one for their branch (or head office does, for any branch); head office
 * approves it, which is when it counts as sent and the expected date is set
 * from the supplier's lead time. Deliveries received against it (see
 * `receiveGoods`) fill its lines. It ends received, closed short by head
 * office, or cancelled.
 *
 * Every status change is one conditional UPDATE on the current status, so two
 * people acting on the same order at once can't both succeed. It runs in a
 * transaction with the notifications it sends, so a lost race tells no one.
 */

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/lib/db/client";
import {
  branch,
  product,
  purchaseOrder,
  purchaseOrderLine,
  supplier,
} from "@/lib/db/schema";
import type { PurchaseOrderStatus } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/notify";
import {
  canApprovePurchaseOrder,
  canCancelDraftPurchaseOrder,
  canDraftPurchaseOrder,
} from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { StockError } from "@/lib/stock/errors";
import { nextDocumentNumber } from "@/lib/stock/ledger";

export const MAX_ORDER_LINES = 200;
export const MAX_ORDER_QUANTITY = 100_000;

const DAY_MS = 86_400_000;

const orderLines = z
  .array(
    z.object({
      productId: z.int().positive(),
      quantity: z
        .int("Quantities are whole units.")
        .positive("Quantities must be at least 1.")
        .max(MAX_ORDER_QUANTITY, "That quantity looks wrong: check it."),
      /** Agreed pesewas per unit. Left out, the product's average cost. */
      unitCost: z.int().nonnegative().optional(),
    })
  )
  .min(1, "Add at least one product.")
  .max(MAX_ORDER_LINES)
  .refine(
    (lines) =>
      new Set(lines.map((line) => line.productId)).size === lines.length,
    "Each product can appear only once on an order."
  );

const note = z.string().trim().max(500).optional();

export const draftOrderInput = z.object({
  branchId: z.string().min(1),
  lines: orderLines,
  note,
  supplierId: z.int().positive("Choose a supplier."),
});

export type DraftOrderRawInput = z.input<typeof draftOrderInput>;

export const updateOrderInput = z.object({
  lines: orderLines,
  note,
  purchaseOrderId: z.int().positive(),
});

export type UpdateOrderRawInput = z.input<typeof updateOrderInput>;

const reasonInput = z.object({
  note: z.string().trim().min(1, "Say why.").max(500),
  purchaseOrderId: z.int().positive(),
});

export type OrderReasonRawInput = z.input<typeof reasonInput>;

export interface OrderResult {
  readonly id: number;
  readonly number: string;
  readonly status: PurchaseOrderStatus;
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

type OrderLines = z.output<typeof orderLines>;

/** Lines with their agreed cost filled in; refuses discontinued products. */
const priceLines = async (db: Db, lines: OrderLines) => {
  const products = await db
    .select({
      active: product.active,
      averageCost: product.averageCost,
      id: product.id,
      name: product.name,
    })
    .from(product)
    .where(
      inArray(
        product.id,
        lines.map((line) => line.productId)
      )
    );

  if (products.length !== lines.length) {
    throw new StockError("not_found", "A product on this order doesn't exist.");
  }

  const inactive = products.find((row) => !row.active);

  if (inactive !== undefined) {
    throw new StockError(
      "invalid_input",
      `${inactive.name} is discontinued and can't be ordered.`
    );
  }

  const costs = new Map(products.map((row) => [row.id, row.averageCost]));

  return lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    unitCost: line.unitCost ?? costs.get(line.productId) ?? 0,
  }));
};

const totalOf = (
  lines: readonly { quantity: number; unitCost: number }[]
): number => {
  let total = 0;

  for (const line of lines) {
    total += line.quantity * line.unitCost;
  }

  return total;
};

export const draftPurchaseOrder = async (
  db: Db,
  actor: Actor,
  rawInput: DraftOrderRawInput
): Promise<OrderResult> => {
  const input = parse(draftOrderInput, rawInput, "Check the order.");

  if (!canDraftPurchaseOrder(actor, input.branchId)) {
    throw new StockError(
      "forbidden",
      "Only a manager at this branch, or head office, can order for it."
    );
  }

  const [[branchRow], [supplierRow]] = await Promise.all([
    db
      .select({ id: branch.id })
      .from(branch)
      .where(eq(branch.id, input.branchId)),
    db
      .select({ id: supplier.id })
      .from(supplier)
      .where(eq(supplier.id, input.supplierId)),
  ]);

  if (branchRow === undefined) {
    throw new StockError("not_found", "That branch doesn't exist.");
  }

  if (supplierRow === undefined) {
    throw new StockError("not_found", "That supplier doesn't exist.");
  }

  const lines = await priceLines(db, input.lines);

  return await db.transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, "PO", input.branchId);

    const [order] = await tx
      .insert(purchaseOrder)
      .values({
        branchId: input.branchId,
        createdById: actor.id,
        note: textOrNull(input.note),
        number,
        supplierId: input.supplierId,
        totalCost: totalOf(lines),
      })
      .returning({ id: purchaseOrder.id });

    if (order === undefined) {
      throw new Error("Inserting a purchase order returned no row.");
    }

    await tx
      .insert(purchaseOrderLine)
      .values(lines.map((line) => ({ ...line, purchaseOrderId: order.id })));

    await notify(tx, actor, {
      branchId: input.branchId,
      kind: "po_drafted",
      purchaseOrderId: order.id,
    });

    return { id: order.id, number, status: "draft" };
  });
};

interface LoadedOrder {
  readonly id: number;
  readonly number: string;
  readonly branchId: string;
  readonly status: PurchaseOrderStatus;
  readonly leadTimeDays: number;
}

const loadOrder = async (db: Db, id: number): Promise<LoadedOrder> => {
  const [row] = await db
    .select({
      branchId: purchaseOrder.branchId,
      id: purchaseOrder.id,
      leadTimeDays: supplier.leadTimeDays,
      number: purchaseOrder.number,
      status: purchaseOrder.status,
    })
    .from(purchaseOrder)
    .innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
    .where(eq(purchaseOrder.id, id));

  if (row === undefined) {
    throw new StockError("not_found", "That purchase order doesn't exist.");
  }

  return row;
};

const STATUS_PHRASES: Record<PurchaseOrderStatus, string> = {
  approved: "has already been approved",
  cancelled: "was cancelled",
  closed: "was closed",
  draft: "is still a draft",
  partly_received: "has deliveries against it",
  received: "has been received in full",
};

/** Refuses with a message for the user when the order isn't in `allowed`. */
const assertStatus = (
  order: LoadedOrder,
  allowed: readonly PurchaseOrderStatus[]
): void => {
  if (!allowed.includes(order.status)) {
    throw new StockError(
      "conflict",
      `${order.number} ${STATUS_PHRASES[order.status]}.`
    );
  }
};

/**
 * Moves the order from one of `from` to `to` in a single conditional UPDATE.
 * If someone else changed it first, says what it is now.
 */
const transition = async (
  db: Db,
  order: LoadedOrder,
  from: readonly PurchaseOrderStatus[],
  to: PurchaseOrderStatus,
  fields: Partial<typeof purchaseOrder.$inferInsert>
): Promise<void> => {
  const moved = await db
    .update(purchaseOrder)
    .set({ ...fields, status: to })
    .where(
      and(
        eq(purchaseOrder.id, order.id),
        inArray(purchaseOrder.status, [...from])
      )
    )
    .returning({ id: purchaseOrder.id });

  if (moved.length === 0) {
    assertStatus(await loadOrder(db, order.id), from);
    throw new Error("A purchase order could not be moved on.");
  }
};

const orderEvent = (
  order: LoadedOrder,
  kind: "po_approved" | "po_cancelled" | "po_closed"
) => ({ branchId: order.branchId, kind, purchaseOrderId: order.id });

/** Replaces a draft's lines and note. Approved orders can't change. */
export const updatePurchaseOrder = async (
  db: Db,
  actor: Actor,
  rawInput: UpdateOrderRawInput
): Promise<OrderResult> => {
  const input = parse(updateOrderInput, rawInput, "Check the order.");
  const order = await loadOrder(db, input.purchaseOrderId);

  if (!canDraftPurchaseOrder(actor, order.branchId)) {
    throw new StockError(
      "forbidden",
      "You can't change orders for this branch."
    );
  }

  assertStatus(order, ["draft"]);
  const lines = await priceLines(db, input.lines);

  await db.transaction(async (tx) => {
    // Locks the draft, so an approval can't slip in halfway through.
    const [locked] = await tx
      .select({ status: purchaseOrder.status })
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, order.id))
      .for("update");

    if (locked?.status !== "draft") {
      throw new StockError("conflict", `${order.number} is no longer a draft.`);
    }

    await tx
      .delete(purchaseOrderLine)
      .where(eq(purchaseOrderLine.purchaseOrderId, order.id));
    await tx
      .insert(purchaseOrderLine)
      .values(lines.map((line) => ({ ...line, purchaseOrderId: order.id })));
    await tx
      .update(purchaseOrder)
      .set({ note: textOrNull(input.note), totalCost: totalOf(lines) })
      .where(eq(purchaseOrder.id, order.id));
  });

  return { id: order.id, number: order.number, status: "draft" };
};

export const approvePurchaseOrder = async (
  db: Db,
  actor: Actor,
  purchaseOrderId: number,
  now = new Date()
): Promise<OrderResult> => {
  if (!canApprovePurchaseOrder(actor)) {
    throw new StockError(
      "forbidden",
      "Only head office can approve purchase orders."
    );
  }

  const order = await loadOrder(db, purchaseOrderId);
  assertStatus(order, ["draft"]);

  await db.transaction(async (tx) => {
    await transition(tx, order, ["draft"], "approved", {
      approvedAt: now,
      approvedById: actor.id,
      expectedAt: new Date(now.getTime() + order.leadTimeDays * DAY_MS),
    });
    await notify(tx, actor, orderEvent(order, "po_approved"));
  });

  return { id: order.id, number: order.number, status: "approved" };
};

/**
 * Drops an order nothing has been delivered against. A draft is the
 * branch's to drop; once approved, the supplier has it, so head office decides.
 */
export const cancelPurchaseOrder = async (
  db: Db,
  actor: Actor,
  rawInput: OrderReasonRawInput
): Promise<OrderResult> => {
  const input = parse(reasonInput, rawInput, "Say why it's being cancelled.");
  const order = await loadOrder(db, input.purchaseOrderId);

  const allowed =
    order.status === "draft"
      ? canCancelDraftPurchaseOrder(actor, order.branchId)
      : canApprovePurchaseOrder(actor);

  if (!allowed) {
    throw new StockError(
      "forbidden",
      order.status === "draft"
        ? "You can't cancel orders for this branch."
        : "Only head office can cancel an approved order."
    );
  }

  assertStatus(order, ["draft", "approved"]);

  await db.transaction(async (tx) => {
    await transition(tx, order, ["draft", "approved"], "cancelled", {
      closedAt: new Date(),
      closedById: actor.id,
      closeNote: input.note,
    });
    await notify(tx, actor, orderEvent(order, "po_cancelled"));
  });

  return { id: order.id, number: order.number, status: "cancelled" };
};

/** Stops waiting for the rest of a part-delivered order. Head office only. */
export const closePurchaseOrder = async (
  db: Db,
  actor: Actor,
  rawInput: OrderReasonRawInput
): Promise<OrderResult> => {
  const input = parse(reasonInput, rawInput, "Say why it's being closed.");

  if (!canApprovePurchaseOrder(actor)) {
    throw new StockError(
      "forbidden",
      "Only head office can close a purchase order short."
    );
  }

  const order = await loadOrder(db, input.purchaseOrderId);
  assertStatus(order, ["partly_received"]);

  await db.transaction(async (tx) => {
    await transition(tx, order, ["partly_received"], "closed", {
      closedAt: new Date(),
      closedById: actor.id,
      closeNote: input.note,
    });
    await notify(tx, actor, orderEvent(order, "po_closed"));
  });

  return { id: order.id, number: order.number, status: "closed" };
};
