"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  notificationPoll,
  POLL_INTERVAL_MS,
  POLL_MIN_GAP_MS,
  pollOutcome,
} from "@/lib/notifications/poll";
import type {
  NotificationFeed,
  NotificationPoll,
} from "@/lib/notifications/poll";

const SUMMARY_URL = "/api/notifications";

/**
 * How long the live region stays empty before an announcement. Emptying it
 * first means the same words ("1 new notification") are read out again.
 */
const ANNOUNCE_GAP_MS = 100;

type FetchResult =
  | { readonly kind: "answer"; readonly answer: NotificationPoll }
  /** Signed out, or no longer someone who's notified: stop polling. */
  | { readonly kind: "stop" }
  /** Nothing usable this time (offline, a blip): try again later. */
  | { readonly kind: "skip" };

const SKIP: FetchResult = { kind: "skip" };

const fetchSummary = async (after: number): Promise<FetchResult> => {
  try {
    const response = await fetch(`${SUMMARY_URL}?after=${after}`, {
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 404) {
      return { kind: "stop" };
    }

    if (!response.ok) {
      return SKIP;
    }

    const parsed = notificationPoll.safeParse(await response.json());

    return parsed.success ? { answer: parsed.data, kind: "answer" } : SKIP;
  } catch {
    return SKIP;
  }
};

interface NotificationPollerProps {
  /** Null for people who are never notified: nothing to poll. */
  readonly feed: NotificationFeed | null;
}

/**
 * Checks for news once a minute while the tab is visible, and as soon as the
 * person comes back to it. Something new re-renders the layout (the bell and
 * every nav badge) and is announced to screen readers. One per page, however
 * many bells there are. A route handler, not a server action: actions run one
 * at a time, so a poll could hold up a sale at the till.
 */
const Poller = ({ feed }: { readonly feed: NotificationFeed }) => {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState("");
  const lastPoll = useRef(0);
  const busy = useRef(false);
  const stopped = useRef(false);
  const announceTimer = useRef<number | undefined>(undefined);

  const announce = (text: string) => {
    setAnnouncement("");
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => {
      setAnnouncement(text);
    }, ANNOUNCE_GAP_MS);
  };

  const poll = useEffectEvent(async () => {
    const now = Date.now();
    const tooSoon = now - lastPoll.current < POLL_MIN_GAP_MS;

    if (stopped.current || busy.current || tooSoon) {
      return;
    }

    if (document.visibilityState !== "visible") {
      return;
    }

    busy.current = true;
    lastPoll.current = now;
    const result = await fetchSummary(feed.latestId);
    busy.current = false;

    if (result.kind === "stop") {
      stopped.current = true;

      return;
    }

    if (result.kind === "skip") {
      return;
    }

    const outcome = pollOutcome(feed, result.answer);

    if (outcome.announcement !== null) {
      announce(outcome.announcement);
    }

    if (outcome.refresh) {
      router.refresh();
    }
  });

  useEffect(() => {
    // The page was just rendered with fresh figures; the first poll can wait.
    lastPoll.current = Date.now();

    const timer = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    const onReturn = () => {
      void poll();
    };

    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(announceTimer.current);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, []);

  return (
    <output aria-live="polite" className="sr-only">
      {announcement}
    </output>
  );
};

export const NotificationPoller = ({ feed }: NotificationPollerProps) =>
  feed === null ? null : <Poller feed={feed} />;
