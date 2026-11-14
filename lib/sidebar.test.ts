import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isSidebarCollapsed, SIDEBAR_MEDIA } from "./sidebar";

describe("isSidebarCollapsed", () => {
  it("collapses only for the saved value", () => {
    expect(isSidebarCollapsed({ value: "collapsed" })).toBe(true);
    expect(isSidebarCollapsed(undefined)).toBe(false);
    expect(isSidebarCollapsed({ value: "expanded" })).toBe(false);
    expect(isSidebarCollapsed({ value: "" })).toBe(false);
  });
});

describe("SIDEBAR_MEDIA", () => {
  it("matches the rail variant's breakpoint in globals.css", () => {
    const css = readFileSync(
      path.join(import.meta.dirname, "..", "app", "globals.css"),
      "utf-8"
    );

    expect(css).toContain(`@media ${SIDEBAR_MEDIA}`);
  });
});
