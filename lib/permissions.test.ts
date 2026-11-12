import { describe, expect, it } from "vitest";

import {
  canAdjust,
  canManageCatalogue,
  canReceive,
  canSetReorderPoint,
  operableBranchIds,
} from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";

const admin: Actor = { branchId: null, id: "a", role: "admin" };
const manager: Actor = { branchId: "SPX", id: "m", role: "manager" };
const storekeeper: Actor = { branchId: "SPX", id: "s", role: "storekeeper" };

describe("permissions", () => {
  it("lets head office work at any branch", () => {
    expect(canReceive(admin, "KSI")).toBe(true);
    expect(canAdjust(admin, "KSI", "theft")).toBe(true);
    expect(operableBranchIds(admin, ["SPX", "KSI"])).toEqual(["SPX", "KSI"]);
  });

  it("keeps branch staff to their own branch", () => {
    expect(canReceive(manager, "KSI")).toBe(false);
    expect(canAdjust(manager, "KSI", "damaged")).toBe(false);
    expect(operableBranchIds(storekeeper, ["SPX", "KSI"])).toEqual(["SPX"]);
  });

  it("limits storekeepers to damaged and expired write-offs", () => {
    expect(canAdjust(storekeeper, "SPX", "damaged")).toBe(true);
    expect(canAdjust(storekeeper, "SPX", "expired")).toBe(true);

    for (const reason of [
      "theft",
      "count_correction",
      "found",
      "internal_use",
    ] as const) {
      expect(canAdjust(storekeeper, "SPX", reason)).toBe(false);
      expect(canAdjust(manager, "SPX", reason)).toBe(true);
    }
  });

  it("reserves reorder points and the catalogue", () => {
    expect(canSetReorderPoint(manager, "SPX")).toBe(true);
    expect(canSetReorderPoint(storekeeper, "SPX")).toBe(false);
    expect(canManageCatalogue(manager)).toBe(false);
    expect(canManageCatalogue(admin)).toBe(true);
  });
});
