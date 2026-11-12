"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";
import { returnSale } from "@/lib/stock/returns";
import type { ReturnRawInput } from "@/lib/stock/returns";

/**
 * Records a manager-approved return, then reopens the sale with a notice.
 * returnSale checks the approver and every quantity again.
 */
export const returnSaleAction = async (
  input: ReturnRawInput
): Promise<{ readonly error: string | null }> => {
  const viewer = await requireViewer();
  let returnId: number | null = null;
  let error: string | null = null;

  try {
    ({ id: returnId } = await returnSale(getDb(), viewer, input));
  } catch (error_) {
    if (!(error_ instanceof StockError)) {
      throw error_;
    }

    ({ message: error } = error_);
  }

  if (returnId !== null) {
    revalidatePath("/", "layout");
    redirect(`/sales/${input.saleId}?returned=${returnId}`);
  }

  return { error };
};
