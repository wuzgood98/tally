"use client";

import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import {
  approveOrderAction,
  cancelOrderAction,
  closeOrderAction,
} from "@/app/(app)/purchase-orders/actions";
import { Button } from "@/components/ui/button";
import { formText } from "@/lib/form";

/** Approving is what sends the order, so it asks once more. */
export const ApproveOrderButton = ({
  orderId,
  total,
}: {
  readonly orderId: number;
  readonly total: string;
}) => {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        onClick={() => {
          setConfirming(true);
        }}
        size="md"
        type="button"
      >
        Approve order
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-ink-2 text-sm">
        Commit {total} with the supplier?
      </span>
      <Button
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await approveOrderAction(orderId);
            setError(result.error);
          });
        }}
        size="md"
        type="button"
      >
        {pending ? "Approving…" : "Yes, approve"}
      </Button>
      <Button
        disabled={pending}
        onClick={() => {
          setConfirming(false);
        }}
        size="md"
        type="button"
        variant="ghost"
      >
        Not yet
      </Button>
      {error === null ? null : (
        <output className="text-danger w-full text-sm">{error}</output>
      )}
    </div>
  );
};

const KINDS = {
  cancel: {
    button: "Cancel order",
    confirm: "Cancel the order",
    placeholder: "e.g. Supplier can't deliver before the promo ends",
    prompt: "Why is it being cancelled?",
  },
  close: {
    button: "Close short",
    confirm: "Close it short",
    placeholder: "e.g. Supplier has discontinued the rest",
    prompt: "Why stop waiting for the rest?",
  },
} as const;

/** Cancelling or closing short: a reason first, then it's done. */
export const ReasonOrderAction = ({
  orderId,
  kind,
}: {
  readonly orderId: number;
  readonly kind: keyof typeof KINDS;
}) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const text = KINDS[kind];

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
        {text.button}
      </Button>
    );
  }

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = formText(new FormData(event.currentTarget), "note");

    if (note === "") {
      setError("Give a reason.");

      return;
    }

    startTransition(async () => {
      const action = kind === "cancel" ? cancelOrderAction : closeOrderAction;
      const result = await action({ note, purchaseOrderId: orderId });
      setError(result.error);
    });
  };

  return (
    <form className="grid w-full gap-3" onSubmit={onSubmit}>
      <label className="grid gap-1.5 text-sm font-medium">
        {text.prompt}
        <input
          autoComplete="off"
          // The reason is the only thing to do next, so focusing it is the point.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="field"
          maxLength={500}
          name="note"
          placeholder={text.placeholder}
        />
      </label>
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
          {pending ? "Saving…" : text.confirm}
        </Button>
      </div>
    </form>
  );
};
