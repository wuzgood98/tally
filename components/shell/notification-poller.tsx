"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { NotificationFeed } from "@/components/shell/notification-bell";
import {
  notificationSummary,
  POLL_INTERVAL_MS,
  POLL_MIN_GAP_MS,
  pollOutcome,
} from "@/lib/notifications/poll";

const SUMMARY_URL = "/api/notifications";

/** The latest summary, or null when there's nothing usable (offline, a blip). */
const fetchSummary = async () => {
  try {
    const response = await fetch(SUMMARY_URL, { cache: "no-store" });

    if (response.status === 401 || response.status === 404) {
      return "stop" as const;
    }

    if (!response.ok) {
      return null;
    }

    const parsed = notificationSummary.safeParse(await response.json());

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
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
    const latest = await fetchSummary();
    busy.current = false;

    if (latest === "stop") {
      // Signed out, or no longer someone who's notified.
      stopped.current = true;

      return;
    }

    if (latest === null) {
      return;
    }

    const outcome = pollOutcome(feed, latest);

    if (outcome.announcement !== null) {
      setAnnouncement(outcome.announcement);
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
