import { describe, expect, it } from "vitest";

import { shrinkageByBranch } from "@/lib/reports/shrinkage";
import type { ShrinkageReport } from "@/lib/reports/shrinkage";

const report: ShrinkageReport = {
  lines: [
    { branchId: "SPX", cause: "damaged", units: -2, value: -400 },
    { branchId: "SPX", cause: "count_correction", units: -3, value: -900 },
    { branchId: "SPX", cause: "found", units: 1, value: 300 },
    { branchId: "SPX", cause: "returned_damaged", units: -1, value: -200 },
    { branchId: "KSI", cause: "theft", units: -1, value: -1000 },
    { branchId: "KSI", cause: "count_correction", units: 2, value: 600 },
    // A branch outside the report is ignored.
    { branchId: "WJA", cause: "expired", units: -5, value: -500 },
  ],
  salesCost: { KSI: 10_000, SPX: 20_000 },
  transit: [
    {
      fromBranchId: "TMA",
      toBranchId: "KSI",
      transfers: 1,
      units: 2,
      value: 700,
    },
    {
      fromBranchId: "KSI",
      toBranchId: "WJA",
      transfers: 1,
      units: 1,
      value: 50,
    },
  ],
};

describe("shrinkageByBranch", () => {
  const { rows, total } = shrinkageByBranch(report, ["KSI", "SPX"]);
  const [kumasi, spintex] = rows;

  it("turns ledger values into losses, finds netting against counts", () => {
    expect(spintex?.lost).toMatchObject({
      counts: 600,
      damaged: 400,
      returned_damaged: 200,
      transit: 0,
    });
    expect(spintex?.units).toMatchObject({ counts: 2, damaged: 2 });
    expect(spintex?.net).toBe(1200);
    expect(spintex?.rate).toBe(0.06);
  });

  it("charges transit losses to the branch that counted them short", () => {
    // A count that found two extra is a gain: a negative loss.
    expect(kumasi?.lost).toMatchObject({
      counts: -600,
      theft: 1000,
      transit: 700,
    });
    expect(kumasi?.net).toBe(1100);
  });

  it("totals the branches in the report and nothing else", () => {
    expect(total).toMatchObject({
      branchId: null,
      net: 2300,
      salesCost: 30_000,
    });
    expect(total.lost.expired).toBe(0);
    expect(total.rate).toBeCloseTo(2300 / 30_000);
  });

  it("gives no rate where nothing sold", () => {
    const warehouse = shrinkageByBranch(
      { lines: [], salesCost: {}, transit: [] },
      ["TMA"]
    );

    expect(warehouse.rows[0]?.rate).toBeNull();
    expect(warehouse.total.net).toBe(0);
  });
});
