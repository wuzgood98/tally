/**
 * What the bell does with a poll's answer. The server's page already shows
 * `shown`; `latest` is what `/api/notifications` says now. Pure, so the rules
 * are tested without a browser.
 */

import { z } from "zod";

import type { NotificationDay } from "@/lib/notifications/describe";

export const notificationSummary = z.object({
  /** The newest notification's id, or 0 for none. */
  latestId: z.number().int().nonnegative(),
  unread: z.number().int().nonnegative(),
});

export type NotificationSummary = z.infer<typeof notificationSummary>;

/** A poll's answer: the summary, plus what's unread since the page's newest. */
export const notificationPoll = notificationSummary.extend({
  /** Unread notifications newer than the `after` id the poll sent. */
  fresh: z.number().int().nonnegative(),
});

export type NotificationPoll = z.infer<typeof notificationPoll>;

/** What the layout hands the bell and the poller. */
export interface NotificationFeed extends NotificationSummary {
  readonly days: readonly NotificationDay[];
}

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
  latest: NotificationPoll
): PollOutcome => {
  const arrived = latest.latestId > shown.latestId;
  // Read in another tab, for instance: catch up without a word.
  const changed = arrived || latest.unread !== shown.unread;

  // Only news that's still unread is worth saying, however the total moved
  // (one read elsewhere while one arrives leaves it level).
  if (latest.fresh === 0) {
    return { announcement: null, refresh: changed };
  }

  return {
    announcement:
      latest.fresh === 1
        ? "1 new notification"
        : `${latest.fresh} new notifications`,
    refresh: true,
  };
};
