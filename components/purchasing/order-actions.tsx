"use client";

import {
  approveOrderAction,
  cancelOrderAction,
  closeOrderAction,
} from "@/app/(app)/purchase-orders/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Approving is what sends the order, so it asks once more. */
export const ApproveOrderButton = ({
  orderId,
  total,
}: {
  readonly orderId: number;
  readonly total: string;
}) => (
  <ConfirmDialog
    cancelLabel="Not yet"
    confirmLabel="Approve order"
    description={`This commits ${total} with the supplier. The order can be printed and sent once it's approved, and it can't go back to draft.`}
    onConfirm={async () => await approveOrderAction(orderId)}
    pendingLabel="Approving…"
    title={`Approve this order for ${total}?`}
    trigger="Approve order"
  />
);

const KINDS = {
  cancel: {
    button: "Cancel order",
    confirm: "Cancel the order",
    description:
      "Nothing more will be received against it. If it was already sent, let the supplier know. This can't be undone.",
    missing: "Say why the order is being cancelled.",
    pending: "Cancelling…",
    placeholder: "e.g. Supplier can't deliver before the promo ends",
    prompt: "Why is it being cancelled?",
    title: "Cancel this order?",
  },
  close: {
    button: "Close short",
    confirm: "Close it short",
    description:
      "What arrived stays received; the rest stops being expected. This can't be undone.",
    missing: "Say why you're no longer waiting for the rest.",
    pending: "Closing…",
    placeholder: "e.g. Supplier has discontinued the rest",
    prompt: "Why stop waiting for the rest?",
    title: "Close this order short?",
  },
} as const;

/** Cancelling or closing short: a dialog asks for the reason, then it's done. */
export const ReasonOrderAction = ({
  orderId,
  kind,
}: {
  readonly orderId: number;
  readonly kind: keyof typeof KINDS;
}) => {
  const text = KINDS[kind];
  const action = kind === "cancel" ? cancelOrderAction : closeOrderAction;

  return (
    <ConfirmDialog
      cancelLabel="Keep it"
      confirmLabel={text.confirm}
      description={text.description}
      onConfirm={async (note) =>
        await action({ note, purchaseOrderId: orderId })
      }
      pendingLabel={text.pending}
      reason={{
        label: text.prompt,
        missing: text.missing,
        placeholder: text.placeholder,
      }}
      title={text.title}
      tone="danger"
      trigger={text.button}
      triggerVariant="destructive"
    />
  );
};
