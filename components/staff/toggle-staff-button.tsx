"use client";

import { useState, useTransition } from "react";

import { toggleStaff } from "@/app/(app)/staff/actions";

interface ToggleStaffButtonProps {
  readonly userId: string;
  readonly name: string;
  readonly active: boolean;
}

const BUTTON =
  "press rounded-md px-2 py-1 text-sm font-medium disabled:opacity-60";

/**
 * Deactivating signs someone out everywhere, so it takes two clicks: the
 * first asks, the second does it. Reactivating is one click.
 */
export const ToggleStaffButton = ({
  userId,
  name,
  active,
}: ToggleStaffButtonProps) => {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setConfirming(false);
    startTransition(async () => {
      const result = await toggleStaff(userId, !active);
      setError(result.error);
    });
  };

  if (!active) {
    return (
      <button
        className={`${BUTTON} text-brand hover:bg-brand-soft`}
        disabled={pending}
        onClick={run}
        type="button"
      >
        {pending ? "Saving…" : "Reactivate"}
        <span className="sr-only"> {name}</span>
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {confirming ? (
        <>
          <span className="text-ink-2 text-xs">
            Sign {name.split(" ")[0]} out everywhere?
          </span>
          <button
            className={`${BUTTON} text-danger hover:bg-danger-soft`}
            onClick={run}
            type="button"
          >
            Yes, deactivate
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
          {pending ? "Saving…" : "Deactivate"}
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
