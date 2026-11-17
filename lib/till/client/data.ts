/**
 * The till's data layer in the browser, one per signed-in person: a
 * QueryClient, the collections (eager ones for the till, an on-demand one for
 * the sales history), the needs-attention list and the offline queue. Built on first use and kept on `globalThis`, so React's double
 * renders and hot reloads reuse it instead of starting a second sync and a
 * second queue (which would lose the tab's lock on the outbox). Someone else
 * signing in on the same tab gets a fresh one, and the previous person's is
 * closed. Their queued sales stay in their own outbox for next time.
 */

import { QueryClient } from "@tanstack/query-core";

import { createAttentionCollection } from "@/lib/till/client/attention";
import type { AttentionCollection } from "@/lib/till/client/attention";
import { createTillCollections } from "@/lib/till/client/collections";
import type { TillCollections } from "@/lib/till/client/collections";
import { createHistoryCollection } from "@/lib/till/client/history";
import type { HistoryCollection } from "@/lib/till/client/history";
import { browserPlumbing, createTillSync } from "@/lib/till/client/sync";
import type { TillSync } from "@/lib/till/client/sync";

export interface TillData extends TillCollections {
  readonly userId: string;
  readonly queryClient: QueryClient;
  readonly attention: AttentionCollection;
  readonly history: HistoryCollection;
  readonly sync: TillSync;
}

// SAFETY: this optional slot is only ever written below, with this type.
const globalForTill = globalThis as typeof globalThis & {
  tallyTill?: TillData;
};

const release = async (data: TillData): Promise<void> => {
  data.sync.dispose();
  data.queryClient.clear();
  await Promise.all([
    data.products.cleanup(),
    data.stockLevels.cleanup(),
    data.sales.cleanup(),
    data.attention.cleanup(),
    data.history.cleanup(),
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
    // "offlineFirst": a request still goes out when the browser says it's
    // offline, so the service worker can answer from its saved copy
    // (public/till-sw.js); only retries wait for the connection.
    defaultOptions: { queries: { networkMode: "offlineFirst", retry: 2 } },
  });

  const collections = createTillCollections(queryClient);
  const attention = createAttentionCollection(userId);

  const sync = createTillSync({
    attention,
    collections,
    plumbing: async () => await browserPlumbing(userId),
  });

  const data: TillData = {
    ...collections,
    attention,
    history: createHistoryCollection(queryClient),
    queryClient,
    sync,
    userId,
  };

  globalForTill.tallyTill = data;
  // The status says if it fails; the till's "Try again" starts it again.
  sync.start().catch(() => null);

  return data;
};
