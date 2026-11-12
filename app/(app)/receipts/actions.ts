"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";
import { receiveGoods } from "@/lib/stock/receive";
import type { ReceiptRawInput } from "@/lib/stock/receive";

export interface ReceiveState {
  readonly error: string | null;
}

/**
 * Records a delivery, then opens the new receipt. receiveGoods validates the
 * input again, so a hand-crafted request gets no further than the form would.
 */
export const receiveAction = async (
  input: ReceiptRawInput
): Promise<ReceiveState> => {
  const viewer = await requireViewer();
  let receiptId: number | null = null;
  let error: string | null = null;

  try {
    ({ id: receiptId } = await receiveGoods(getDb(), viewer, input));
  } catch (error_) {
    if (!(error_ instanceof StockError)) {
      throw error_;
    }

    ({ message: error } = error_);
  }

  if (receiptId !== null) {
    revalidatePath("/", "layout");
    redirect(`/receipts/${receiptId}?saved=1`);
  }

  return { error };
};
