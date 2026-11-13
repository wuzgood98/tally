import { describe, expect, it } from "vitest";

import { paletteScore } from "@/lib/palette-filter";

const reports = { label: "Reports" };
const sales = { keywords: ["receipts", "returns"], label: "Sales" };
const newPo = { keywords: ["po"], label: "New purchase order" };
const lowStock = { keywords: ["reorder", "out of stock"], label: "Low stock" };

describe("paletteScore", () => {
  it("ranks a label that starts with the query above a keyword match", () => {
    expect(paletteScore(reports, "rep")).toBeGreaterThan(
      paletteScore(sales, "rec")
    );
  });

  it("doesn't match letters scattered through a word", () => {
    expect(paletteScore(sales, "rep")).toBe(0);
  });

  it("matches each typed word against the start of a word", () => {
    expect(paletteScore(newPo, "new pur")).toBeGreaterThan(0);
    expect(paletteScore(newPo, "pur ord")).toBeGreaterThan(0);
    expect(paletteScore(newPo, "new po")).toBeGreaterThan(0);
    expect(paletteScore(newPo, "new sale")).toBe(0);
  });

  it("finds a command by a keyword, ranked below label matches", () => {
    expect(paletteScore(lowStock, "reorder")).toBe(1);
    expect(paletteScore(lowStock, "low")).toBe(3);
    expect(paletteScore(lowStock, "stock")).toBe(2);
  });

  it("ignores case and extra spaces, and keeps everything for an empty query", () => {
    expect(paletteScore(reports, "  REP ")).toBe(3);
    expect(paletteScore(sales, "   ")).toBeGreaterThan(0);
  });
});
