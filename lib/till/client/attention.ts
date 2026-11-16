/**
 * Sales Tally refused after the till had already let the customer go. The
 * offline queue drops a refused sale (sending it again can't help), and
 * rolls its optimistic rows back, so without this list the record of goods
 * leaving the shop would vanish. Kept in this browser's localStorage, per
 * person, until someone on the till marks it handled.
 */

import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import type { StorageApi, StorageEventApi } from "@tanstack/react-db";

import { attentionSale } from "@/lib/till/schema";

export const ATTENTION_COLLECTION_ID = "till-attention";

/** Tests pass an in-memory storage; the browser uses localStorage. */
export interface AttentionStorage {
  readonly storage?: StorageApi;
  readonly storageEventApi?: StorageEventApi;
}

export const createAttentionCollection = (
  userId: string,
  options: AttentionStorage = {}
) =>
  createCollection(
    localStorageCollectionOptions({
      ...options,
      getKey: (item) => item.clientRef,
      id: ATTENTION_COLLECTION_ID,
      schema: attentionSale,
      storageKey: `tally-till-attention-${userId}`,
    })
  );

export type AttentionCollection = ReturnType<typeof createAttentionCollection>;
