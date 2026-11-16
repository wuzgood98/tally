import { CircleCheck, CloudOff } from "lucide-react";
import Link from "next/link";

import { formatCedis } from "@/lib/money";
import type { ChargeOutcome } from "@/lib/till/client/sync";

/** The sale just rung up, and the cash it left to hand back. */
export interface LastSaleFacts {
  readonly outcome: ChargeOutcome;
  /** What the till showed, in pesewas: the total for a sale not yet recorded. */
  readonly total: number;
  /** Cash to hand back, in pesewas; null when none is due. */
  readonly change: number | null;
}

const Change = ({ change }: { readonly change: number }) => (
  <span className="text-ink">
    Change{" "}
    <span className="tabular text-lg font-semibold">{formatCedis(change)}</span>
  </span>
);

/**
 * Stays until the next sale, so the change due never times out. A sale saved
 * on the till (no connection) says so plainly: the customer can go, and it
 * gets its number when it reaches Tally.
 */
export const LastSale = ({
  sale: { outcome, total, change },
}: {
  readonly sale: LastSaleFacts;
}) => {
  if (outcome.kind === "queued") {
    return (
      <output className="bg-warn-soft text-warn flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-4 py-3 text-sm font-medium">
        <span className="flex items-center gap-2">
          <CloudOff aria-hidden="true" className="size-4" />
          Saved on this till · {formatCedis(total)}. It goes to Tally when the
          connection is back.
        </span>
        {change === null ? null : <Change change={change} />}
      </output>
    );
  }

  const { duplicate, sale } = outcome.reply;
  const number = sale.number ?? sale.clientRef;

  return (
    <output className="bg-brand-soft text-good flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-4 py-3 text-sm font-medium">
      <span className="flex items-center gap-2">
        <CircleCheck aria-hidden="true" className="size-4" />
        {duplicate
          ? `Already recorded as ${number}: nothing was charged twice.`
          : `${number} recorded · ${formatCedis(sale.total)}.`}
      </span>
      {change === null || duplicate ? null : <Change change={change} />}
      {sale.id === null ? null : (
        <Link className="ml-auto underline" href={`/sales/${String(sale.id)}`}>
          Receipt
        </Link>
      )}
    </output>
  );
};
