import "server-only";
import { asc } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { getDb } from "@/lib/db";
import { branch } from "@/lib/db/schema";
import { visibleBranchIds } from "@/lib/permissions";
import type { Viewer } from "@/lib/session";

/**
 * Which branch the screens show. Everyone can look at any branch (a manager
 * checking whether Weija has kettles before sending a customer there); what
 * they can change is decided separately by lib/permissions.
 */
export type Scope =
  | { readonly kind: "all" }
  | { readonly kind: "branch"; readonly branchId: string };

export const SCOPE_COOKIE = "tally-scope";

export interface BranchSummary {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly kind: "store" | "warehouse";
}

export const listBranches = cache(
  async (): Promise<BranchSummary[]> =>
    await getDb()
      .select({
        city: branch.city,
        id: branch.id,
        kind: branch.kind,
        name: branch.name,
      })
      .from(branch)
      .orderBy(asc(branch.kind), asc(branch.name))
);

export const getScope = async (viewer: Viewer): Promise<Scope> => {
  const branches = await listBranches();

  const visible = visibleBranchIds(
    viewer,
    branches.map((item) => item.id)
  );

  // Someone who can't see every branch (a cashier) is fixed to theirs,
  // whatever the cookie says.
  if (visible.length < branches.length) {
    return { branchId: visible[0] ?? "", kind: "branch" };
  }

  const jar = await cookies();
  const chosen = jar.get(SCOPE_COOKIE)?.value;

  if (chosen === "all") {
    return { kind: "all" };
  }

  if (chosen !== undefined && visible.includes(chosen)) {
    return { branchId: chosen, kind: "branch" };
  }

  return viewer.branchId === null
    ? { kind: "all" }
    : { branchId: viewer.branchId, kind: "branch" };
};

export const scopeLabel = (
  scope: Scope,
  branches: readonly BranchSummary[]
): string =>
  scope.kind === "all"
    ? "All branches"
    : (branches.find((item) => item.id === scope.branchId)?.name ??
      scope.branchId);
