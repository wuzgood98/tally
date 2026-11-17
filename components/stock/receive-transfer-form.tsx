"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { receiveTransferAction } from "@/app/(app)/transfers/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PendingLabel } from "@/components/ui/spinner";
import { formText } from "@/lib/form";
import { formatCount } from "@/lib/format";
import { wholeNumber } from "@/lib/numbers";

interface SentLine {
  readonly productId: number;
  readonly name: string;
  readonly sku: string;
  readonly quantitySent: number;
}

interface ReceiveTransferFormProps {
  readonly transferId: number;
  readonly lines: readonly SentLine[];
}

type Counts = Readonly<Record<number, string>>;

/** Units missing on a line, or null while its count isn't a valid number. */
const missingOn = (line: SentLine, counts: Counts): number | null => {
  const counted = wholeNumber(counts[line.productId] ?? "");

  return counted === null || counted > line.quantitySent
    ? null
    : line.quantitySent - counted;
};

const COUNT_HEADERS = ["Sent", "Received", "Missing"] as const;

/**
 * Counting a transfer in. Every line starts at what was sent, so a complete
 * delivery is one click; anything short needs a note saying what happened.
 */
export const ReceiveTransferForm = ({
  transferId,
  lines,
}: ReceiveTransferFormProps) => {
  const [counts, setCounts] = useState<Counts>(() =>
    Object.fromEntries(
      lines.map((line) => [line.productId, String(line.quantitySent)])
    )
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const missing = lines.reduce(
    (sum, line) => sum + (missingOn(line, counts) ?? 0),
    0
  );

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = formText(new FormData(event.currentTarget), "note");
    const invalid = lines.find((line) => missingOn(line, counts) === null);

    if (invalid !== undefined) {
      setError(
        `Count ${invalid.name} again: between 0 and ${formatCount(invalid.quantitySent)}.`
      );

      return;
    }

    if (missing > 0 && note === "") {
      setError("Some units are missing: add a note saying what happened.");

      return;
    }

    startTransition(async () => {
      const result = await receiveTransferAction({
        lines: lines.map((line) => ({
          productId: line.productId,
          quantityReceived: wholeNumber(counts[line.productId] ?? "") ?? 0,
        })),
        note,
        transferId,
      });

      setError(result.error);
    });
  };

  return (
    <form className="grid grid-cols-1" onSubmit={onSubmit}>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Count what arrived</caption>
          <thead>
            <tr className="text-ink-2 border-line border-b text-left text-xs">
              <th className="px-4 py-2 font-medium" scope="col">
                Product
              </th>
              {COUNT_HEADERS.map((header) => (
                <th
                  className="px-2 py-2 text-right font-medium last:pr-4"
                  key={header}
                  scope="col"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const lineMissing = missingOn(line, counts);

              return (
                <tr className="border-line border-b" key={line.productId}>
                  <td className="min-w-56 px-4 py-2">
                    <span className="font-medium">{line.name}</span>
                    <span className="text-ink-3 block font-mono text-xs">
                      {line.sku}
                    </span>
                  </td>
                  <td className="tabular px-2 py-2 text-right">
                    {formatCount(line.quantitySent)}
                  </td>
                  <td className="w-28 px-2 py-2">
                    <Input
                      aria-invalid={lineMissing === null ? true : undefined}
                      aria-label={`Units of ${line.name} received`}
                      className="min-w-20"
                      format="amount"
                      size="sm"
                      inputMode="numeric"
                      onChange={(event) => {
                        setCounts((current) => ({
                          ...current,
                          [line.productId]: event.target.value,
                        }));
                        setError(null);
                      }}
                      onFocus={(event) => {
                        event.target.select();
                      }}
                      value={counts[line.productId] ?? ""}
                    />
                  </td>
                  <td
                    className={
                      lineMissing !== null && lineMissing > 0
                        ? "text-danger tabular px-2 py-2 pr-4 text-right font-medium"
                        : "text-ink-3 tabular px-2 py-2 pr-4 text-right"
                    }
                  >
                    {lineMissing === null || lineMissing === 0
                      ? "—"
                      : formatCount(lineMissing)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4">
        <Field>
          <FieldLabel>
            <span>
              Note{" "}
              <span className="text-ink-3 font-normal">
                {missing > 0
                  ? "(required: say what happened to the missing units)"
                  : "(optional)"}
              </span>
            </span>
          </FieldLabel>
          <Textarea
            maxLength={500}
            name="note"
            placeholder="Damaged cartons, short loads, anything the sending branch should know"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-sm">
            {missing > 0 ? (
              <span className="text-danger font-medium">
                {formatCount(missing)} {missing === 1 ? "unit" : "units"}{" "}
                missing
              </span>
            ) : (
              <span className="text-ink-2">Everything sent has arrived.</span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <output aria-live="polite" className="text-danger text-sm">
              {error}
            </output>
            <Button disabled={pending} size="md" type="submit">
              <PendingLabel label="Saving…" pending={pending}>
                Receive transfer
              </PendingLabel>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
