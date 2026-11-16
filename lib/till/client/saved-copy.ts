/**
 * When the till's catalogue or shelf counts came from the copy the service
 * worker saved (`public/till-sw.js`) rather than from Tally, and how old that
 * copy is. The worker stamps every copy it keeps with `X-Tally-Saved-At`;
 * an answer straight from Tally has no stamp, so the header alone tells the
 * two apart.
 */

import { formatDateTime, formatTime } from "@/lib/format";

/** Set by the service worker on every copy it keeps. */
export const SAVED_AT_HEADER = "X-Tally-Saved-At";

/** What the till shows from a saved copy when Tally can't be reached. */
export type SavedSource = "products" | "stockLevels";

/** The stamp on an answer: when the worker saved it, or null for a live answer. */
export const savedAtOf = (response: Response): Date | null => {
  const stamp = response.headers.get(SAVED_AT_HEADER);

  if (stamp === null) {
    return null;
  }

  const savedAt = new Date(stamp);

  return Number.isNaN(savedAt.getTime()) ? null : savedAt;
};

/** Accra keeps GMT all year, so its day is the UTC day. */
const isSameDay = (a: Date, b: Date): boolean =>
  a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/** The oldest saved copy on screen, and when the till last heard about it. */
export interface SavedSnapshot {
  readonly savedAt: Date;
  /** When the latest answer arrived: the "now" its age is told against. */
  readonly seenAt: Date;
}

export interface SavedCopies {
  /** Records the latest answer for `source`: its stamp, or null when it was live. */
  report: (source: SavedSource, savedAt: Date | null, seenAt?: Date) => void;
  subscribe: (listener: () => void) => () => void;
  /**
   * The oldest copy on screen, or null when everything came from Tally.
   * Stable between reports, and changes only when the copy does or a new
   * day begins (so "09:14" becomes "16 Nov, 09:14" after midnight).
   */
  getSnapshot: () => SavedSnapshot | null;
}

export const createSavedCopies = (): SavedCopies => {
  const stamps = new Map<SavedSource, Date>();
  const listeners = new Set<() => void>();
  let snapshot: SavedSnapshot | null = null;

  const oldestStamp = (): Date | null => {
    let found: Date | null = null;

    for (const stamp of stamps.values()) {
      if (found === null || stamp < found) {
        found = stamp;
      }
    }

    return found;
  };

  const isUnchanged = (savedAt: Date | null, seenAt: Date): boolean => {
    if (savedAt === null || snapshot === null) {
      return savedAt === snapshot;
    }

    return (
      savedAt.getTime() === snapshot.savedAt.getTime() &&
      isSameDay(seenAt, snapshot.seenAt)
    );
  };

  return {
    getSnapshot: () => snapshot,
    report: (source, savedAt, seenAt = new Date()) => {
      if (savedAt === null) {
        stamps.delete(source);
      } else {
        stamps.set(source, savedAt);
      }

      const oldest = oldestStamp();

      if (isUnchanged(oldest, seenAt)) {
        return;
      }

      snapshot = oldest === null ? null : { savedAt: oldest, seenAt };

      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/** "09:14" for a copy saved today, "15 Nov, 09:14" for an older one (Accra time). */
export const formatSavedAt = (savedAt: Date, now: Date): string =>
  isSameDay(savedAt, now) ? formatTime(savedAt) : formatDateTime(savedAt);
