"use client";

import { useState, useTransition } from "react";

import { toggleStaff } from "@/app/(app)/staff/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ToggleStaffButtonProps {
  readonly userId: string;
  readonly name: string;
  readonly active: boolean;
}

/** Reactivating gives access back and takes nothing away: one click. */
const ReactivateButton = ({
  userId,
  name,
}: Omit<ToggleStaffButtonProps, "active">) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      <Button
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await toggleStaff(userId, true);
            setError(result.error);
          });
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        {pending ? "Saving…" : "Reactivate"}
        <span className="sr-only"> {name}</span>
      </Button>
      {error === null ? null : (
        <span className="text-danger w-full text-right text-xs" role="alert">
          {error}
        </span>
      )}
    </span>
  );
};

/** Deactivating signs someone out everywhere, so it asks first. */
export const ToggleStaffButton = ({
  userId,
  name,
  active,
}: ToggleStaffButtonProps) =>
  active ? (
    <ConfirmDialog
      confirmLabel="Deactivate"
      description={`${name} is signed out on every device and can't sign in again until head office reactivates the account. Their sales, counts and other records stay as they are.`}
      onConfirm={async () => await toggleStaff(userId, false)}
      pendingLabel="Deactivating…"
      title={`Deactivate ${name}?`}
      tone="danger"
      trigger={
        <>
          Deactivate<span className="sr-only"> {name}</span>
        </>
      }
      triggerSize="sm"
      triggerVariant="destructive"
    />
  ) : (
    <ReactivateButton name={name} userId={userId} />
  );
