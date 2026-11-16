/**
 * The row the till shows straight away while the server records a sale. Pure,
 * so it can be tested and so the offline queue can rebuild it after a reload.
 */

import type { TillCharge, TillSale } from "@/lib/till/schema";

/**
 * The sale as the till shows it before the server answers: no id or number
 * yet, and the till's own total, which the server may correct.
 */
export const draftSale = (input: TillCharge, now: Date): TillSale => ({
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
