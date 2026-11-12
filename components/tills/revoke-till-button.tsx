"use client";

import { useState, useTransition } from "react";

import { revokeTillAction } from "@/app/(app)/tills/actions";

const BUTTON =
  "press rounded-md px-2 py-1 text-sm font-medium disabled:opacity-60";

/** Revoking stops the till posting sales at once, so it takes two clicks. */
export const RevokeTillButton = ({
  tillId,
  name,
}: {
  readonly tillId: number;
  readonly name: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = () => {
    setConfirming(false);
    startTransition(async () => {
      const result = await revokeTillAction(tillId);
      setError(result.error);
    });
  };

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {confirming ? (
        <>
          <span className="text-ink-2 text-xs">Stop {name} posting sales?</span>
          <button
            className={`${BUTTON} text-danger hover:bg-danger-soft`}
            onClick={revoke}
            type="button"
          >
            Yes, revoke
          </button>
          <button
            className={`${BUTTON} text-ink-2 hover:bg-surface-2`}
            onClick={() => {
              setConfirming(false);
            }}
            type="button"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          className={`${BUTTON} text-danger hover:bg-danger-soft`}
          disabled={pending}
          onClick={() => {
            setConfirming(true);
          }}
          type="button"
        >
          {pending ? "Revoking…" : "Revoke"}
          <span className="sr-only"> {name}</span>
        </button>
      )}
      {error === null ? null : (
        <span className="text-danger w-full text-right text-xs" role="alert">
          {error}
        </span>
      )}
    </span>
  );
};
