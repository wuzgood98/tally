import { describe, expect, it, vi } from "vitest";

import {
  createSavedCopies,
  formatSavedAt,
  SAVED_AT_HEADER,
  savedAtOf,
} from "@/lib/till/client/saved-copy";
import { statusLine } from "@/lib/till/client/status-text";
import { STARTING } from "@/lib/till/client/sync";
import type { SyncStatus } from "@/lib/till/client/sync";

const NOW = new Date("2026-11-16T15:30:00Z");
const MORNING = new Date("2026-11-16T09:14:00Z");
const YESTERDAY = new Date("2026-11-15T18:05:00Z");

const stamped = (value: string): Response =>
  Response.json({}, { headers: { [SAVED_AT_HEADER]: value } });

describe("reading the service worker's stamp", () => {
  it("takes the stamp on a saved copy and nothing on a live answer", () => {
    expect(savedAtOf(stamped(MORNING.toISOString()))).toEqual(MORNING);
    expect(savedAtOf(Response.json({}))).toBeNull();
  });

  it("ignores a stamp that isn't a time", () => {
    expect(savedAtOf(stamped("yesterday-ish"))).toBeNull();
  });
});

describe("the saved copies on screen", () => {
  it("reports the oldest copy until each source is live again", () => {
    const copies = createSavedCopies();
    const listener = vi.fn<() => void>();
    copies.subscribe(listener);

    copies.report("products", YESTERDAY, NOW);
    copies.report("stockLevels", MORNING, NOW);
    expect(copies.getSnapshot()).toEqual({ savedAt: YESTERDAY, seenAt: NOW });

    copies.report("products", null, NOW);
    expect(copies.getSnapshot()?.savedAt).toEqual(MORNING);

    copies.report("stockLevels", null, NOW);
    expect(copies.getSnapshot()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("keeps the same snapshot, and stays quiet, when nothing changed that day", () => {
    const copies = createSavedCopies();
    const listener = vi.fn<() => void>();
    copies.subscribe(listener);

    copies.report("products", null, NOW);
    copies.report("stockLevels", MORNING, MORNING);
    const first = copies.getSnapshot();
    copies.report("stockLevels", new Date(MORNING), NOW);

    expect(copies.getSnapshot()).toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tells the age against the new day once midnight passes", () => {
    const copies = createSavedCopies();
    const nextMorning = new Date("2026-11-17T07:00:00Z");

    copies.report("stockLevels", MORNING, NOW);
    copies.report("stockLevels", MORNING, nextMorning);

    expect(copies.getSnapshot()?.seenAt).toEqual(nextMorning);
  });

  it("stops telling a listener once it unsubscribes", () => {
    const copies = createSavedCopies();
    const listener = vi.fn<() => void>();
    const unsubscribe = copies.subscribe(listener);

    unsubscribe();
    copies.report("products", MORNING, NOW);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("how old the copy is, in words", () => {
  it("says just the time for a copy from today, and the day too for an older one", () => {
    expect(formatSavedAt(MORNING, NOW)).toBe("09:14");
    expect(formatSavedAt(YESTERDAY, NOW)).toBe("15 Nov, 18:05");
  });
});

describe("the till's status line", () => {
  const ready: SyncStatus = { ...STARTING, canQueue: true, ready: true };

  it("says every sale is in when online with live data", () => {
    expect(statusLine(ready, null)).toMatchObject({
      kind: "sent",
      text: "Online · every sale has reached Tally.",
    });
  });

  it("adds the copy's age when offline", () => {
    expect(
      statusLine(
        { ...ready, online: false, queued: 2 },
        { savedAt: MORNING, seenAt: NOW }
      )
    ).toMatchObject({
      kind: "offline",
      text: "Offline · 2 sales saved on this till, sent when the connection is back. Prices and stock counts are from 09:14.",
      tone: "warn",
    });
  });

  it("leaves the age out when the till went offline after loading live", () => {
    expect(statusLine({ ...ready, online: false }, null).text).toBe(
      "Offline. Keep charging: sales are saved on this till and sent when the connection is back."
    );
  });

  it("doesn't claim to be online when the browser is but Tally can't be reached", () => {
    expect(
      statusLine(ready, { savedAt: YESTERDAY, seenAt: NOW })
    ).toMatchObject({
      kind: "offline",
      text: "Can't reach Tally. Keep charging: sales are saved on this till and sent when Tally answers. Prices and stock counts are from 15 Nov, 18:05.",
      tone: "warn",
    });
    expect(
      statusLine({ ...ready, queued: 1 }, { savedAt: MORNING, seenAt: NOW })
        .text
    ).toBe(
      "Can't reach Tally · 1 sale saved on this till, sent when Tally answers. Prices and stock counts are from 09:14."
    );
  });

  it("puts a second tab's warning first", () => {
    expect(
      statusLine(
        { ...ready, canQueue: false, online: false },
        { savedAt: MORNING, seenAt: NOW }
      ).kind
    ).toBe("no-queue");
  });
});
