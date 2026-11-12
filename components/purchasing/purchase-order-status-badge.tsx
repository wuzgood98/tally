import type { PurchaseOrderStatus } from "@/lib/db/schema";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/lib/stock/purchase-order-status";
import { cn } from "@/lib/utils";

const STYLES: Record<PurchaseOrderStatus, string> = {
  approved: "bg-brand-soft text-brand",
  cancelled: "bg-surface-2 text-ink-2",
  closed: "bg-surface-2 text-ink-2",
  draft: "bg-warn-soft text-warn",
  partly_received: "bg-brand-soft text-brand",
  received: "bg-brand-soft text-good",
};

export const PurchaseOrderStatusBadge = ({
  status,
}: {
  readonly status: PurchaseOrderStatus;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
      STYLES[status]
    )}
  >
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    {PURCHASE_ORDER_STATUS_LABELS[status]}
  </span>
);
