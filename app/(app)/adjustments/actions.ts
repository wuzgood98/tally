"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { adjustStock } from "@/lib/stock/adjust";
import type { AdjustmentRawInput } from "@/lib/stock/adjust";
import { StockError } from "@/lib/stock/errors";

export interface AdjustState {
  readonly error: string | null;
}

/** Records an adjustment or count, then returns to the product. */
export const adjustAction = async (
  input: AdjustmentRawInput
): Promise<AdjustState> => {
  const viewer = await requireViewer();
  let productId: number | null = null;
  let error: string | null = null;

  try {
    ({ productId } = await adjustStock(getDb(), viewer, input));
  } catch (error_) {
    if (!(error_ instanceof StockError)) {
      throw error_;
    }

    ({ message: error } = error_);
  }

  if (productId !== null) {
    revalidatePath("/", "layout");
    redirect(`/products/${productId}?adjusted=1`);
  }

  return { error };
};
