/**
 * Charging through an offline queue (`@tanstack/offline-transactions`).
 *
 * A charge is an offline transaction: the same optimistic step as before
 * (the sale appears, the shelf counts drop), then the transaction is written
 * to an outbox in this browser (IndexedDB) and sent by whichever tab holds
 * the outbox's lock. If the connection is down it waits, and retries with
 * backoff; a reload replays the outbox and puts the optimistic rows back.
 * The server is idempotent by clientRef, which is also the queue's
 * idempotency key, so a sale sent twice is recorded once.
 *
 * What the cashier sees: if Tally answers within a few seconds the sale is
 * "recorded" with its number, as before. Otherwise it is "queued": saved on
 * this till, the basket clears, and the sale gets its number when it syncs.
 * A sale Tally refuses for good (`REFUSED_STATUSES` in `lib/http.ts`) while
 * the customer waits is an error on screen; after they've gone, it goes to the
 * needs-attention list instead of vanishing.
 */

import {
  BroadcastChannelLeader,
  NonRetriableError,
  startOfflineExecutor,
  WebLocksLeader,
} from "@tanstack/offline-transactions";
import type {
  LeaderElection,
  OfflineConfig,
  OfflineExecutor,
  OnlineDetector,
  StorageAdapter,
} from "@tanstack/offline-transactions";

import type { AttentionCollection } from "@/lib/till/client/attention";
import {
  applyCharge,
  confirmCharge,
  postCharge,
} from "@/lib/till/client/charge";
import { TILL_COLLECTION_IDS } from "@/lib/till/client/collections";
import type { TillCollections } from "@/lib/till/client/collections";
import { TillHttpError } from "@/lib/till/client/http";
import { createBrowserOnlineDetector } from "@/lib/till/client/online";
import { outboxName, outboxStorage } from "@/lib/till/client/outbox";
import { tillCharge } from "@/lib/till/schema";
import type { TillCharge, TillSaleReply } from "@/lib/till/schema";

export const RECORD_SALE = "recordSale";

/** What the queue hands a mutation function: the transaction, and its idempotency key. */
type QueuedSale = Parameters<OfflineConfig["mutationFns"][string]>[0];

/** How long the cashier waits for Tally before the sale counts as queued. */
export const ONLINE_GRACE_MS = 5000;
const QUEUE_POLL_MS = 50;
const STATUS_POLL_MS = 1000;

/** A sale Tally refused for good; the queue drops it. */
export class RefusedSaleError extends NonRetriableError {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RefusedSaleError";
    this.status = status;
  }
}

/** Where the outbox lives, how tabs agree who sends it, and how the connection is watched. Tests pass fakes. */
export interface SyncPlumbing {
  readonly storage?: StorageAdapter;
  readonly leaderElection?: LeaderElection;
  readonly onlineDetector?: OnlineDetector;
}

/**
 * The browser's: IndexedDB, else localStorage, else nothing (the executor
 * then runs online-only); a Web Lock, else a BroadcastChannel election, both
 * named per person; and `navigator.onLine` for the connection.
 */
export const browserPlumbing = async (
  userId: string
): Promise<SyncPlumbing> => {
  const name = outboxName(userId);
  let leaderElection: LeaderElection | undefined;

  if (WebLocksLeader.isSupported()) {
    leaderElection = new WebLocksLeader(name);
  } else if (BroadcastChannelLeader.isSupported()) {
    leaderElection = new BroadcastChannelLeader(name);
  }

  return {
    leaderElection,
    onlineDetector: createBrowserOnlineDetector(),
    storage: await outboxStorage(userId),
  };
};

export type ChargeOutcome =
  | { readonly kind: "recorded"; readonly reply: TillSaleReply }
  | { readonly kind: "queued" };

/** What the till shows about its queue. */
export interface SyncStatus {
  /** False until the outbox has been read back and its sales put on screen. */
  readonly ready: boolean;
  /** True when this tab keeps a queue; false in a second tab, or with no storage. */
  readonly canQueue: boolean;
  readonly online: boolean;
  /** Sales saved on this till that Tally hasn't recorded yet. */
  readonly queued: number;
  /** Why the oldest queued sale last failed to send, if it did. */
  readonly lastError: string | null;
  /** Set when the queue couldn't start at all. */
  readonly problem: string | null;
}

export const STARTING: SyncStatus = {
  canQueue: false,
  lastError: null,
  online: true,
  problem: null,
  queued: 0,
  ready: false,
};

const sleep = async (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<null>();
  setTimeout(() => {
    resolve(null);
  }, ms);
  await promise;
};

const sameStatus = (a: SyncStatus, b: SyncStatus): boolean =>
  a.ready === b.ready &&
  a.canQueue === b.canQueue &&
  a.online === b.online &&
  a.queued === b.queued &&
  a.lastError === b.lastError &&
  a.problem === b.problem;

interface TillSyncOptions {
  readonly collections: TillCollections;
  readonly attention: AttentionCollection;
  /** Called once, when the queue starts. */
  readonly plumbing: () => Promise<SyncPlumbing>;
  /** How long to wait for Tally while online before calling a sale queued. */
  readonly graceMs?: number;
}

export const createTillSync = ({
  collections,
  attention,
  plumbing,
  graceMs = ONLINE_GRACE_MS,
}: TillSyncOptions) => {
  /** Charges the customer is still waiting at the till for, so a refusal shows on screen instead. */
  const customerWaiting = new Set<string>();
  const replies = new Map<string, TillSaleReply>();
  const listeners = new Set<() => void>();
  let executor: OfflineExecutor | null = null;
  let starting: Promise<void> | null = null;
  let status = STARTING;
  let timer: ReturnType<typeof setInterval> | null = null;

  const publish = (next: SyncStatus): void => {
    if (sameStatus(status, next)) {
      return;
    }

    status = next;

    for (const listener of listeners) {
      listener();
    }
  };

  const refresh = async (): Promise<void> => {
    if (executor === null) {
      return;
    }

    const outbox = await executor.peekOutbox();
    const waiting = outbox.filter((item) => item.outboxPhase === undefined);

    publish({
      canQueue: executor.isOfflineEnabled,
      lastError:
        waiting.find((item) => item.lastError !== undefined)?.lastError
          ?.message ?? null,
      online: executor.isOnline(),
      problem: null,
      queued: waiting.length,
      ready: true,
    });
  };

  const refreshSoon = (): void => {
    refresh().catch(() => null);
  };

  const keepForAttention = async (
    input: TillCharge,
    reason: string
  ): Promise<void> => {
    if (attention.has(input.clientRef)) {
      return;
    }

    const names = new Map(
      collections.products.toArray.map((item) => [item.id, item.name])
    );

    const sale = collections.sales.get(input.clientRef);

    await attention
      .insert({
        branchId: input.branchId,
        chargedAt: sale?.createdAt ?? new Date().toISOString(),
        clientRef: input.clientRef,
        expectedTotal: input.expectedTotal,
        failedAt: new Date().toISOString(),
        lines: input.lines.map((line) => ({
          ...line,
          name:
            names.get(line.productId) ?? `Product ${String(line.productId)}`,
        })),
        paymentMethod: input.paymentMethod,
        reason,
      })
      .when("settled");
  };

  /**
   * Sends one queued sale. The charge comes from the transaction's metadata,
   * which survives a reload, and is parsed again since it comes back out of
   * the browser's storage.
   */
  const recordSale = async ({ transaction }: QueuedSale): Promise<void> => {
    const input = tillCharge.parse(transaction.metadata.charge);
    let reply: TillSaleReply;

    try {
      reply = await postCharge(input);
    } catch (error) {
      if (error instanceof TillHttpError && error.refused) {
        if (!customerWaiting.has(input.clientRef)) {
          await keepForAttention(input, error.message);
        }

        throw new RefusedSaleError(error.status, error.message);
      }

      // No connection, signed out (401), a server fault: try again later.
      throw error;
    } finally {
      refreshSoon();
    }

    await confirmCharge(collections, reply);
    replies.set(input.clientRef, reply);
  };

  const begin = async (): Promise<void> => {
    // Restoring queued sales updates rows in these collections, so they must
    // hold the server's data first.
    await Promise.all([
      collections.products.preload(),
      collections.stockLevels.preload(),
      collections.sales.preload(),
    ]);

    const started = startOfflineExecutor({
      ...(await plumbing()),
      collections: {
        [TILL_COLLECTION_IDS.products]: collections.products,
        [TILL_COLLECTION_IDS.sales]: collections.sales,
        [TILL_COLLECTION_IDS.stockLevels]: collections.stockLevels,
      },
      jitter: true,
      mutationFns: { [RECORD_SALE]: recordSale },
      onLeadershipChange: refreshSoon,
      onStorageFailure: refreshSoon,
      // Refusals throw RefusedSaleError, which never retries. Everything
      // else (no connection, an expired session, a server fault) is worth
      // another go: say so outright rather than leave it to the default
      // policy, which guesses from the message.
      shouldRetry: () => true,
    });

    await started.waitForInit();
    started.getOnlineDetector().subscribe(refreshSoon);
    executor = started;
    await refresh();
  };

  /** Starts the queue once the collections have loaded; safe to call again after a failure. */
  const start = async (): Promise<void> => {
    starting ??= begin();

    try {
      await starting;
    } catch (error) {
      starting = null;
      publish({
        ...STARTING,
        problem:
          error instanceof Error ? error.message : "The till couldn't start.",
      });
      throw error;
    }
  };

  /** Resolves once the outbox holds the transaction, plus a grace period while online. */
  const whenQueued = async (
    running: OfflineExecutor,
    id: string,
    isSettled: () => boolean
  ): Promise<ChargeOutcome> => {
    /* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- polling the outbox until the write lands */
    while (!isSettled()) {
      const outbox = await running.peekOutbox();

      if (outbox.some((item) => item.id === id)) {
        break;
      }

      await sleep(QUEUE_POLL_MS);
    }
    /* oxlint-enable no-await-in-loop, react-doctor/async-await-in-loop */

    if (running.isOnline()) {
      await sleep(graceMs);
    }

    return { kind: "queued" };
  };

  const recorded = (clientRef: string): ChargeOutcome => {
    const reply = replies.get(clientRef);
    replies.delete(clientRef);

    if (reply === undefined) {
      throw new Error(`No answer was kept for sale ${clientRef}.`);
    }

    return { kind: "recorded", reply };
  };

  /**
   * Charges a sale. Resolves "recorded" when Tally answered in time,
   * "queued" when it's saved on this till to send later; rejects with a
   * `RefusedSaleError` or `TillHttpError` (after rolling back) when it can't
   * be taken at all.
   */
  const charge = async (input: TillCharge): Promise<ChargeOutcome> => {
    if (executor === null) {
      throw new Error("The till is still starting.");
    }

    const running = executor;
    customerWaiting.add(input.clientRef);
    let settledYet = false;

    const transaction = running.createOfflineTransaction({
      autoCommit: false,
      idempotencyKey: input.clientRef,
      metadata: { charge: input },
      mutationFnName: RECORD_SALE,
    });

    transaction.mutate(() => {
      applyCharge(collections, input);
    });

    const settle = async (): Promise<ChargeOutcome> => {
      try {
        await transaction.commit();

        return recorded(input.clientRef);
      } finally {
        settledYet = true;
        refreshSoon();
      }
    };

    // Not awaited yet: it races the outbox below.
    const settled = settle();

    refreshSoon();

    try {
      // A second tab, or no storage: nothing can be queued, so wait for Tally.
      if (!running.isOfflineEnabled) {
        return await settled;
      }

      return await Promise.race([
        settled,
        whenQueued(running, transaction.id, () => settledYet),
      ]);
    } finally {
      customerWaiting.delete(input.clientRef);
      refreshSoon();
    }
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    timer ??= setInterval(refreshSoon, STATUS_POLL_MS);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0 && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
  };

  const dispose = (): void => {
    executor?.dispose();
    executor = null;

    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  return {
    charge,
    dispose,
    getStatus: (): SyncStatus => status,
    start,
    subscribe,
  };
};

export type TillSync = ReturnType<typeof createTillSync>;

/** The message to show for a charge that failed, or null for a bug. */
export const chargeFailureMessage = (error: Error): string | null => {
  if (error instanceof RefusedSaleError || error instanceof TillHttpError) {
    return error.message;
  }

  return null;
};
