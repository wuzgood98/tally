"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import type { Actor } from "@/lib/permissions";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";
import {
  cancelTransfer,
  dispatchTransfer,
  receiveTransfer,
} from "@/lib/stock/transfer";
import type {
  CancelTransferRawInput,
  DispatchRawInput,
  ReceiveTransferRawInput,
} from "@/lib/stock/transfer";

export interface TransferActionState {
  readonly error: string | null;
}

/**
 * Runs one transfer step for the signed-in person, then opens the transfer
 * with a notice. The domain functions validate the input again, so a
 * hand-crafted request gets no further than the form would.
 */
const runStep = async (
  step: (db: Db, actor: Actor) => Promise<{ readonly id: number }>,
  notice: "sent" | "received" | "cancelled"
): Promise<TransferActionState> => {
  const viewer = await requireViewer();
  let transferId: number | null = null;
  let error: string | null = null;

  try {
    ({ id: transferId } = await step(getDb(), viewer));
  } catch (error_) {
    if (!(error_ instanceof StockError)) {
      throw error_;
    }

    ({ message: error } = error_);
  }

  if (transferId !== null) {
    revalidatePath("/", "layout");
    redirect(`/transfers/${transferId}?${notice}=1`);
  }

  return { error };
};

export const dispatchAction = async (
  input: DispatchRawInput
): Promise<TransferActionState> =>
  await runStep(
    async (db, actor) => await dispatchTransfer(db, actor, input),
    "sent"
  );

export const receiveTransferAction = async (
  input: ReceiveTransferRawInput
): Promise<TransferActionState> =>
  await runStep(
    async (db, actor) => await receiveTransfer(db, actor, input),
    "received"
  );

export const cancelTransferAction = async (
  input: CancelTransferRawInput
): Promise<TransferActionState> =>
  await runStep(
    async (db, actor) => await cancelTransfer(db, actor, input),
    "cancelled"
  );
