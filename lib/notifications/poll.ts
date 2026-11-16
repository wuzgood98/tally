/**
 * What the bell does with a poll's answer. The server's page already shows
 * `shown`; `latest` is what `/api/notifications` says now. Pure, so the rules
 * are tested without a browser.
 */

import { z } from "zod";

export const notificationSummary = z.object({
  /** The newest notification's id, or 0 for none. */
  latestId: z.number().int().nonnegative(),
  unread: z.number().int().nonnegative(),
});

export type NotificationSummary = z.infer<typeof notificationSummary>;

/** Poll this often while the tab is visible. */
export const POLL_INTERVAL_MS = 60_000;

/** Coming back to the tab polls at once, unless the last poll was this recent. */
export const POLL_MIN_GAP_MS = 10_000;

export interface PollOutcome {
  /** Re-render the layout, so the bell and every nav badge catch up. */
  readonly refresh: boolean;
  /** What a screen reader hears, or null to stay quiet. */
  readonly announcement: string | null;
}

export const pollOutcome = (
  shown: NotificationSummary,
  latest: NotificationSummary
): PollOutcome => {
  const arrived = latest.latestId > shown.latestId;
  // Read in another tab, for instance: catch up without a word.
  const changed = arrived || latest.unread !== shown.unread;

  if (!arrived || latest.unread <= shown.unread) {
    return { announcement: null, refresh: changed };
  }

  const fresh = latest.unread - shown.unread;

  return {
    announcement:
      fresh === 1 ? "1 new notification" : `${fresh} new notifications`,
    refresh: true,
  };
};
