import type { TransferStatus } from "@/lib/db/schema";
import { TRANSFER_STATUS_LABELS } from "@/lib/stock/transfer-status";
import { cn } from "@/lib/utils";

const STYLES: Record<TransferStatus, string> = {
  cancelled: "bg-surface-2 text-ink-2",
  in_transit: "bg-warn-soft text-warn",
  received: "bg-brand-soft text-good",
};

/** A received transfer with units missing reads "Received short". */
export const TransferStatusBadge = ({
  status,
  unitsLost = 0,
}: {
  readonly status: TransferStatus;
  readonly unitsLost?: number;
}) => {
  const short = status === "received" && unitsLost > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        short ? "bg-danger-soft text-danger" : STYLES[status]
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {short ? "Received short" : TRANSFER_STATUS_LABELS[status]}
    </span>
  );
};
