"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { cancelTransferAction } from "@/app/(app)/transfers/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formText } from "@/lib/form";

interface CancelTransferFormProps {
  readonly transferId: number;
  readonly fromName: string;
}

/**
 * Calling a transfer back puts its stock back at the sender, so it takes two
 * steps: the first asks why, the second does it.
 */
export const CancelTransferForm = ({
  transferId,
  fromName,
}: CancelTransferFormProps) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-2 text-sm">
          Truck turned back, or sent to the wrong branch? Cancelling returns
          every unit to {fromName}.
        </p>
        <Button
          onClick={() => {
            setOpen(true);
          }}
          size="md"
          type="button"
          variant="destructive"
        >
          Cancel transfer
        </Button>
      </div>
    );
  }

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = formText(new FormData(event.currentTarget), "note");

    if (note === "") {
      setError("Say why the transfer is being cancelled.");

      return;
    }

    startTransition(async () => {
      const result = await cancelTransferAction({ note, transferId });
      setError(result.error);
    });
  };

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <Field>
        <FieldLabel>Why is it being cancelled?</FieldLabel>
        <Input
          autoComplete="off"
          // The reason is the only thing to do next, so focusing it is the point.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          maxLength={500}
          name="note"
          placeholder="e.g. Van broke down at Tema; goods back on the shelf"
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
            setError(null);
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
          {pending ? "Cancelling…" : `Cancel and return to ${fromName}`}
        </Button>
      </div>
    </form>
  );
};
