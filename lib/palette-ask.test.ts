import { describe, expect, it } from "vitest";

import { askScore } from "@/lib/palette-ask";
import { SEE_ALL_PRODUCTS, resultScore } from "@/lib/palette-results";

describe("askScore", () => {
  it("gives way to every result while searching, and always shows", () => {
    const lowestResult = resultScore(SEE_ALL_PRODUCTS, "rice", []) ?? 0;

    expect(askScore(true)).toBeGreaterThan(0);
    expect(askScore(true)).toBeLessThan(lowestResult);
    expect(askScore(false)).toBe(1);
  });
});
