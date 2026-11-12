"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import type { PaymentMethod } from "@/lib/db/schema";
import { requireViewer } from "@/lib/session";
import { StockError } from "@/lib/stock/errors";
import { recordSale } from "@/lib/stock/sales";
import type { SaleResult } from "@/lib/stock/sales";

export interface TillSaleInput {
  readonly branchId: string;
  readonly clientRef: string;
  readonly paymentMethod: PaymentMethod;
  readonly lines: readonly {
    readonly productId: number;
    readonly quantity: number;
  }[];
}

export type TillSaleState =
  | { readonly error: string; readonly sale: null }
  | { readonly error: null; readonly sale: SaleResult };

/**
 * Rings up a sale from the till screen. The till charges shelf prices, so any
 * price in the request is ignored; recordSale validates everything again.
 */
export const tillSaleAction = async (
  input: TillSaleInput
): Promise<TillSaleState> => {
  const viewer = await requireViewer();

  try {
    const recorded = await recordSale(getDb(), viewer, {
      branchId: input.branchId,
      clientRef: input.clientRef,
      lines: input.lines.map(({ productId, quantity }) => ({
        productId,
        quantity,
      })),
      paymentMethod: input.paymentMethod,
    });

    revalidatePath("/", "layout");

    return { error: null, sale: recorded };
  } catch (error) {
    if (!(error instanceof StockError)) {
      throw error;
    }

    return { error: error.message, sale: null };
  }
};
