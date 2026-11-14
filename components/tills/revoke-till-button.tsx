"use client";

import { toast } from "@ui-sdk/react/toast";

import { revokeTillAction } from "@/app/(app)/tills/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Revoking stops the till posting sales at once, so it asks first. */
export const RevokeTillButton = ({
  tillId,
  name,
}: {
  readonly tillId: number;
  readonly name: string;
}) => (
  <ConfirmDialog
    confirmLabel="Revoke key"
    description={`${name} stops posting sales the moment its key is revoked. Sales it already posted stay. To use it again, add it as a new till and paste the new key into the POS.`}
    onConfirm={async () => {
      const result = await revokeTillAction(tillId);

      if (result.error === null) {
        toast.success(`${name}'s key revoked`, {
          description: "It can't post sales any more.",
        });
      }

      return result;
    }}
    pendingLabel="Revoking…"
    title={`Revoke ${name}'s key?`}
    tone="danger"
    trigger={
      <>
        Revoke<span className="sr-only"> {name}</span>
      </>
    }
    triggerSize="sm"
    triggerVariant="destructive"
  />
);
