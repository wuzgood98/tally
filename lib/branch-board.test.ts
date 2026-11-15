import { describe, expect, it } from "vitest";

import { boardBins, boardRows } from "@/lib/branch-board";
import type { BranchHealth, ReorderLine } from "@/lib/queries/overview";

const branch = (id: string, lines: number): BranchHealth => ({
  costValue: 10_000,
  id,
  kind: "store",
  lines,
  lowLines: 0,
  name: id,
  outLines: 0,
});

const line = (
  branchId: string,
  name: string,
  onHand: number,
  reorderPoint: number,
  inTransit = 0
): ReorderLine => ({
  branchId,
  branchName: branchId,
  categoryName: "Groceries",
  inTransit,
  name,
  onHand,
  onOrder: 0,
  productId: name.length,
  reorderPoint,
  requested: 0,
  sku: name.toUpperCase(),
  supplierId: null,
  supplierName: null,
});

describe("boardBins", () => {
  it("settles the worst lines at the bottom of each bin", () => {
    const [bin] = boardBins(
      [branch("SPX", 150)],
      [
        line("SPX", "Rice", -2, 60),
        line("SPX", "Bleach", 0, 60),
        line("SPX", "Oil", 9, 40),
        line("SPX", "Salt", 30, 40),
        line("SPX", "Milk", 0, 60, 118),
      ]
    );

    expect(bin?.problems.map((problem) => problem.name)).toEqual([
      "Milk",
      "Salt",
      "Oil",
      "Bleach",
      "Rice",
    ]);
    expect(bin?.problems.map((problem) => problem.status)).toEqual([
      "covered",
      "low",
      "low",
      "out",
      "count",
    ]);
  });

  it("counts a line that needs a count as out, and covered lines apart", () => {
    const [bin] = boardBins(
      [branch("SPX", 150)],
      [
        line("SPX", "Rice", -2, 60),
        line("SPX", "Bleach", 0, 60),
        line("SPX", "Oil", 9, 40),
        line("SPX", "Milk", 0, 60, 118),
      ]
    );

    expect(bin).toMatchObject({ covered: 1, low: 1, out: 2 });
  });

  it("keeps every branch, even one with nothing running low", () => {
    const bins = boardBins(
      [branch("SPX", 150), branch("TMA", 160)],
      [line("SPX", "Rice", 0, 60)]
    );

    expect(bins.map((bin) => [bin.id, bin.problems.length])).toEqual([
      ["SPX", 1],
      ["TMA", 0],
    ]);
  });
});

describe("boardRows", () => {
  it("fits the branch with the most lines", () => {
    const bins = boardBins([branch("SPX", 150), branch("TMA", 162)], []);

    expect(boardRows(bins)).toBe(14);
  });

  it("is at least one row", () => {
    expect(boardRows([])).toBe(1);
  });
});
