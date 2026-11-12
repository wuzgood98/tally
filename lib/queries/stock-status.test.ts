import { describe, expect, it } from "vitest";

import { stockStatus } from "@/lib/queries/stock-status";

describe("stockStatus", () => {
  it("asks for a count when tills sold more than the record held", () => {
    expect(stockStatus(-2, 10)).toBe("count");
  });

  it("tells empty, low and healthy apart", () => {
    expect(stockStatus(0, 10)).toBe("out");
    expect(stockStatus(10, 10)).toBe("low");
    expect(stockStatus(11, 10)).toBe("ok");
  });
});
