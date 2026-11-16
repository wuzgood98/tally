/**
 * What the till sends when it charges a sale, and the row it shows straight
 * away while the server records it. Pure, so it can be tested and so the
 * offline queue can rebuild the request after a reload.
 */

import type { PaymentMethod } from "@/lib/db/schema";
import type { TillSale, TillSaleBody } from "@/lib/till/schema";

export interface ChargeInput {
  readonly branchId: string;
  readonly cashierId: string;
  /** The till's id for the sale; reused on a retry so it can't be charged twice. */
  readonly clientRef: string;
  readonly paymentMethod: PaymentMethod;
  readonly lines: readonly {
    readonly productId: number;
    readonly quantity: number;
  }[];
  /** Pesewas, at the shelf prices the till knows. */
  readonly expectedTotal: number;
}

/**
 * The sale as the till shows it before the server answers: no id or number
 * yet, and the till's own total, which the server may correct.
 */
export const draftSale = (input: ChargeInput, now: Date): TillSale => ({
  branchId: input.branchId,
  clientRef: input.clientRef,
  createdAt: now.toISOString(),
  expectedTotal: input.expectedTotal,
  id: null,
  number: null,
  paymentMethod: input.paymentMethod,
  total: input.expectedTotal,
  units: input.lines.reduce((sum, line) => sum + line.quantity, 0),
});

export const chargeBody = (input: ChargeInput): TillSaleBody => ({
  branchId: input.branchId,
  cashierId: input.cashierId,
  clientRef: input.clientRef,
  expectedTotal: input.expectedTotal,
  lines: input.lines.map(({ productId, quantity }) => ({
    productId,
    quantity,
  })),
  paymentMethod: input.paymentMethod,
});
