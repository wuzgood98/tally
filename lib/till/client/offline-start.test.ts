import { describe, expect, it } from "vitest";

import { warmUrls } from "@/lib/till/client/offline-start";

const ORIGIN = "https://tally.test";

describe("warmUrls", () => {
  it("lists the page, the till's data and this site's static files, once each", () => {
    expect(
      warmUrls("/till", ORIGIN, [
        `${ORIGIN}/_next/static/chunks/a.js`,
        `${ORIGIN}/_next/static/chunks/a.js`,
        `${ORIGIN}/api/till/catalogue`,
        "https://elsewhere.test/_next/static/b.js",
        "not a url",
      ])
    ).toEqual([
      "/till",
      "/api/till/catalogue",
      "/api/till/stock-levels",
      "/api/till/sales",
      `${ORIGIN}/_next/static/chunks/a.js`,
    ]);
  });
});
