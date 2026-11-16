/**
 * The pieces of a charge: the optimistic step across two collections (the
 * sale appears in the till's list and the shelf counts drop the moment the
 * cashier presses Charge), the request, and writing the server's answer in.
 * `lib/till/client/sync.ts` runs them through the offline queue.
 */

import type { TillCollections } from "@/lib/till/client/collections";
import { requestJson } from "@/lib/till/client/http";
import { chargeBody, draftSale } from "@/lib/till/draft";
import type { ChargeInput } from "@/lib/till/draft";
import { stockLevelKey, tillSaleReply } from "@/lib/till/schema";
import type { TillSaleReply } from "@/lib/till/schema";

/** The optimistic step, shared with the offline queue. Must stay synchronous. */
export const applyCharge = (
  { sales, stockLevels }: TillCollections,
  input: ChargeInput
): void => {
  sales.insert(draftSale(input, new Date()));

  for (const line of input.lines) {
    const key = stockLevelKey(input.branchId, line.productId);

    // A product never stocked at this store has no row to take from; the
    // server's answer adds it.
    if (stockLevels.has(key)) {
      stockLevels.update(key, (draft) => {
        draft.onHand -= line.quantity;
      });
    }
  }
};

/**
 * Writes the server's answer into the collections as synced data, so when the
 * optimistic changes drop away the confirmed ones are already underneath and
 * nothing flickers.
 */
export const confirmCharge = async (
  { sales, stockLevels }: TillCollections,
  reply: TillSaleReply
): Promise<void> => {
  await sales.utils.writeUpsert(reply.sale);

  if (reply.levels.length > 0) {
    await stockLevels.utils.writeUpsert(reply.levels);
  }
};

export const postCharge = async (input: ChargeInput): Promise<TillSaleReply> =>
  await requestJson("/api/till/sales", tillSaleReply, {
    body: JSON.stringify(chargeBody(input)),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
