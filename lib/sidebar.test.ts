import { describe, expect, it } from "vitest";

import { isSidebarCollapsed } from "./sidebar";

describe("isSidebarCollapsed", () => {
  it("collapses only for the saved value", () => {
    expect(isSidebarCollapsed({ value: "collapsed" })).toBe(true);
    expect(isSidebarCollapsed(undefined)).toBe(false);
    expect(isSidebarCollapsed({ value: "expanded" })).toBe(false);
    expect(isSidebarCollapsed({ value: "" })).toBe(false);
  });
});
