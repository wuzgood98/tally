import { describe, expect, it } from "vitest";

import { deployProblem } from "@/lib/deploy-check";

describe("deployProblem", () => {
  it("stops a Vercel build with no database", () => {
    expect(deployProblem({ VERCEL: "1" })).toContain("DATABASE_URL");
  });

  it("treats a blank DATABASE_URL as missing", () => {
    expect(deployProblem({ DATABASE_URL: "  ", VERCEL: "1" })).not.toBeNull();
  });

  it("accepts Vercel's POSTGRES_URL", () => {
    expect(
      deployProblem({
        POSTGRES_URL: "postgres://db.example/tally",
        VERCEL: "1",
      })
    ).toBeNull();
  });

  it("lets a Vercel build with a database through", () => {
    expect(
      deployProblem({
        DATABASE_URL: "postgres://db.example/tally",
        VERCEL: "1",
      })
    ).toBeNull();
  });

  it("leaves local builds on PGlite alone", () => {
    expect(deployProblem({})).toBeNull();
  });
});
