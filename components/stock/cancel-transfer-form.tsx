"use client";

import { cancelTransferAction } from "@/app/(app)/transfers/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CancelTransferFormProps {
  readonly transferId: number;
  readonly fromName: string;
}

/**
 * Calling a transfer back puts its stock back at the sender, so it asks why
 * first, in a dialog, and only then does it.
 */
export const CancelTransferForm = ({
  transferId,
  fromName,
}: CancelTransferFormProps) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-ink-2 text-sm">
      Truck turned back, or sent to the wrong branch? Cancelling returns every
      unit to {fromName}.
    </p>
    <ConfirmDialog
      cancelLabel="Keep it"
      confirmLabel={`Cancel and return to ${fromName}`}
      description={`Every unit goes back on ${fromName}'s shelf, and the receiving branch stops expecting it. This can't be undone.`}
      onConfirm={async (note) =>
        await cancelTransferAction({ note, transferId })
      }
      pendingLabel="Cancelling…"
      reason={{
        label: "Why is it being cancelled?",
        missing: "Say why the transfer is being cancelled.",
        placeholder: "e.g. Van broke down at Tema; goods back on the shelf",
      }}
      title="Cancel this transfer?"
      tone="danger"
      trigger="Cancel transfer"
      triggerVariant="destructive"
    />
  </div>
);
