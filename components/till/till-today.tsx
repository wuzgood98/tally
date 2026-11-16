"use client";

import { count, eq, sum, useLiveQuery } from "@tanstack/react-db";
import Link from "next/link";

import { useTillData } from "@/components/till/till-data-provider";
import { Panel } from "@/components/ui/panel";
import { formatCount, formatTime } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { PAYMENT_LABELS } from "@/lib/stock/payment";
import type { TillSale } from "@/lib/till/schema";

const RECENT = 8;

const SaleRow = ({ sale }: { readonly sale: TillSale }) => {
  const repriced =
    sale.expectedTotal !== null && sale.expectedTotal !== sale.total;

  return (
    <li className="border-line flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm last:border-b-0">
      <time
        className="text-ink-3 figures w-12 shrink-0 text-xs"
        dateTime={sale.createdAt}
      >
        {formatTime(new Date(sale.createdAt))}
      </time>
      {sale.id === null ? (
        <span className="text-ink-2">Sending…</span>
      ) : (
        <Link
          className="font-mono text-xs hover:underline"
          href={`/sales/${String(sale.id)}`}
        >
          {sale.number}
        </Link>
      )}
      <span className="text-ink-3 text-xs">
        {formatCount(sale.units)} {sale.units === 1 ? "item" : "items"} ·{" "}
        {PAYMENT_LABELS[sale.paymentMethod]}
      </span>
      <span className="figures ml-auto font-medium">
        {formatCedis(sale.total)}
      </span>
      {repriced ? (
        <span className="text-warn w-full text-xs">
          The till showed {formatCedis(sale.expectedTotal ?? 0)}: a price
          changed before it was recorded.
        </span>
      ) : null}
    </li>
  );
};

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
