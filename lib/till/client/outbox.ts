/**
 * The till's outbox, seen from outside the till: its name, and how many
 * sales are waiting in it. Kept apart from the queue itself so the app shell
 * (which asks before signing out) doesn't bundle the till's data layer.
 */

import {
  IndexedDBAdapter,
  LocalStorageAdapter,
} from "@tanstack/offline-transactions";

/** The outbox's IndexedDB name and lock name: one per person, so a queue is never sent as someone else. */
export const outboxName = (userId: string): string =>
  `tally-till-outbox-${userId}`;

/** The queue stores each transaction under this prefix. */
const TRANSACTION_PREFIX = "tx:";

/**
 * Sales this person charged on this device that haven't reached Tally. Zero
 * when the browser keeps no storage (nothing could have been queued).
 */
export const countQueuedSales = async (userId: string): Promise<number> => {
  const name = outboxName(userId);

  try {
    const indexedDb = await IndexedDBAdapter.probe();

    const keys = indexedDb.available
      ? await new IndexedDBAdapter(name).keys()
      : await new LocalStorageAdapter(`${name}:`).keys();

    return keys.filter((key) => key.startsWith(TRANSACTION_PREFIX)).length;
  } catch {
    return 0;
  }
};
