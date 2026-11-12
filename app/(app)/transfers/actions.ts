"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";
import { dispatchTransfer } from "@/lib/stock/transfer";
import type { DispatchRawInput } from "@/lib/stock/transfer";

export interface TransferActionState {
  readonly error: string | null;
}

/**
 * Sends stock to another branch, then opens the new transfer.
 * dispatchTransfer validates the input again, so a hand-crafted request gets
 * no further than the form would.
 */
export const dispatchAction = async (
  input: DispatchRawInput
): Promise<TransferActionState> => {
  const viewer = await requireViewer();
  let transferId: number | null = null;
  let error: string | null = null;

  try {
    ({ id: transferId } = await dispatchTransfer(getDb(), viewer, input));
  } catch (error_) {
    if (!(error_ instanceof StockError)) {
      throw error_;
    }

    ({ message: error } = error_);
  }

  if (transferId !== null) {
    revalidatePath("/", "layout");
    redirect(`/transfers/${transferId}?sent=1`);
  }

  return { error };
};
