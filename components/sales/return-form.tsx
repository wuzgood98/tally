"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { returnSaleAction } from "@/app/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { labelledOptions } from "@/components/ui/select-options";
import { PendingLabel } from "@/components/ui/spinner";
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

const DISPOSITIONS = ["restock", "damaged"] as const;

const DISPOSITION_LABELS: Record<ReturnDisposition, string> = {
  damaged: "Damaged, write off",
  restock: "Back on the shelf",
};

const DISPOSITION_OPTIONS = labelledOptions(DISPOSITIONS, DISPOSITION_LABELS);

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
                  <Input
                    aria-label={`Units of ${line.name} coming back`}
                    className="min-w-16"
                    format="amount"
                    size="sm"
                    inputMode="numeric"
                    onChange={(event) => {
                      change(line.productId, { quantity: event.target.value });
                    }}
                    onFocus={(event) => {
                      event.target.select();
                    }}
                    placeholder="0"
                    value={drafts[line.productId]?.quantity ?? "0"}
                  />
                </td>
                <td className="px-2 py-2 pr-4">
                  <Select
                    aria-label={`Condition of ${line.name}`}
                    className="min-w-40"
                    size="sm"
                    onValueChange={(value) => {
                      change(line.productId, {
                        disposition:
                          value === "damaged" ? "damaged" : "restock",
                      });
                    }}
                    options={DISPOSITION_OPTIONS}
                    value={drafts[line.productId]?.disposition ?? "restock"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4">
        <Field>
          <FieldLabel>Reason</FieldLabel>
          <Textarea
            maxLength={500}
            name="reason"
            placeholder="e.g. Wrong size; customer exchanged for the 5 kg bag"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-sm">
            Refund <span className="font-semibold">{formatCedis(refund)}</span>
          </p>
          <div className="flex items-center gap-3">
            <output aria-live="polite" className="text-danger text-sm">
              {error}
            </output>
            <Button disabled={pending} size="md" type="submit">
              <PendingLabel label="Recording…" pending={pending}>
                Approve return
              </PendingLabel>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
