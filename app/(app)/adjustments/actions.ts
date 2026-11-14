"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { flash } from "@/lib/flash-server";
import { formatCount, formatSigned } from "@/lib/format";
import { requireViewer } from "@/lib/session";
import { adjustStock } from "@/lib/stock/adjust";
import type { AdjustmentRawInput, AdjustmentResult } from "@/lib/stock/adjust";
import { StockError } from "@/lib/stock/errors";

export interface AdjustState {
  readonly error: string | null;
}

/** Records an adjustment or count, then returns to the product. */
export const adjustAction = async (
  input: AdjustmentRawInput
): Promise<AdjustState> => {
  const viewer = await requireViewer();
  let applied: AdjustmentResult | null = null;
  let error: string | null = null;

  try {
    applied = await adjustStock(getDb(), viewer, input);
  } catch (error_) {
    if (!(error_ instanceof StockError)) {
      throw error_;
    }

    ({ message: error } = error_);
  }

  if (applied !== null) {
    await flash({
      description: `${formatSigned(applied.quantity)}, leaving ${formatCount(applied.balanceAfter)} on hand.`,
      title: "Adjustment saved",
    });
    revalidatePath("/", "layout");
    redirect(`/products/${applied.productId}`);
  }

  return { error };
};
