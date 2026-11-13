import type { StockRequestStatus } from "@/lib/db/schema";
import { STOCK_REQUEST_STATUS_LABELS } from "@/lib/stock/request-status";
import { cn } from "@/lib/utils";

const STYLES: Record<StockRequestStatus, string> = {
  cancelled: "bg-surface-2 text-ink-2",
  fulfilled: "bg-brand-soft text-good",
  requested: "bg-warn-soft text-warn",
};

export const RequestStatusBadge = ({
  status,
}: {
  readonly status: StockRequestStatus;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
      STYLES[status]
    )}
  >
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    {STOCK_REQUEST_STATUS_LABELS[status]}
  </span>
);
