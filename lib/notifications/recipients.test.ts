import { describe, expect, it } from "vitest";

import { recipientsFor } from "@/lib/notifications/recipients";
import type { StaffMember } from "@/lib/notifications/recipients";

const STAFF: readonly StaffMember[] = [
  { branchId: null, id: "efua", role: "admin" },
  { branchId: null, id: "kwame", role: "admin" },
  { branchId: "SPX", id: "ama", role: "manager" },
  { branchId: "SPX", id: "kofi", role: "storekeeper" },
  { branchId: "SPX", id: "esi", role: "cashier" },
  { branchId: "KSI", id: "yaw", role: "manager" },
  { branchId: "KSI", id: "abena", role: "storekeeper" },
  { branchId: "TMA", id: "nii", role: "manager" },
  { branchId: "TMA", id: "adjoa", role: "storekeeper" },
];

const efua = { branchId: null, id: "efua", role: "admin" } as const;
const ama = { branchId: "SPX", id: "ama", role: "manager" } as const;
const kofi = { branchId: "SPX", id: "kofi", role: "storekeeper" } as const;
const nii = { branchId: "TMA", id: "nii", role: "manager" } as const;

describe("recipientsFor", () => {
  it("tells head office about a branch's draft, but not about its own", () => {
    const event = {
      branchId: "SPX",
      kind: "po_drafted",
      purchaseOrderId: 1,
    } as const;

    expect(recipientsFor(ama, event, STAFF)).toEqual(["efua", "kwame"]);
    expect(recipientsFor(efua, event, STAFF)).toEqual([]);
  });

  it("tells the branch's managers and storekeepers an order was approved", () => {
    expect(
      recipientsFor(
        efua,
        { branchId: "SPX", kind: "po_approved", purchaseOrderId: 1 },
        STAFF
      )
    ).toEqual(["ama", "kofi"]);
  });

  it("tells only the branch's managers an order was cancelled or closed", () => {
    for (const kind of ["po_cancelled", "po_closed"] as const) {
      expect(
        recipientsFor(
          efua,
          { branchId: "SPX", kind, purchaseOrderId: 1 },
          STAFF
        )
      ).toEqual(["ama"]);
    }
  });

  it("never tells the person who did it", () => {
    expect(
      recipientsFor(
        ama,
        { branchId: "SPX", kind: "po_cancelled", purchaseOrderId: 1 },
        STAFF
      )
    ).toEqual([]);
  });

  it("tells the receiving branch a transfer is on its way, and when it's called back", () => {
    const transfer = { fromBranchId: "SPX", toBranchId: "KSI", transferId: 4 };

    expect(
      recipientsFor(kofi, { ...transfer, kind: "transfer_dispatched" }, STAFF)
    ).toEqual(["yaw", "abena"]);
    expect(
      recipientsFor(ama, { ...transfer, kind: "transfer_cancelled" }, STAFF)
    ).toEqual(["yaw"]);
  });

  it("tells the sender's managers and head office about a shortfall", () => {
    expect(
      recipientsFor(
        { branchId: "KSI", id: "abena", role: "storekeeper" },
        {
          fromBranchId: "SPX",
          kind: "transfer_received_short",
          toBranchId: "KSI",
          transferId: 4,
          units: 3,
        },
        STAFF
      )
    ).toEqual(["efua", "kwame", "ama"]);
  });

  it("tells the warehouse's managers about a request", () => {
    expect(
      recipientsFor(
        ama,
        {
          branchId: "SPX",
          fromBranchId: "TMA",
          kind: "request_raised",
          requestId: 2,
        },
        STAFF
      )
    ).toEqual(["nii"]);
  });

  it("tells the other side a request was cancelled, and both sides when head office did it", () => {
    const request = {
      branchId: "SPX",
      fromBranchId: "TMA",
      kind: "request_cancelled",
      requestId: 2,
    } as const;

    expect(recipientsFor(ama, request, STAFF)).toEqual(["nii"]);
    expect(recipientsFor(nii, request, STAFF)).toEqual(["ama"]);
    expect(recipientsFor(efua, request, STAFF)).toEqual(["ama", "nii"]);
  });

  it("never tells a cashier anything", () => {
    const everything = [
      { branchId: "SPX", kind: "po_approved", purchaseOrderId: 1 },
      {
        fromBranchId: "KSI",
        kind: "transfer_dispatched",
        toBranchId: "SPX",
        transferId: 4,
      },
      {
        branchId: "SPX",
        fromBranchId: "TMA",
        kind: "request_cancelled",
        requestId: 2,
      },
    ] as const;

    for (const event of everything) {
      expect(recipientsFor(nii, event, STAFF)).not.toContain("esi");
    }
  });
});
