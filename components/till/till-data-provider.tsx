"use client";

import { useLiveQuery } from "@tanstack/react-db";
import { createContext, use, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

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

const Waiting = ({ children }: { readonly children: ReactNode }) => (
  <output className="text-ink-2 block p-6 text-center text-sm">
    {children}
  </output>
);

/**
 * Holds the till back until the catalogue and the shelf counts are in the
 * browser, and the offline queue has put back any sales it was keeping.
 */
const WhenLoaded = ({
  data,
  children,
}: {
  readonly data: TillData;
  readonly children: ReactNode;
}) => {
  const products = useLiveQuery({
    query: (q) =>
      q.from({ product: data.products }).select(({ product }) => ({
        id: product.id,
      })),
  });

  const levels = useLiveQuery({
    query: (q) =>
      q.from({ level: data.stockLevels }).select(({ level }) => ({
        key: level.key,
      })),
  });

  const status = useSyncExternalStore(
    data.sync.subscribe,
    data.sync.getStatus,
    () => STARTING
  );

  if (
    products.isLoadingError ||
    levels.isLoadingError ||
    status.problem !== null
  ) {
    return (
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
  }

  if (!products.isReady || !levels.isReady || !status.ready) {
    return <Waiting>Loading the till…</Waiting>;
  }

  return (
    <TillDataContext value={data}>
      {children}
      <StartOfflineTill />
    </TillDataContext>
  );
};

/**
 * Gives the till its collections. They live in the browser only: the server
 * render shows "Loading the till…", and the browser takes over with the data
 * layer for the signed-in person (`getTillData`).
 */
export const TillDataProvider = ({
  userId,
  children,
}: {
  readonly userId: string;
  readonly children: ReactNode;
}) => {
  const data = useSyncExternalStore(
    subscribe,
    () => getTillData(userId),
    () => null
  );

  if (data === null) {
    return <Waiting>Loading the till…</Waiting>;
  }

  return <WhenLoaded data={data}>{children}</WhenLoaded>;
};
