/**
 * Adjustment reasons: labels and rules shared by the server and the forms.
 * No database imports, so client components can use it.
 */

import type { AdjustmentReason } from "@/lib/db/schema";

/** Same order as the database enum. */
export const ADJUSTMENT_REASONS = [
  "damaged",
  "expired",
  "theft",
  "count_correction",
  "found",
  "internal_use",
] as const satisfies readonly AdjustmentReason[];

export const REASON_LABELS: Record<AdjustmentReason, string> = {
  count_correction: "Stock count",
  damaged: "Damaged",
  expired: "Expired",
  found: "Found",
  internal_use: "Internal use",
  theft: "Theft or loss",
};

/** Which way each reason moves stock. A count can go either way. */
export const REASON_DIRECTION: Record<
  AdjustmentReason,
  "in" | "out" | "either"
> = {
  count_correction: "either",
  damaged: "out",
  expired: "out",
  found: "in",
  internal_use: "out",
  theft: "out",
};

/** Reasons that need a written explanation, because they're what audits ask about. */
export const NOTE_REQUIRED: ReadonlySet<AdjustmentReason> = new Set([
  "theft",
  "found",
  "internal_use",
]);
