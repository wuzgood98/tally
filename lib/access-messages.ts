import type { Role } from "@/lib/db/schema";

/** Why a stock form has no branch to offer this person. */
export const noStockBranchMessage = (role: Role): string =>
  role === "cashier"
    ? "Cashiers work the till. Receiving, adjusting and moving stock is for storekeepers and managers."
    : "Your account isn't attached to a branch. Ask head office to set one.";
