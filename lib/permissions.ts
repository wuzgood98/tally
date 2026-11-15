/**
 * Who may do what. Every Server Action checks here before touching data;
 * the UI uses the same functions only to hide what you can't do.
 *
 * - Head office (admin): everything, at every branch.
 * - Branch manager: runs their own branch's stock; sees other branches.
 * - Cashier: sells at their own branch's tills, and nothing else: they see
 *   only their store, and only the till, its sales and the products.
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

/** Drafting a purchase order: a manager for their branch, head office for any. */
export const canDraftPurchaseOrder = (
  actor: Actor,
  branchId: string
): boolean => managesAt(actor, branchId);

/**
 * Approving sends money out of the company, so it's head office's call; so
 * is calling back an order the supplier already has, or closing one short.
 */
export const canApprovePurchaseOrder = (actor: Actor): boolean =>
  actor.role === "admin";

/** A draft can be dropped by whoever could have written it. */
export const canCancelDraftPurchaseOrder = (
  actor: Actor,
  branchId: string
): boolean => managesAt(actor, branchId);

/** Asking the warehouse for stock: a store's manager, or head office. */
export const canRequestStock = (actor: Actor, branchId: string): boolean =>
  managesAt(actor, branchId);

export const canManageCatalogue = (actor: Actor): boolean =>
  actor.role === "admin";

export const canManageStaff = (actor: Actor): boolean => actor.role === "admin";

/** The company's name, receipt footer and catalogue defaults. */
export const canManageCompany = (actor: Actor): boolean =>
  actor.role === "admin";

/** Till keys let a machine post sales, so only head office hands them out. */
export const canManageTills = (actor: Actor): boolean => actor.role === "admin";

/**
 * Stock value, sellers and shrinkage: head office for the company, managers
 * for their own branch (see `reportBranchIds`).
 */
export const canViewReports = (actor: Actor): boolean =>
  actor.role === "admin" || actor.role === "manager";

/** Head office reports on any branch, or all of them; a manager doesn't. */
export const canViewEveryBranchReport = (actor: Actor): boolean =>
  actor.role === "admin";

/** Whether this actor may see one branch's reports. */
export const canViewBranchReport = (actor: Actor, branchId: string): boolean =>
  canViewReports(actor) &&
  (canViewEveryBranchReport(actor) || actor.branchId === branchId);

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

/**
 * Branches this actor may look at: every one, except for a cashier, who sees
 * only their own store.
 */
export const visibleBranchIds = (
  actor: Actor,
  allBranchIds: readonly string[]
): string[] =>
  actor.role === "cashier"
    ? allBranchIds.filter((id) => id === actor.branchId)
    : [...allBranchIds];

export const canSeeBranch = (actor: Actor, branchId: string): boolean =>
  actor.role !== "cashier" || actor.branchId === branchId;

/**
 * Receipts, transfers, requests, adjustments, movements, low stock, purchase
 * orders and the overview: everyone but cashiers, who have the till, its
 * sales and the products.
 */
export const canBrowseBackOffice = (actor: Actor): boolean =>
  actor.role !== "cashier";

/**
 * Ask Tally answers questions about the back office, so it's for the same
 * people; its report questions follow `canViewReports`.
 */
export const canAskTally = (actor: Actor): boolean =>
  canBrowseBackOffice(actor);
