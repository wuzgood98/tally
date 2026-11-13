import { describe, expect, it } from "vitest";

import { pickValue, scopeOf, switchValue } from "@/lib/palette-branches";

describe("palette branch commands", () => {
  it("reads the scope back out of either kind of branch command", () => {
    expect(scopeOf(pickValue("all"))).toBe("all");
    expect(scopeOf(pickValue("SPX"))).toBe("SPX");
    expect(scopeOf(switchValue("KSI"))).toBe("KSI");
    expect(scopeOf("go:/low-stock")).toBeNull();
  });
});
