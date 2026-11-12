"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import type { Actor } from "@/lib/permissions";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  draftPurchaseOrder,
  updatePurchaseOrder,
} from "@/lib/stock/purchase-orders";
import type {
  DraftOrderRawInput,
  OrderReasonRawInput,
  UpdateOrderRawInput,
} from "@/lib/stock/purchase-orders";

export interface OrderActionState {
  readonly error: string | null;
}

type Notice = "saved" | "approved" | "cancelled" | "closed";

/**
 * Runs one purchase order step for the signed-in person, then opens the
 * order with a notice. The domain functions check permission and input again.
 */
const runStep = async (
  step: (db: Db, actor: Actor) => Promise<{ readonly id: number }>,
  notice: Notice
): Promise<OrderActionState> => {
  const viewer = await requireViewer();
  let orderId: number | null = null;
  let error: string | null = null;

  try {
    ({ id: orderId } = await step(getDb(), viewer));
  } catch (error_) {
    if (!(error_ instanceof StockError)) {
      throw error_;
    }

    ({ message: error } = error_);
  }

  if (orderId !== null) {
    revalidatePath("/", "layout");
    redirect(`/purchase-orders/${orderId}?${notice}=1`);
  }

  return { error };
};

export const draftOrderAction = async (
  input: DraftOrderRawInput
): Promise<OrderActionState> =>
  await runStep(
    async (db, actor) => await draftPurchaseOrder(db, actor, input),
    "saved"
  );

export const updateOrderAction = async (
  input: UpdateOrderRawInput
): Promise<OrderActionState> =>
  await runStep(
    async (db, actor) => await updatePurchaseOrder(db, actor, input),
    "saved"
  );

export const approveOrderAction = async (
  purchaseOrderId: number
): Promise<OrderActionState> =>
  await runStep(
    async (db, actor) => await approvePurchaseOrder(db, actor, purchaseOrderId),
    "approved"
  );

export const cancelOrderAction = async (
  input: OrderReasonRawInput
): Promise<OrderActionState> =>
  await runStep(
    async (db, actor) => await cancelPurchaseOrder(db, actor, input),
    "cancelled"
  );

export const closeOrderAction = async (
  input: OrderReasonRawInput
): Promise<OrderActionState> =>
  await runStep(
    async (db, actor) => await closePurchaseOrder(db, actor, input),
    "closed"
  );
