/**
 * The one line the till shows above the scan box about its connection, its
 * queue and, when Tally can't be reached, how old its prices and counts are.
 * Pure, so the wording is tested without rendering; `TillSyncStatus` adds the
 * icon.
 */

import { formatSales } from "@/lib/format";
import { formatSavedAt } from "@/lib/till/client/saved-copy";
import type { SavedSnapshot } from "@/lib/till/client/saved-copy";
import type { SyncStatus } from "@/lib/till/client/sync";

export type StatusKind = "no-queue" | "offline" | "sending" | "sent";

export interface StatusLine {
  readonly kind: StatusKind;
  readonly text: string;
  readonly tone: "quiet" | "warn";
}

/** " Prices and stock counts are from 09:14." or nothing for live data. */
const ageNote = (saved: SavedSnapshot | null): string =>
  saved === null
    ? ""
    : ` Prices and stock counts are from ${formatSavedAt(saved.savedAt, saved.seenAt)}.`;

/**
 * From most to least pressing. A browser that says it's online while the
 * till's data came from the saved copy means Tally itself can't be reached
 * (the server, a dead router, a captive portal), so that reads as offline too.
 */
export const statusLine = (
  status: SyncStatus,
  saved: SavedSnapshot | null
): StatusLine => {
  if (!status.canQueue) {
    return {
      kind: "no-queue",
      text: "This tab can't keep sales without a connection: the till is open in another tab, or the browser won't store them. Charging needs a connection here.",
      tone: "warn",
    };
  }

  const age = ageNote(saved);

  if (!status.online) {
    return {
      kind: "offline",
      text:
        status.queued === 0
          ? `Offline. Keep charging: sales are saved on this till and sent when the connection is back.${age}`
          : `Offline · ${formatSales(status.queued)} saved on this till, sent when the connection is back.${age}`,
      tone: "warn",
    };
  }

  if (saved !== null) {
    return {
      kind: "offline",
      text:
        status.queued === 0
          ? `Can't reach Tally. Keep charging: sales are saved on this till and sent when Tally answers.${age}`
          : `Can't reach Tally · ${formatSales(status.queued)} saved on this till, sent when Tally answers.${age}`,
      tone: "warn",
    };
  }

  if (status.queued > 0) {
    const reason =
      status.lastError === null ? "" : ` Last try: ${status.lastError}`;

    return {
      kind: "sending",
      text: `Sending ${formatSales(status.queued)} saved on this till.${reason}`,
      tone: status.lastError === null ? "quiet" : "warn",
    };
  }

  return {
    kind: "sent",
    text: "Online · every sale has reached Tally.",
    tone: "quiet",
  };
};
