import { describe, expect, it } from "vitest";

import {
  canAdjust,
  canApprovePurchaseOrder,
  canAskTally,
  canViewBranchReport,
  canViewEveryBranchReport,
  canBrowseBackOffice,
  canSeeBranch,
  canApproveReturn,
  canCancelDraftPurchaseOrder,
  canCancelTransfer,
  canDispatchTransfer,
  canDraftPurchaseOrder,
  canManageAskTally,
  canManageCatalogue,
  canManageCompany,
  canReceive,
  canReceiveTransfer,
  canRequestStock,
  canSell,
  canSetReorderPoint,
  operableBranchIds,
  sellableBranchIds,
  visibleBranchIds,
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

  it("lets managers draft and request, and head office approve", () => {
    const cashier: Actor = { branchId: "SPX", id: "c", role: "cashier" };

    expect(canDraftPurchaseOrder(manager, "SPX")).toBe(true);
    expect(canDraftPurchaseOrder(manager, "KSI")).toBe(false);
    expect(canDraftPurchaseOrder(storekeeper, "SPX")).toBe(false);
    expect(canDraftPurchaseOrder(cashier, "SPX")).toBe(false);
    expect(canDraftPurchaseOrder(admin, "KSI")).toBe(true);

    expect(canApprovePurchaseOrder(manager)).toBe(false);
    expect(canApprovePurchaseOrder(admin)).toBe(true);
    expect(canCancelDraftPurchaseOrder(manager, "SPX")).toBe(true);
    expect(canCancelDraftPurchaseOrder(storekeeper, "SPX")).toBe(false);

    expect(canRequestStock(manager, "SPX")).toBe(true);
    expect(canRequestStock(storekeeper, "SPX")).toBe(false);
    expect(canRequestStock(manager, "KSI")).toBe(false);
  });

  it("reserves reorder points and the catalogue", () => {
    expect(canSetReorderPoint(manager, "SPX")).toBe(true);
    expect(canSetReorderPoint(storekeeper, "SPX")).toBe(false);
    expect(canManageCatalogue(manager)).toBe(false);
    expect(canManageCatalogue(admin)).toBe(true);
  });

  it("leaves company settings and Ask Tally's switch to head office", () => {
    const cashier: Actor = { branchId: "SPX", id: "c", role: "cashier" };

    expect(canManageCompany(admin)).toBe(true);
    expect(canManageAskTally(admin)).toBe(true);

    for (const actor of [manager, storekeeper, cashier]) {
      expect(canManageCompany(actor)).toBe(false);
      expect(canManageAskTally(actor)).toBe(false);
    }
  });

  it("lets a cashier see only their own store and none of the back office", () => {
    const cashier: Actor = { branchId: "SPX", id: "c", role: "cashier" };
    const all = ["SPX", "KSI", "TMA"];

    expect(visibleBranchIds(cashier, all)).toEqual(["SPX"]);
    expect(canSeeBranch(cashier, "SPX")).toBe(true);
    expect(canSeeBranch(cashier, "KSI")).toBe(false);
    expect(canBrowseBackOffice(cashier)).toBe(false);

    for (const actor of [admin, manager, storekeeper]) {
      expect(visibleBranchIds(actor, all)).toEqual(all);
      expect(canSeeBranch(actor, "KSI")).toBe(true);
      expect(canBrowseBackOffice(actor)).toBe(true);
    }
  });

  it("offers Ask Tally to everyone in the back office, not cashiers", () => {
    const cashier: Actor = { branchId: "SPX", id: "c", role: "cashier" };

    expect(canAskTally(cashier)).toBe(false);

    for (const actor of [admin, manager, storekeeper]) {
      expect(canAskTally(actor)).toBe(true);
    }
  });

  it("lets head office see any branch's reports, a manager only their own", () => {
    expect(canViewEveryBranchReport(admin)).toBe(true);
    expect(canViewEveryBranchReport(manager)).toBe(false);
    expect(canViewBranchReport(admin, "KSI")).toBe(true);
    expect(canViewBranchReport(manager, "SPX")).toBe(true);
    expect(canViewBranchReport(manager, "KSI")).toBe(false);
    expect(canViewBranchReport(storekeeper, "SPX")).toBe(false);
  });
});
