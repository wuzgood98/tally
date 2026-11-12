/**
 * Who may do what. Every Server Action checks here before touching data;
 * the UI uses the same functions only to hide what you can't do.
 *
 * - Head office (admin): everything, at every branch.
 * - Branch manager: runs their own branch's stock; sees other branches.
 * - Cashier: sells at their own branch's tills, and nothing else.
 * - Storekeeper: receives goods, sends and receives transfers, and writes off
 *   damaged or expired stock at their own branch. Anything that could hide a
 *   loss (theft, recounts, "found" stock, internal use) needs a manager, and so
 *   does calling back a transfer already on the road.
 */

import type { AdjustmentReason, Role } from "@/lib/db/schema";

export interface Actor {
  readonly id: string;
  readonly role: Role;
  /** Null for head office. */
  readonly branchId: string | null;
}

const worksAt = (actor: Actor, branchId: string): boolean =>
  actor.role === "admin" || actor.branchId === branchId;

/** Everyone who handles stock in the back: not cashiers, who only sell. */
const handlesStockAt = (actor: Actor, branchId: string): boolean =>
  actor.role !== "cashier" && worksAt(actor, branchId);

const STOREKEEPER_REASONS: ReadonlySet<AdjustmentReason> = new Set([
  "damaged",
  "expired",
]);

export const canReceive = (actor: Actor, branchId: string): boolean =>
  handlesStockAt(actor, branchId);

export const canAdjust = (
  actor: Actor,
  branchId: string,
  reason: AdjustmentReason
): boolean => {
  if (!handlesStockAt(actor, branchId)) {
    return false;
  }

  return actor.role !== "storekeeper" || STOREKEEPER_REASONS.has(reason);
};

/** The reasons this actor may pick at this branch, for the adjustment form. */
export const adjustableReasons = (
  actor: Actor,
  branchId: string,
  reasons: readonly AdjustmentReason[]
): AdjustmentReason[] =>
  reasons.filter((reason) => canAdjust(actor, branchId, reason));

/** Head office anywhere, or a manager at their own branch. */
const managesAt = (actor: Actor, branchId: string): boolean =>
  (actor.role === "manager" || actor.role === "admin") &&
  worksAt(actor, branchId);

/** Sending stock: the receiving branch counts it in, which checks the sender. */
export const canDispatchTransfer = (
  actor: Actor,
  fromBranchId: string
): boolean => handlesStockAt(actor, fromBranchId);

/** Counting a transfer in, including recording units lost on the way. */
export const canReceiveTransfer = (actor: Actor, toBranchId: string): boolean =>
  handlesStockAt(actor, toBranchId);

/** Calling back a transfer still in transit returns its stock to the sender. */
export const canCancelTransfer = (
  actor: Actor,
  fromBranchId: string
): boolean => managesAt(actor, fromBranchId);

export const canSetReorderPoint = (actor: Actor, branchId: string): boolean =>
  managesAt(actor, branchId);

/** Ringing up sales: cashiers and managers at their branch, head office anywhere. */
export const canSell = (actor: Actor, branchId: string): boolean =>
  actor.role !== "storekeeper" && worksAt(actor, branchId);

/** Returns are a common way to hide theft, so a manager approves every one. */
export const canApproveReturn = (actor: Actor, branchId: string): boolean =>
  managesAt(actor, branchId);

export const canManageCatalogue = (actor: Actor): boolean =>
  actor.role === "admin";

export const canManageStaff = (actor: Actor): boolean => actor.role === "admin";

/** Till keys let a machine post sales, so only head office hands them out. */
export const canManageTills = (actor: Actor): boolean => actor.role === "admin";

const ownBranches = (actor: Actor, allBranchIds: readonly string[]): string[] =>
  actor.role === "admin"
    ? [...allBranchIds]
    : allBranchIds.filter((id) => id === actor.branchId);

/** Branches whose stock this actor may change: their own, or all for head office. */
export const operableBranchIds = (
  actor: Actor,
  allBranchIds: readonly string[]
): string[] =>
  actor.role === "cashier" ? [] : ownBranches(actor, allBranchIds);

/** Branches whose tills this actor may use. */
export const sellableBranchIds = (
  actor: Actor,
  allBranchIds: readonly string[]
): string[] =>
  actor.role === "storekeeper" ? [] : ownBranches(actor, allBranchIds);
