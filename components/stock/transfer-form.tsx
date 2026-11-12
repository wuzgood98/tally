"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import type { PickedProduct } from "@/app/(app)/lookup-action";
import { dispatchAction } from "@/app/(app)/transfers/actions";
import { ProductPicker } from "@/components/stock/product-picker";
import { TransferLineRow } from "@/components/stock/transfer-line-row";
import type { TransferDraftLine } from "@/components/stock/transfer-line-row";
import { Button } from "@/components/ui/button";
import { formText } from "@/lib/form";
import { formatCount } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { wholeNumber } from "@/lib/numbers";

interface Option {
  readonly id: string;
  readonly name: string;
}

interface TransferFormProps {
  /** Branches this person may send from. */
  readonly sources: readonly Option[];
  /** Every branch; the sender is left out of the list. */
  readonly destinations: readonly Option[];
  readonly defaultFromId: string;
  readonly defaultToId: string;
  readonly initialLines: readonly TransferDraftLine[];
}

interface SubmittedLine {
  readonly productId: number;
  readonly quantity: number;
}

type Submission =
  | { readonly ok: true; readonly lines: SubmittedLine[] }
  | { readonly ok: false; readonly message: string };

const available = (line: TransferDraftLine, fromId: string): number =>
  line.product.onHand[fromId] ?? 0;

/** The lines as numbers, or what to fix first. */
const toSubmission = (
  lines: readonly TransferDraftLine[],
  from: Option | undefined
): Submission => {
  const result: SubmittedLine[] = [];

  for (const line of lines) {
    const quantity = wholeNumber(line.quantity);
    const onHand = available(line, from?.id ?? "");

    if (quantity === null || quantity === 0) {
      return {
        message: `Check the quantity for ${line.product.name}.`,
        ok: false,
      };
    }

    if (quantity > onHand) {
      return {
        message: `Only ${formatCount(onHand)} of ${line.product.name} at ${from?.name ?? "this branch"}.`,
        ok: false,
      };
    }

    result.push({ productId: line.product.id, quantity });
  }

  return { lines: result, ok: true };
};

const totals = (lines: readonly TransferDraftLine[]) => {
  let value = 0;
  let units = 0;

  for (const line of lines) {
    const quantity = wholeNumber(line.quantity) ?? 0;
    units += quantity;
    value += quantity * line.product.averageCost;
  }

  return { units, value };
};

export const TransferForm = ({
  sources,
  destinations,
  defaultFromId,
  defaultToId,
  initialLines,
}: TransferFormProps) => {
  const [fromId, setFromId] = useState(defaultFromId);
  const [toId, setToId] = useState(defaultToId);
  const [lines, setLines] = useState(initialLines);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summary = totals(lines);
  const from = sources.find((item) => item.id === fromId);

  /** Scanning the same product again adds one more, like a till does. */
  const addProduct = (product: PickedProduct) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);

      if (existing === undefined) {
        return [...current, { product, quantity: "1" }];
      }

      return current.map((line) =>
        line === existing
          ? { ...line, quantity: String((wholeNumber(line.quantity) ?? 0) + 1) }
          : line
      );
    });
    setError(null);
  };

  const update = (productId: number, quantity: string) => {
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId ? { ...line, quantity } : line
      )
    );
  };

  const remove = (productId: number) => {
    setLines((current) =>
      current.filter((line) => line.product.id !== productId)
    );
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (toId === "") {
      setError("Choose the branch to send to.");

      return;
    }

    if (lines.length === 0) {
      setError("Scan or find at least one product.");

      return;
    }

    const submission = toSubmission(lines, from);

    if (!submission.ok) {
      setError(submission.message);

      return;
    }

    startTransition(async () => {
      const result = await dispatchAction({
        fromBranchId: fromId,
        lines: submission.lines,
        note: formText(form, "note"),
        toBranchId: toId,
      });

      setError(result.error);
    });
  };

  return (
    <form className="grid grid-cols-1 gap-6" onSubmit={onSubmit}>
      <div className="border-line bg-surface grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Send from
          <select
            className="field"
            disabled={sources.length === 1}
            name="fromBranchId"
            onChange={(event) => {
              setFromId(event.target.value);

              if (event.target.value === toId) {
                setToId("");
              }
            }}
            value={fromId}
          >
            {sources.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Send to
          <select
            className="field"
            name="toBranchId"
            onChange={(event) => {
              setToId(event.target.value);
              setError(null);
            }}
            required
            value={toId}
          >
            <option disabled value="">
              Choose a branch
            </option>
            {destinations.flatMap((branch) =>
              branch.id === fromId
                ? []
                : [
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>,
                  ]
            )}
          </select>
        </label>
      </div>

      <div className="border-line bg-surface rounded-xl border">
        <div className="border-line border-b p-4">
          <ProductPicker
            autoFocus={initialLines.length === 0}
            label="Add products"
            onPick={addProduct}
          />
        </div>
        {lines.length === 0 ? (
          <p className="text-ink-2 p-6 text-center text-sm">
            Nothing on this transfer yet. Scan the first item.
          </p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Products on this transfer</caption>
              <thead>
                <tr className="text-ink-2 border-line border-b text-left text-xs">
                  <th className="px-4 py-2 font-medium" scope="col">
                    Product
                  </th>
                  <th className="px-2 py-2 text-right font-medium" scope="col">
                    At {from?.name ?? "sender"}
                  </th>
                  <th
                    className="w-28 px-2 py-2 text-right font-medium"
                    scope="col"
                  >
                    Send
                  </th>
                  <th className="w-12 px-2 py-2" scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <TransferLineRow
                    available={available(line, fromId)}
                    key={line.product.id}
                    line={line}
                    onChange={update}
                    onRemove={remove}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <label className="grid gap-1.5 text-sm font-medium">
        <span>
          Note <span className="text-ink-3 font-normal">(optional)</span>
        </span>
        <textarea
          className="field h-auto min-h-20 py-2"
          maxLength={500}
          name="note"
          placeholder="Vehicle, driver, waybill number, anything the receiving branch should know"
        />
      </label>

      <div className="border-line bg-surface sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 pl-4 shadow-sm">
        <p className="tabular text-sm">
          <span className="font-semibold">{formatCedis(summary.value)}</span>
          <span className="text-ink-2">
            {" "}
            at cost · {formatCount(lines.length)}{" "}
            {lines.length === 1 ? "line" : "lines"},{" "}
            {formatCount(summary.units)}{" "}
            {summary.units === 1 ? "unit" : "units"}
          </span>
        </p>
        <div className="flex items-center gap-3">
          <output aria-live="polite" className="text-danger text-sm">
            {error}
          </output>
          <Button disabled={pending} size="md" type="submit">
            {pending ? "Sending…" : "Send transfer"}
          </Button>
        </div>
      </div>
    </form>
  );
};
