import { describe, expect, it } from "vitest";

import { parseFlash } from "@/lib/flash";

describe("parseFlash", () => {
  it("reads a saved flash", () => {
    const raw = JSON.stringify({
      action: { href: "/receipts/new", label: "Receive another" },
      description: "40 units received.",
      id: "a1",
      title: "GRN-SPX-000042 saved",
    });

    expect(parseFlash(raw)).toEqual({
      action: { href: "/receipts/new", label: "Receive another" },
      description: "40 units received.",
      id: "a1",
      title: "GRN-SPX-000042 saved",
    });
  });

  it("treats a missing cookie as no flash", () => {
    expect(parseFlash(undefined)).toBeNull();
  });

  it("ignores a value that isn't JSON", () => {
    expect(parseFlash("{not json")).toBeNull();
  });

  it("ignores a flash without a title", () => {
    expect(parseFlash(JSON.stringify({ id: "a1" }))).toBeNull();
  });

  it("refuses a link that leaves the app", () => {
    const raw = JSON.stringify({
      action: { href: "https://example.com", label: "Open" },
      id: "a1",
      title: "Saved",
    });

    expect(parseFlash(raw)).toBeNull();
  });

  it("refuses a protocol-relative link", () => {
    const raw = JSON.stringify({
      action: { href: "//example.com", label: "Open" },
      id: "a1",
      title: "Saved",
    });

    expect(parseFlash(raw)).toBeNull();
  });
});
