import { describe, expect, it } from "vitest";

import { ASK_VALUE, askScore, takesResultHighlight } from "@/lib/palette-ask";
import {
  documentValue,
  LOWEST_RESULT_SCORE,
  productValue,
  SEE_ALL_PRODUCTS,
} from "@/lib/palette-results";

describe("askScore", () => {
  it("gives way to every result once there's a search, and always shows", () => {
    expect(askScore("ri")).toBeGreaterThan(0);
    expect(askScore("ri")).toBeLessThan(LOWEST_RESULT_SCORE);
    expect(askScore(" r ")).toBe(1);
    expect(askScore("")).toBe(1);
  });
});

describe("takesResultHighlight", () => {
  it("takes over from nothing, Ask and old results, not from a page", () => {
    expect(takesResultHighlight(null)).toBe(true);
    expect(takesResultHighlight(ASK_VALUE)).toBe(true);
    expect(takesResultHighlight(productValue(9))).toBe(true);
    expect(takesResultHighlight(documentValue("PO-SPX-000012"))).toBe(true);
    expect(takesResultHighlight(SEE_ALL_PRODUCTS)).toBe(true);
    expect(takesResultHighlight("go:/low-stock")).toBe(false);
  });
});
