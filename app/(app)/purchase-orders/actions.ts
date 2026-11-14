"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import type { FlashMessage } from "@/lib/flash";
import { flash } from "@/lib/flash-server";
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
  OrderResult,
  OrderReasonRawInput,
  UpdateOrderRawInput,
} from "@/lib/stock/purchase-orders";

export interface OrderActionState {
  readonly error: string | null;
}

type Notice = "saved" | "approved" | "cancelled" | "closed";

const NOTICES: Record<Notice, (order: OrderResult) => FlashMessage> = {
  approved: (order) => ({
    action: { href: `/purchase-orders/${order.id}/print`, label: "Print it" },
    description: "Print it or send it to the supplier.",
    title: `${order.number} approved`,
  }),
  cancelled: (order) => ({ title: `${order.number} cancelled` }),
  closed: (order) => ({
    description: "Nothing more is expected against it.",
    title: `${order.number} closed short`,
  }),
  saved: (order) => ({
    description: "Head office approves it before it goes out.",
    title: `${order.number} saved as a draft`,
  }),
};

/**
 * Runs one purchase order step for the signed-in person, then opens the
 * order with a toast. The domain functions check permission and input again.
 */
const runStep = async (
  step: (db: Db, actor: Actor) => Promise<OrderResult>,
  notice: Notice
): Promise<OrderActionState> => {
  const viewer = await requireViewer();
  let order: OrderResult | null = null;
  let error: string | null = null;

  try {
    order = await step(getDb(), viewer);
  } catch (error_) {
    if (!(error_ instanceof StockError)) {
      throw error_;
    }

    ({ message: error } = error_);
  }

  if (order !== null) {
    await flash(NOTICES[notice](order));
    revalidatePath("/", "layout");
    redirect(`/purchase-orders/${order.id}`);
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
