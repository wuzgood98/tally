import type { FlashMessage } from "@/lib/flash";
import { formatUnits } from "@/lib/format";

export type TransferStep = "sent" | "received" | "cancelled";

interface TransferSummary {
  readonly number: string;
  readonly fromName: string;
  readonly toName: string;
  readonly lines: readonly {
    readonly quantitySent: number;
    readonly quantityReceived: number | null;
  }[];
}

/** The toast after sending, receiving or cancelling a transfer. */
export const transferNotice = (
  step: TransferStep,
  transfer: TransferSummary
): FlashMessage => {
  let sent = 0;
  let received = 0;

  for (const line of transfer.lines) {
    sent += line.quantitySent;
    received += line.quantityReceived ?? 0;
  }

  if (step === "sent") {
    return {
      action: { href: "/transfers/new", label: "Send another" },
      description: `${formatUnits(sent)} on the way from ${transfer.fromName} to ${transfer.toName}.`,
      title: `${transfer.number} sent`,
    };
  }

  if (step === "cancelled") {
    return {
      description: `${formatUnits(sent)} back at ${transfer.fromName}.`,
      title: `${transfer.number} cancelled`,
    };
  }

  const lost = sent - received;
  const added = `${formatUnits(received)} added to ${transfer.toName}`;

  return {
    description:
      lost > 0
        ? `${added}; ${formatUnits(lost)} recorded as lost in transit.`
        : `${added}.`,
    title: `${transfer.number} received`,
  };
};
