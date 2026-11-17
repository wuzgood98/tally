"use client";

import { count, eq, sum, useLiveQuery } from "@tanstack/react-db";
import { Receipt } from "lucide-react";
import Link from "next/link";

import { SaleRow } from "@/components/till/sale-row";
import { useTillData } from "@/components/till/till-data-provider";
import { EmptyNote } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import type { TillSale } from "@/lib/till/schema";

export const TODAY_RECENT = 8;

/** Today's panel as drawn: the newest sales, and the day's count and sum. */
export const TodayPanel = ({
  recent,
  salesToday,
  totalToday,
}: {
  readonly recent: readonly TillSale[];
  readonly salesToday: number;
  readonly totalToday: number;
}) => (
  <Panel
    action={
      <Link className="text-sm hover:underline" href="/till/history">
        Earlier sales
      </Link>
    }
    flush
    title={
      salesToday === 0
        ? "Your sales today"
        : `Your sales today · ${formatCount(salesToday)} · ${formatCedis(totalToday)}`
    }
  >
    {recent.length === 0 ? (
      <EmptyNote icon={Receipt} title="No sales yet today">
        Each sale you ring up shows here.
      </EmptyNote>
    ) : (
      <ul>
        {recent.map((sale) => (
          <SaleRow key={sale.clientRef} sale={sale} />
        ))}
      </ul>
    )}
  </Panel>
);

/**
 * This person's sales today at the chosen store, newest first, with a running
 * count and total. Two live queries over the sales collection: a sale appears
 * here the moment it's charged ("Sending…"), and gets its number when the
 * server confirms it.
 */
export const TillToday = ({ storeId }: { readonly storeId: string }) => {
  const { sales } = useTillData();

  const { data: recent } = useLiveQuery({
    query: (q) =>
      q
        .from({ sale: sales })
        .where(({ sale }) => eq(sale.branchId, storeId))
        .orderBy(({ sale }) => sale.createdAt, "desc")
        .limit(TODAY_RECENT),
  });

  const { data: summary } = useLiveQuery({
    query: (q) =>
      q
        .from({ sale: sales })
        .where(({ sale }) => eq(sale.branchId, storeId))
        .select(({ sale }) => ({
          count: count(sale.clientRef),
          total: sum(sale.total),
        })),
  });

  const [totals] = summary;

  return (
    <TodayPanel
      recent={recent}
      salesToday={totals?.count ?? 0}
      totalToday={totals?.total ?? 0}
    />
  );
};
