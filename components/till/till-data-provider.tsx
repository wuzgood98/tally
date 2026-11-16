"use client";

import { useLiveQuery } from "@tanstack/react-db";
import { createContext, use, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { getTillData } from "@/lib/till/client/data";
import type { TillData } from "@/lib/till/client/data";

const TillDataContext = createContext<TillData | null>(null);

/** The till's collections. Only inside `TillDataProvider`, once they've loaded. */
export const useTillData = (): TillData => {
  const data = use(TillDataContext);

  if (data === null) {
    throw new Error("useTillData needs a TillDataProvider above it.");
  }

  return data;
};

/** Nothing to subscribe to: the data layer is made once per person and kept. */
const subscribe = () => () => null;

const Waiting = ({ children }: { readonly children: ReactNode }) => (
  <output className="text-ink-2 block p-6 text-center text-sm">
    {children}
  </output>
);

/** Holds the till back until the catalogue and the shelf counts are in the browser. */
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

  if (products.isLoadingError || levels.isLoadingError) {
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

  if (!products.isReady || !levels.isReady) {
    return <Waiting>Loading the till…</Waiting>;
  }

  return <TillDataContext value={data}>{children}</TillDataContext>;
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
