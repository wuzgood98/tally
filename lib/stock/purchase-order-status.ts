import type { PurchaseOrderStatus } from "@/lib/db/schema";

/** Kept free of the schema so client components can import it. */
export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "approved",
  "partly_received",
  "received",
  "closed",
  "cancelled",
] as const satisfies readonly PurchaseOrderStatus[];

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> =
  {
    approved: "Approved",
    cancelled: "Cancelled",
    closed: "Closed short",
    draft: "Draft",
    partly_received: "Part delivered",
    received: "Received",
  };
