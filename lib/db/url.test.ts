import { describe, expect, it } from "vitest";

import { databaseUrl } from "@/lib/db/url";

describe("databaseUrl", () => {
  it("prefers DATABASE_URL", () => {
    expect(
      databaseUrl({
        DATABASE_URL: "postgres://own/tally",
        POSTGRES_URL: "postgres://vercel/tally",
      })
    ).toBe("postgres://own/tally");
  });

  it("falls back to Vercel's POSTGRES_URL", () => {
    expect(
      databaseUrl({
        DATABASE_URL: " ",
        POSTGRES_URL: "postgres://vercel/tally",
      })
    ).toBe("postgres://vercel/tally");
  });

  it("means PGlite when neither is set", () => {
    expect(databaseUrl({})).toBeNull();
  });
});
