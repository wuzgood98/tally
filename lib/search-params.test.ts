import { describe, expect, it } from "vitest";

import { lineParam } from "@/lib/search-params";

describe("lineParam", () => {
  it("reads id:quantity pairs and skips anything malformed", () => {
    expect(lineParam("12:40, 15:10,abc,0:3,7:", 10)).toEqual([
      { id: 12, quantity: 40 },
      { id: 15, quantity: 10 },
    ]);
  });

  it("stops at the limit", () => {
    expect(lineParam("1:1,2:2,3:3", 2)).toHaveLength(2);
  });
});
