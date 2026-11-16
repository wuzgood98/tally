/**
 * The till's data layer in the browser, one per signed-in person: a
 * QueryClient, the collections and the charge action. Built on first use and
 * kept on `globalThis`, so React's double renders and hot reloads reuse it
 * instead of starting a second sync. Someone else signing in on the same tab
 * gets a fresh one, and the previous person's is cleaned up.
 */

import { QueryClient } from "@tanstack/query-core";

import { createChargeAction } from "@/lib/till/client/charge";
import { createTillCollections } from "@/lib/till/client/collections";
import type { TillCollections } from "@/lib/till/client/collections";

export interface TillData extends TillCollections {
  readonly userId: string;
  readonly queryClient: QueryClient;
  readonly charge: ReturnType<typeof createChargeAction>;
}

// SAFETY: this optional slot is only ever written below, with this type.
const globalForTill = globalThis as typeof globalThis & {
  tallyTill?: TillData;
};

const release = async (data: TillData): Promise<void> => {
  data.queryClient.clear();
  await Promise.all([
    data.products.cleanup(),
    data.stockLevels.cleanup(),
    data.sales.cleanup(),
  ]);
};

export const getTillData = (userId: string): TillData => {
  const current = globalForTill.tallyTill;

  if (current?.userId === userId) {
    return current;
  }

  if (current !== undefined) {
    // Nothing waits on the previous person's data being gone.
    release(current).catch(() => null);
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 2 } },
  });

  const collections = createTillCollections(queryClient);

  const data: TillData = {
    ...collections,
    charge: createChargeAction(collections),
    queryClient,
    userId,
  };

  globalForTill.tallyTill = data;

  return data;
};
