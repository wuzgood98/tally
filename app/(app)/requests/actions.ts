"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { flash } from "@/lib/flash-server";
import { getStockRequest } from "@/lib/queries/requests";
import { getTransfer } from "@/lib/queries/transfers";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";
import {
  cancelStockRequest,
  fulfilStockRequest,
  requestStock,
} from "@/lib/stock/requests";
import type {
  CancelRequestRawInput,
  FulfilRawInput,
  StockRequestRawInput,
} from "@/lib/stock/requests";
import { transferNotice } from "@/lib/transfer-notices";

export interface RequestActionState {
  readonly error: string | null;
}

/** Runs a step, turning a StockError into a message; anything else is a bug. */
const attempt = async <T>(
  step: () => Promise<T>
): Promise<{ readonly result: T | null; readonly error: string | null }> => {
  try {
    return { error: null, result: await step() };
  } catch (error) {
    if (!(error instanceof StockError)) {
      throw error;
    }

    return { error: error.message, result: null };
  }
};

export const requestStockAction = async (
  input: StockRequestRawInput
): Promise<RequestActionState> => {
  const viewer = await requireViewer();

  const { result, error } = await attempt(
    async () => await requestStock(getDb(), viewer, input)
  );

  if (result !== null) {
    const request = await getStockRequest(result.id);

    await flash({
      description:
        request === null ? undefined : `${request.warehouseName} has it now.`,
      title: `${result.number} sent`,
    });
    revalidatePath("/", "layout");
    redirect(`/requests/${result.id}`);
  }

  return { error };
};

/** Sends the stock, then opens the transfer it went out on. */
export const fulfilRequestAction = async (
  input: FulfilRawInput
): Promise<RequestActionState> => {
  const viewer = await requireViewer();

  const { result, error } = await attempt(
    async () => await fulfilStockRequest(getDb(), viewer, input)
  );

  if (result !== null) {
    const transfer =
      result.transferId === null ? null : await getTransfer(result.transferId);

    if (transfer !== null) {
      await flash(transferNotice("sent", transfer));
    }

    revalidatePath("/", "layout");
    redirect(`/transfers/${result.transferId ?? ""}`);
  }

  return { error };
};

export const cancelRequestAction = async (
  input: CancelRequestRawInput
): Promise<RequestActionState> => {
  const viewer = await requireViewer();

  const { result, error } = await attempt(
    async () => await cancelStockRequest(getDb(), viewer, input)
  );

  if (result !== null) {
    await flash({ title: `${result.number} cancelled` });
    revalidatePath("/", "layout");
    redirect(`/requests/${result.id}`);
  }

  return { error };
};
