import { describe, expect, it } from "vitest";

import {
  canAdjust,
  canApproveReturn,
  canCancelTransfer,
  canDispatchTransfer,
  canManageCatalogue,
  canReceive,
  canReceiveTransfer,
  canSell,
  canSetReorderPoint,
  operableBranchIds,
  sellableBranchIds,
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

  it("lets branch staff send and receive transfers at their own branch", () => {
    for (const actor of [manager, storekeeper]) {
      expect(canDispatchTransfer(actor, "SPX")).toBe(true);
      expect(canReceiveTransfer(actor, "SPX")).toBe(true);
      expect(canDispatchTransfer(actor, "KSI")).toBe(false);
      expect(canReceiveTransfer(actor, "KSI")).toBe(false);
    }

    expect(canDispatchTransfer(admin, "TMA")).toBe(true);
    expect(canReceiveTransfer(admin, "KSI")).toBe(true);
  });

  it("keeps cancelling a transfer for managers at the sending branch", () => {
    expect(canCancelTransfer(manager, "SPX")).toBe(true);
    expect(canCancelTransfer(storekeeper, "SPX")).toBe(false);
    expect(canCancelTransfer(manager, "KSI")).toBe(false);
    expect(canCancelTransfer(admin, "KSI")).toBe(true);
  });

  it("keeps cashiers to the till at their own store", () => {
    const cashier: Actor = { branchId: "SPX", id: "c", role: "cashier" };

    expect(canSell(cashier, "SPX")).toBe(true);
    expect(canSell(cashier, "KSI")).toBe(false);
    expect(canReceive(cashier, "SPX")).toBe(false);
    expect(canAdjust(cashier, "SPX", "damaged")).toBe(false);
    expect(canDispatchTransfer(cashier, "SPX")).toBe(false);
    expect(canReceiveTransfer(cashier, "SPX")).toBe(false);
    expect(canApproveReturn(cashier, "SPX")).toBe(false);
    expect(operableBranchIds(cashier, ["SPX", "KSI"])).toEqual([]);
    expect(sellableBranchIds(cashier, ["SPX", "KSI"])).toEqual(["SPX"]);
  });

  it("lets managers sell and approve returns, but not storekeepers", () => {
    expect(canSell(manager, "SPX")).toBe(true);
    expect(canApproveReturn(manager, "SPX")).toBe(true);
    expect(canApproveReturn(manager, "KSI")).toBe(false);
    expect(canSell(storekeeper, "SPX")).toBe(false);
    expect(canApproveReturn(storekeeper, "SPX")).toBe(false);
    expect(sellableBranchIds(storekeeper, ["SPX"])).toEqual([]);
    expect(canApproveReturn(admin, "KSI")).toBe(true);
  });

  it("reserves reorder points and the catalogue", () => {
    expect(canSetReorderPoint(manager, "SPX")).toBe(true);
    expect(canSetReorderPoint(storekeeper, "SPX")).toBe(false);
    expect(canManageCatalogue(manager)).toBe(false);
    expect(canManageCatalogue(admin)).toBe(true);
  });
});
