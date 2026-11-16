"use client";

import { count, eq, sum, useLiveQuery } from "@tanstack/react-db";
import Link from "next/link";

import { SaleRow } from "@/components/till/sale-row";
import { useTillData } from "@/components/till/till-data-provider";
import { Panel } from "@/components/ui/panel";
import { formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";

const RECENT = 8;

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
        .limit(RECENT),
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
  const salesToday = totals?.count ?? 0;

  return (
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
          : `Your sales today · ${formatCount(salesToday)} · ${formatCedis(totals?.total ?? 0)}`
      }
    >
      {recent.length === 0 ? (
        <p className="text-ink-2 p-4 text-sm">No sales yet today.</p>
      ) : (
        <ul>
          {recent.map((sale) => (
            <SaleRow key={sale.clientRef} sale={sale} />
          ))}
        </ul>
      )}
    </Panel>
  );
};
