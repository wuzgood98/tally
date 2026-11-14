"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { flash } from "@/lib/flash-server";
import { formatUnits } from "@/lib/format";
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
  let receipt: { id: number; number: string } | null = null;
  let error: string | null = null;

  try {
    receipt = await receiveGoods(getDb(), viewer, input);
  } catch (error_) {
    if (!(error_ instanceof StockError)) {
      throw error_;
    }

    ({ message: error } = error_);
  }

  if (receipt !== null) {
    // receiveGoods has checked the lines, so their quantities are whole units.
    const units = input.lines.reduce((sum, line) => sum + line.quantity, 0);

    await flash({
      action: { href: "/receipts/new", label: "Receive another" },
      description: `${formatUnits(units)} added to stock.`,
      title: `${receipt.number} saved`,
    });
    revalidatePath("/", "layout");
    redirect(`/receipts/${receipt.id}`);
  }

  return { error };
};
