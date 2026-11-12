"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { returnSaleAction } from "@/app/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import type { ReturnDisposition } from "@/lib/db/schema";
import { formText } from "@/lib/form";
import { formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { wholeNumber } from "@/lib/numbers";

interface ReturnableLine {
  readonly productId: number;
  readonly name: string;
  readonly sku: string;
  readonly unitPrice: number;
  /** Sold on this sale, minus what has already come back. */
  readonly returnable: number;
}

interface Draft {
  readonly quantity: string;
  readonly disposition: ReturnDisposition;
}

type Drafts = Readonly<Record<number, Draft>>;

const DISPOSITION_LABELS: Record<ReturnDisposition, string> = {
  damaged: "Damaged, write off",
  restock: "Back on the shelf",
};

interface ChosenLine {
  readonly productId: number;
  readonly quantity: number;
  readonly disposition: ReturnDisposition;
}

type Chosen =
  | { readonly ok: true; readonly lines: ChosenLine[] }
  | { readonly ok: false; readonly error: string };

/** What the customer gets back for the quantities typed so far. */
const refundFor = (
  lines: readonly ReturnableLine[],
  drafts: Drafts
): number => {
  let refund = 0;

  for (const line of lines) {
    const quantity = wholeNumber(drafts[line.productId]?.quantity ?? "0") ?? 0;
    refund += Math.min(quantity, line.returnable) * line.unitPrice;
  }

  return refund;
};

/** The lines being returned, or the first one that needs fixing. */
const toReturn = (lines: readonly ReturnableLine[], drafts: Drafts): Chosen => {
  const chosen: ChosenLine[] = [];

  for (const line of lines) {
    const draft = drafts[line.productId];
    const quantity = wholeNumber(draft?.quantity ?? "0");

    if (quantity === null || quantity > line.returnable) {
      return {
        error: `Return between 0 and ${formatCount(line.returnable)} of ${line.name}.`,
        ok: false,
      };
    }

    if (quantity > 0) {
      chosen.push({
        disposition: draft?.disposition ?? "restock",
        productId: line.productId,
        quantity,
      });
    }
  }

  return chosen.length === 0
    ? { error: "Enter how many of an item are coming back.", ok: false }
    : { lines: chosen, ok: true };
};

/**
 * A manager records what the customer brought back. Each item goes back on
 * the shelf or, if it can't be sold again, is written off as damaged.
 */
export const ReturnForm = ({
  saleId,
  lines,
}: {
  readonly saleId: number;
  readonly lines: readonly ReturnableLine[];
}) => {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const refund = refundFor(lines, drafts);

  const change = (productId: number, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [productId]: {
        disposition: current[productId]?.disposition ?? "restock",
        quantity: current[productId]?.quantity ?? "0",
        ...patch,
      },
    }));
    setError(null);
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = formText(new FormData(event.currentTarget), "reason");
    const result = toReturn(lines, drafts);

    if (!result.ok) {
      setError(result.error);

      return;
    }

    if (reason === "") {
      setError("Say why the customer is returning it.");

      return;
    }

    startTransition(async () => {
      const response = await returnSaleAction({
        lines: result.lines,
        reason,
        saleId,
      });

      setError(response.error);
    });
  };

  return (
    <form className="grid grid-cols-1" onSubmit={onSubmit}>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Items that can be returned</caption>
          <thead>
            <tr className="text-ink-2 border-line border-b text-left text-xs">
              <th className="px-4 py-2 font-medium" scope="col">
                Item
              </th>
              <th className="px-2 py-2 text-right font-medium" scope="col">
                Can return
              </th>
              <th className="w-24 px-2 py-2 text-right font-medium" scope="col">
                Returning
              </th>
              <th className="px-2 py-2 pr-4 font-medium" scope="col">
                Condition
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr className="border-line border-b" key={line.productId}>
                <td className="min-w-48 px-4 py-2">
                  <span className="font-medium">{line.name}</span>
                  <span className="text-ink-3 block font-mono text-xs">
                    {line.sku} · {formatCedis(line.unitPrice)} each
                  </span>
                </td>
                <td className="tabular px-2 py-2 text-right">
                  {formatCount(line.returnable)}
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Units of ${line.name} coming back`}
                    className="field tabular h-8 min-w-16 text-right"
                    inputMode="numeric"
                    onChange={(event) => {
                      change(line.productId, { quantity: event.target.value });
                    }}
                    onFocus={(event) => {
                      event.target.select();
                    }}
                    value={drafts[line.productId]?.quantity ?? "0"}
                  />
                </td>
                <td className="px-2 py-2 pr-4">
                  <select
                    aria-label={`Condition of ${line.name}`}
                    className="field h-8 min-w-40"
                    onChange={(event) => {
                      change(line.productId, {
                        disposition:
                          event.target.value === "damaged"
                            ? "damaged"
                            : "restock",
                      });
                    }}
                    value={drafts[line.productId]?.disposition ?? "restock"}
                  >
                    {(["restock", "damaged"] as const).map((value) => (
                      <option key={value} value={value}>
                        {DISPOSITION_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4">
        <label className="grid gap-1.5 text-sm font-medium">
          Reason
          <textarea
            className="field h-auto min-h-16 py-2"
            maxLength={500}
            name="reason"
            placeholder="e.g. Wrong size; customer exchanged for the 5 kg bag"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-sm">
            Refund <span className="font-semibold">{formatCedis(refund)}</span>
          </p>
          <div className="flex items-center gap-3">
            <output aria-live="polite" className="text-danger text-sm">
              {error}
            </output>
            <Button disabled={pending} size="md" type="submit">
              {pending ? "Recording…" : "Approve return"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
