"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
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
    revalidatePath("/", "layout");
    redirect(`/requests/${result.id}?requested=1`);
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
    revalidatePath("/", "layout");
    redirect(`/transfers/${result.transferId ?? ""}?sent=1`);
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
    revalidatePath("/", "layout");
    redirect(`/requests/${result.id}?cancelled=1`);
  }

  return { error };
};
