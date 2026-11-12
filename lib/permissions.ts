/**
 * Who may do what. Every Server Action checks here before touching data;
 * the UI uses the same functions only to hide what you can't do.
 *
 * - Head office (admin): everything, at every branch.
 * - Branch manager: runs their own branch's stock; sees other branches.
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

const STOREKEEPER_REASONS: ReadonlySet<AdjustmentReason> = new Set([
  "damaged",
  "expired",
]);

export const canReceive = (actor: Actor, branchId: string): boolean =>
  worksAt(actor, branchId);

export const canAdjust = (
  actor: Actor,
  branchId: string,
  reason: AdjustmentReason
): boolean => {
  if (!worksAt(actor, branchId)) {
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

/** Sending stock: the receiving branch counts it in, which checks the sender. */
export const canDispatchTransfer = (
  actor: Actor,
  fromBranchId: string
): boolean => worksAt(actor, fromBranchId);

/** Counting a transfer in, including recording units lost on the way. */
export const canReceiveTransfer = (actor: Actor, toBranchId: string): boolean =>
  worksAt(actor, toBranchId);

/** Calling back a transfer still in transit returns its stock to the sender. */
export const canCancelTransfer = (
  actor: Actor,
  fromBranchId: string
): boolean => actor.role !== "storekeeper" && worksAt(actor, fromBranchId);

export const canSetReorderPoint = (actor: Actor, branchId: string): boolean =>
  actor.role !== "storekeeper" && worksAt(actor, branchId);

export const canManageCatalogue = (actor: Actor): boolean =>
  actor.role === "admin";

export const canManageStaff = (actor: Actor): boolean => actor.role === "admin";

/** Branches whose stock this actor may change: their own, or all for head office. */
export const operableBranchIds = (
  actor: Actor,
  allBranchIds: readonly string[]
): string[] =>
  actor.role === "admin"
    ? [...allBranchIds]
    : allBranchIds.filter((id) => id === actor.branchId);
