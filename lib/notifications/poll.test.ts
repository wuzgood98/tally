import { describe, expect, it } from "vitest";

import { pollOutcome } from "@/lib/notifications/poll";

describe("pollOutcome", () => {
  it("stays quiet when nothing changed", () => {
    expect(
      pollOutcome({ latestId: 9, unread: 2 }, { latestId: 9, unread: 2 })
    ).toEqual({ announcement: null, refresh: false });
  });

  it("refreshes and announces new notifications", () => {
    expect(
      pollOutcome({ latestId: 9, unread: 0 }, { latestId: 11, unread: 1 })
    ).toEqual({ announcement: "1 new notification", refresh: true });
    expect(
      pollOutcome({ latestId: 9, unread: 1 }, { latestId: 12, unread: 4 })
    ).toEqual({ announcement: "3 new notifications", refresh: true });
  });

  it("catches up silently when they were read elsewhere", () => {
    expect(
      pollOutcome({ latestId: 9, unread: 3 }, { latestId: 9, unread: 0 })
    ).toEqual({ announcement: null, refresh: true });
  });

  it("catches up silently when new ones arrive already read", () => {
    expect(
      pollOutcome({ latestId: 9, unread: 2 }, { latestId: 10, unread: 0 })
    ).toEqual({ announcement: null, refresh: true });
  });
});
