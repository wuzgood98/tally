"use client";

import { useLiveQuery } from "@tanstack/react-db";
import { createContext, use, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { Skeleton } from "skullet/react";

import { StartOfflineTill } from "@/components/till/offline-till";
import { Button } from "@/components/ui/button";
import { getTillData } from "@/lib/till/client/data";
import type { TillData } from "@/lib/till/client/data";
import type { SavedSnapshot } from "@/lib/till/client/saved-copy";
import { STARTING } from "@/lib/till/client/sync";
import type { SyncStatus } from "@/lib/till/client/sync";

const TillDataContext = createContext<TillData | null>(null);

/** The till's collections. Only inside `TillDataProvider`, once they've loaded. */
export const useTillData = (): TillData => {
  const data = use(TillDataContext);

  if (data === null) {
    throw new Error("useTillData needs a TillDataProvider above it.");
  }

  return data;
};

/** The offline queue's state: whether it can keep sales, how many wait, why the last send failed. */
export const useSyncStatus = (): SyncStatus => {
  const { sync } = useTillData();

  return useSyncExternalStore(sync.subscribe, sync.getStatus, () => STARTING);
};

/**
 * The oldest saved copy on screen (the catalogue or the shelf counts) and
 * when the till last heard about it, or null while everything came from Tally.
 */
export const useSavedCopy = (): SavedSnapshot | null => {
  const { savedCopies } = useTillData();

  return useSyncExternalStore(
    savedCopies.subscribe,
    savedCopies.getSnapshot,
    () => null
  );
};

/** Nothing to subscribe to: the data layer is made once per person and kept. */
const subscribe = () => () => null;

/** What the screen looks like while the till loads, and how Skullet remembers it. */
interface LoadingSkeleton {
  /** Remembers the measured skeleton under this key across visits. */
  readonly id: string;
  /** Read to screen readers while loading. */
  readonly label: string;
  /**
   * The screen drawn from sample data, unseen: Skullet measures it into the
   * skeleton until one from an earlier visit is remembered.
   */
  readonly sample: ReactNode;
}

const noStatus = () => () => null;

/**
 * Whether the catalogue and the shelf counts are in the browser and the
 * offline queue has put back any sales it was keeping. Takes no data (the
 * server render, and the browser's first) as still loading, so the screen
 * keeps one tree, and one skeleton, from the server's HTML to the till.
 */
const useTillHealth = (data: TillData | null) => {
  const products = useLiveQuery({
    query: (q) =>
      data === null
        ? null
        : q.from({ product: data.products }).select(({ product }) => ({
            id: product.id,
          })),
  });

  const levels = useLiveQuery({
    query: (q) =>
      data === null
        ? null
        : q.from({ level: data.stockLevels }).select(({ level }) => ({
            key: level.key,
          })),
  });

  const status = useSyncExternalStore(
    data?.sync.subscribe ?? noStatus,
    data?.sync.getStatus ?? (() => STARTING),
    () => STARTING
  );

  return {
    failed:
      products.isLoadingError ||
      levels.isLoadingError ||
      status.problem !== null,
    ready: data !== null && products.isReady && levels.isReady && status.ready,
  };
};

const LoadFailed = ({ data }: { readonly data: TillData }) => (
  <div className="grid justify-items-center gap-3 p-6 text-center">
    <p className="text-danger text-sm">
      The till couldn&apos;t load the products. Check the connection.
    </p>
    <Button
      onClick={() => {
        // Errors stay on the collections' health; the buttons retry.
        data.products.utils.refetch().catch(() => null);
        data.stockLevels.utils.refetch().catch(() => null);
        data.sync.start().catch(() => null);
      }}
      size="md"
      type="button"
      variant="outline"
    >
      Try again
    </Button>
  </div>
);

/**
 * Gives the till its collections. They live in the browser only: the server
 * renders a skeleton of `sample` (Skullet measures it before the first paint,
 * so nothing moves when the till arrives), and the browser takes over with
 * the data layer for the signed-in person (`getTillData`), holding the till
 * back until it's ready.
 */
export const TillDataProvider = ({
  userId,
  children,
  id,
  label,
  sample,
}: LoadingSkeleton & {
  readonly userId: string;
  readonly children: ReactNode;
}) => {
  const data = useSyncExternalStore(
    subscribe,
    () => getTillData(userId),
    () => null
  );

  const { failed, ready } = useTillHealth(data);

  if (data !== null && failed) {
    return <LoadFailed data={data} />;
  }

  return (
    <Skeleton id={id} label={label} loading={!ready}>
      {data !== null && ready ? (
        <TillDataContext value={data}>
          {children}
          <StartOfflineTill />
        </TillDataContext>
      ) : (
        sample
      )}
    </Skeleton>
  );
};
