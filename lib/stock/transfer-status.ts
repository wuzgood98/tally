import type { TransferStatus } from "@/lib/db/schema";

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  cancelled: "Cancelled",
  in_transit: "In transit",
  received: "Received",
};
