import Link from "next/link";

import { formatCount, formatTime } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { PAYMENT_LABELS } from "@/lib/stock/payment";
import type { TillSale } from "@/lib/till/schema";

/**
 * One sale in the till's lists (today's, and earlier sales): its time, its
 * number once Tally has recorded it ("Sending…" until then), what was sold
 * and the total, flagged when a price changed before it was recorded.
 */
export const SaleRow = ({ sale }: { readonly sale: TillSale }) => {
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
