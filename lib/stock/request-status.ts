import type { StockRequestStatus } from "@/lib/db/schema";

/** Kept free of the schema so client components can import it. */
export const STOCK_REQUEST_STATUSES = [
  "requested",
  "fulfilled",
  "cancelled",
] as const satisfies readonly StockRequestStatus[];

export const STOCK_REQUEST_STATUS_LABELS: Record<StockRequestStatus, string> = {
  cancelled: "Cancelled",
  fulfilled: "Sent",
  requested: "Waiting",
};
