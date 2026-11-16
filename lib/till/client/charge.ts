/**
 * Charging a sale, optimistically, across two collections at once: the sale
 * appears in the till's list and the shelf counts drop the moment the cashier
 * presses Charge. The server's answer then replaces both with what it
 * recorded; if it refuses, or can't be reached, both changes roll back.
 *
 * Batch 3 swaps this for an offline transaction with the same optimistic
 * step, so a sale charged without a connection is queued instead.
 */

import { createOptimisticAction } from "@tanstack/react-db";

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

/**
 * The online charge. Resolves with the server's answer once the sale is
 * recorded and the collections hold it; rejects with a `TillHttpError` after
 * rolling back.
 */
export const createChargeAction = (collections: TillCollections) => {
  const replies = new Map<string, TillSaleReply>();

  const charge = createOptimisticAction<ChargeInput>({
    mutationFn: async (input) => {
      const reply = await postCharge(input);
      await confirmCharge(collections, reply);
      replies.set(input.clientRef, reply);
    },
    onMutate: (input) => {
      applyCharge(collections, input);
    },
  });

  return async (input: ChargeInput): Promise<TillSaleReply> => {
    const transaction = charge(input);
    await transaction.when("settled");
    const reply = replies.get(input.clientRef);
    replies.delete(input.clientRef);

    if (reply === undefined) {
      throw new Error(`No answer was kept for sale ${input.clientRef}.`);
    }

    return reply;
  };
};
