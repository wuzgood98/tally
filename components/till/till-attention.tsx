"use client";

import { useLiveQuery } from "@tanstack/react-db";

import { useTillData } from "@/components/till/till-data-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { formatCount, formatDateTime } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { PAYMENT_LABELS } from "@/lib/stock/payment";
import type { AttentionSale } from "@/lib/till/schema";

const Refused = ({
  sale,
  onHandled,
}: {
  readonly sale: AttentionSale;
  readonly onHandled: () => Promise<void>;
}) => (
  <li className="border-line grid gap-2 border-b px-4 py-3 text-sm last:border-b-0">
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <time className="text-ink-3 text-xs" dateTime={sale.chargedAt}>
        Charged {formatDateTime(new Date(sale.chargedAt))}
      </time>
      <span className="text-ink-3 text-xs">
        {PAYMENT_LABELS[sale.paymentMethod]}
      </span>
      <span className="figures ml-auto font-medium">
        {formatCedis(sale.expectedTotal)}
      </span>
    </div>
    <ul className="text-ink-2 text-xs">
      {sale.lines.map((line) => (
        <li key={line.productId}>
          {formatCount(line.quantity)} × {line.name}
        </li>
      ))}
    </ul>
    <p className="text-warn text-xs">Tally said: {sale.reason}</p>
    <div>
      <ConfirmDialog
        cancelLabel="Keep it"
        confirmLabel="Mark handled"
        description="Only once it's been put right: the sale rung up again by someone allowed to, or the shelf counted. The till forgets it after this."
        onConfirm={async () => {
          await onHandled();

          return { error: null };
        }}
        pendingLabel="Removing…"
        title="Has this sale been dealt with?"
        trigger="Mark handled"
        triggerSize="md"
        triggerVariant="outline"
      />
    </div>
  </li>
);

/**
 * Sales Tally refused after the customer had gone with the goods (say, the
 * cashier was moved to another store while the till was offline). The queue
 * drops them, so this list, kept on this device, is the only record until a
 * manager puts them right. Hidden while it's empty.
 */
export const TillAttention = () => {
  const { attention } = useTillData();

  const { data: refused } = useLiveQuery({
    query: (q) =>
      q.from({ sale: attention }).orderBy(({ sale }) => sale.failedAt, "desc"),
  });

  if (refused.length === 0) {
    return null;
  }

  return (
    <Panel
      flush
      title={`Needs a manager · ${formatCount(refused.length)} ${refused.length === 1 ? "sale" : "sales"} Tally refused`}
    >
      <ul>
        {refused.map((sale) => (
          <Refused
            key={sale.clientRef}
            onHandled={async () => {
              await attention.delete(sale.clientRef).when("settled");
            }}
            sale={sale}
          />
        ))}
      </ul>
    </Panel>
  );
};
