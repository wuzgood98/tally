/**
 * The till's outbox, seen from outside the till: its name, where it is
 * stored, and how many sales are waiting in it. Kept apart from the queue
 * itself so the app shell (which asks before signing out) doesn't bundle the
 * till's data layer.
 */

import {
  IndexedDBAdapter,
  LocalStorageAdapter,
  OutboxManager,
} from "@tanstack/offline-transactions";
import type { StorageAdapter } from "@tanstack/offline-transactions";

/** The outbox's IndexedDB name and lock name: one per person, so a queue is never sent as someone else. */
export const outboxName = (userId: string): string =>
  `tally-till-outbox-${userId}`;

/**
 * Where this person's outbox lives: IndexedDB, else localStorage, else
 * nowhere (the till then runs online-only, and nothing can be queued).
 */
export const outboxStorage = async (
  userId: string
): Promise<StorageAdapter | undefined> => {
  const name = outboxName(userId);

  const indexedDb = await IndexedDBAdapter.probe();

  if (indexedDb.available) {
    return new IndexedDBAdapter(name);
  }

  if (LocalStorageAdapter.probe().available) {
    return new LocalStorageAdapter(`${name}:`);
  }

  return undefined;
};

/**
 * Sales this person charged on this device that haven't reached Tally. Zero
 * when the browser keeps no storage (nothing could have been queued).
 */
export const countQueuedSales = async (userId: string): Promise<number> => {
  try {
    const storage = await outboxStorage(userId);

    // Counting needs no collections: it only reads the stored keys.
    return storage === undefined
      ? 0
      : await new OutboxManager(storage, {}).count();
  } catch {
    return 0;
  }
};
