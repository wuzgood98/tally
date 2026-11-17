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

/** Why the till can't send, and when its sales will go. */
interface CutOffReason {
  readonly label: string;
  readonly until: string;
}

const OFFLINE: CutOffReason = {
  label: "Offline",
  until: "the connection is back",
};

const NO_ANSWER: CutOffReason = {
  label: "Can't reach Tally",
  until: "Tally answers",
};

/** "Offline. Keep charging: …" or "Offline · 2 sales saved …", plus the copy's age. */
const cutOff = (
  { label, until }: CutOffReason,
  queued: number,
  saved: SavedSnapshot | null
): StatusLine => ({
  kind: "offline",
  text:
    queued === 0
      ? `${label}. Keep charging: sales are saved on this till and sent when ${until}.${ageNote(saved)}`
      : `${label} · ${formatSales(queued)} saved on this till, sent when ${until}.${ageNote(saved)}`,
  tone: "warn",
});

/** The usual line: online, nothing waiting. The till's loading skeleton is drawn with it. */
export const ONLINE_LINE: StatusLine = {
  kind: "sent",
  text: "Online · every sale has reached Tally.",
  tone: "quiet",
};

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

  if (!status.online) {
    return cutOff(OFFLINE, status.queued, saved);
  }

  if (saved !== null) {
    return cutOff(NO_ANSWER, status.queued, saved);
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

  return ONLINE_LINE;
};
