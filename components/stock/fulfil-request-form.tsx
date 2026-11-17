"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import {
  cancelRequestAction,
  fulfilRequestAction,
} from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PendingLabel } from "@/components/ui/spinner";
import { formText } from "@/lib/form";
import { formatCount } from "@/lib/format";
import { wholeNumber } from "@/lib/numbers";

interface RequestedLine {
  readonly productId: number;
  readonly name: string;
  readonly sku: string;
  readonly quantity: number;
  readonly atWarehouse: number;
}

type Sending = Readonly<Record<number, string>>;

/** What to send, or why it can't go yet. */
const toSend = (lines: readonly RequestedLine[], sending: Sending) => {
  const chosen: { productId: number; quantity: number }[] = [];

  for (const line of lines) {
    const quantity = wholeNumber(sending[line.productId] ?? "0");

    if (quantity === null || quantity > line.quantity) {
      return {
        error: `Send between 0 and ${formatCount(line.quantity)} of ${line.name}.`,
        lines: chosen,
      };
    }

    if (quantity > 0) {
      chosen.push({ productId: line.productId, quantity });
    }
  }

  return {
    error: chosen.length === 0 ? "Nothing to send: every line is 0." : null,
    lines: chosen,
  };
};

/**
 * The warehouse sends what was asked for, or less where it's short. Each line
 * starts at the smaller of the two; sending opens the transfer it went out on.
 */
export const FulfilRequestForm = ({
  requestId,
  lines,
}: {
  readonly requestId: number;
  readonly lines: readonly RequestedLine[];
}) => {
  const [sending, setSending] = useState<Sending>(() =>
    Object.fromEntries(
      lines.map((line) => [
        line.productId,
        String(Math.max(Math.min(line.quantity, line.atWarehouse), 0)),
      ])
    )
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = formText(new FormData(event.currentTarget), "note");
    const result = toSend(lines, sending);

    if (result.error !== null) {
      setError(result.error);

      return;
    }

    startTransition(async () => {
      const response = await fulfilRequestAction({
        lines: result.lines,
        note: note === "" ? undefined : note,
        requestId,
      });

      setError(response.error);
    });
  };

  return (
    <form className="grid grid-cols-1" onSubmit={onSubmit}>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">What to send</caption>
          <thead>
            <tr className="text-ink-2 border-line border-b text-left text-xs">
              <th className="px-4 py-2 font-medium" scope="col">
                Product
              </th>
              <th className="px-2 py-2 text-right font-medium" scope="col">
                Asked
              </th>
              <th className="px-2 py-2 text-right font-medium" scope="col">
                In the warehouse
              </th>
              <th
                className="w-28 px-2 py-2 pr-4 text-right font-medium"
                scope="col"
              >
                Send
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr className="border-line border-b" key={line.productId}>
                <td className="min-w-52 px-4 py-2">
                  <span className="font-medium">{line.name}</span>
                  <span className="text-ink-3 block font-mono text-xs">
                    {line.sku}
                  </span>
                </td>
                <td className="tabular px-2 py-2 text-right">
                  {formatCount(line.quantity)}
                </td>
                <td
                  className={
                    line.atWarehouse < line.quantity
                      ? "text-warn tabular px-2 py-2 text-right font-medium"
                      : "text-ink-2 tabular px-2 py-2 text-right"
                  }
                >
                  {formatCount(line.atWarehouse)}
                </td>
                <td className="px-2 py-2 pr-4">
                  <Input
                    aria-label={`Units of ${line.name} to send`}
                    className="min-w-20"
                    format="amount"
                    size="sm"
                    inputMode="numeric"
                    onChange={(event) => {
                      setSending((current) => ({
                        ...current,
                        [line.productId]: event.target.value,
                      }));
                      setError(null);
                    }}
                    onFocus={(event) => {
                      event.target.select();
                    }}
                    value={sending[line.productId] ?? "0"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 p-4">
        <Field>
          <FieldLabel>
            <span>
              Note for the transfer{" "}
              <span className="text-ink-3 font-normal">(optional)</span>
            </span>
          </FieldLabel>
          <Input
            autoComplete="off"
            maxLength={500}
            name="note"
            placeholder="Truck, driver, or why some lines are short"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <output aria-live="polite" className="text-danger mr-auto text-sm">
            {error}
          </output>
          <Button disabled={pending} size="md" type="submit">
            <PendingLabel label="Sending…" pending={pending}>
              Send as a transfer
            </PendingLabel>
          </Button>
        </div>
      </div>
    </form>
  );
};

/** Either side can call a request off; the reason is optional but kept. */
export const CancelRequestForm = ({
  requestId,
}: {
  readonly requestId: number;
}) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        onClick={() => {
          setOpen(true);
        }}
        size="md"
        type="button"
        variant="destructive"
      >
        Cancel request
      </Button>
    );
  }

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = formText(new FormData(event.currentTarget), "note");

    startTransition(async () => {
      const result = await cancelRequestAction({
        note: note === "" ? undefined : note,
        requestId,
      });

      setError(result.error);
    });
  };

  return (
    <form className="grid w-full gap-3" onSubmit={onSubmit}>
      <Field>
        <FieldLabel>
          <span>
            Why? <span className="text-ink-3 font-normal">(optional)</span>
          </span>
        </FieldLabel>
        <Input
          autoComplete="off"
          // The reason is the only thing to do next, so focusing it is the point.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          maxLength={500}
          name="note"
          placeholder="e.g. Warehouse is out until next week"
        />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <output aria-live="polite" className="text-danger mr-auto text-sm">
          {error}
        </output>
        <Button
          disabled={pending}
          onClick={() => {
            setOpen(false);
          }}
          size="md"
          type="button"
          variant="ghost"
        >
          Keep it
        </Button>
        <Button
          disabled={pending}
          size="md"
          type="submit"
          variant="destructive"
        >
          <PendingLabel label="Cancelling…" pending={pending}>
            Cancel the request
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
};
