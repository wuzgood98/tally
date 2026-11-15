import { describe, expect, it } from "vitest";

import { isScanEnter } from "@/lib/scan-key";

const key = (overrides: Partial<Parameters<typeof isScanEnter>[0]> = {}) => ({
  altKey: false,
  ctrlKey: false,
  key: "Enter",
  metaKey: false,
  ...overrides,
});

describe("isScanEnter", () => {
  it("takes the plain Enter a scanner sends", () => {
    expect(isScanEnter(key())).toBe(true);
  });

  it("leaves Ctrl/Cmd+Enter to the till's charge shortcut", () => {
    expect(isScanEnter(key({ ctrlKey: true }))).toBe(false);
    expect(isScanEnter(key({ metaKey: true }))).toBe(false);
  });

  it("leaves Alt+Enter alone", () => {
    expect(isScanEnter(key({ altKey: true }))).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isScanEnter(key({ key: "a" }))).toBe(false);
  });
});
