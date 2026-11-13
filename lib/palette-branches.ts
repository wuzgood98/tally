export interface PaletteBranch {
  readonly id: string;
  readonly name: string;
  readonly kind: "store" | "warehouse";
}

export const BRANCH_PAGE = "branches";
export const ALL_BRANCHES = "all";

const PICK_PREFIX = "scope:";
const SWITCH_PREFIX = "switch:";

/** A row on the "Switch branch" page: "all" or a branch id. */
export const pickValue = (scope: string): string => `${PICK_PREFIX}${scope}`;

/** "Switch to Kumasi" on the first page, shown once the search names it. */
export const switchValue = (branchId: string): string =>
  `${SWITCH_PREFIX}${branchId}`;

/** The scope a command switches to, or null when it isn't a branch command. */
export const scopeOf = (value: string): string | null => {
  for (const prefix of [PICK_PREFIX, SWITCH_PREFIX]) {
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length);
    }
  }

  return null;
};

export const branchKindLabel = (branch: PaletteBranch): string =>
  branch.kind === "warehouse" ? "Warehouse" : "Store";
