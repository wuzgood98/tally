/**
 * The overview's branch board: one bin per branch, one square per product
 * line. Pure, so the page and its tests share it. The page hands the client
 * component only the lines that need attention; healthy ones are a count.
 */
import type { BranchHealth, ReorderLine } from "@/lib/queries/overview";
import { shelfStatus } from "@/lib/stock/coverage";
import type { ShelfStatus } from "@/lib/stock/coverage";

/** Squares across one bin. */
export const BOARD_COLUMNS = 12;

export type ProblemStatus = Exclude<ShelfStatus, "ok">;

export interface BoardProblem {
  readonly productId: number;
  readonly name: string;
  readonly onHand: number;
  readonly reorderPoint: number;
  readonly status: ProblemStatus;
}

export interface BoardBin {
  readonly id: string;
  readonly name: string;
  readonly kind: "store" | "warehouse";
  /** Pesewas, at average cost. */
  readonly costValue: number;
  /** Every active line the branch holds a record for. */
  readonly lines: number;
  /** Least urgent first, so the worst settle at the bottom of the bin. */
  readonly problems: readonly BoardProblem[];
  readonly low: number;
  /** Empty, or below zero and waiting for a count. */
  readonly out: number;
  readonly covered: number;
}

const RANK: Record<ProblemStatus, number> = {
  count: 3,
  covered: 0,
  low: 1,
  out: 2,
};

const fullness = (problem: BoardProblem): number =>
  problem.onHand / Math.max(problem.reorderPoint, 1);

/** Covered, then low (fullest first), then out, then needs a count. */
const settle = (a: BoardProblem, b: BoardProblem): number =>
  RANK[a.status] - RANK[b.status] ||
  fullness(b) - fullness(a) ||
  a.name.localeCompare(b.name);

const isProblem = (status: ShelfStatus): status is ProblemStatus =>
  status !== "ok";

const toProblem = (line: ReorderLine): BoardProblem | null => {
  const status = shelfStatus(line);

  // Only lines at or below their reorder point come in, so never "ok".
  return isProblem(status)
    ? {
        name: line.name,
        onHand: line.onHand,
        productId: line.productId,
        reorderPoint: line.reorderPoint,
        status,
      }
    : null;
};

const countByStatus = (
  problems: readonly BoardProblem[]
): Record<ProblemStatus, number> => {
  const counts = { count: 0, covered: 0, low: 0, out: 0 };

  for (const problem of problems) {
    counts[problem.status] += 1;
  }

  return counts;
};

export const boardBins = (
  health: readonly BranchHealth[],
  reorder: readonly ReorderLine[]
): BoardBin[] => {
  const byBranch = new Map<string, BoardProblem[]>();

  for (const line of reorder) {
    const problem = toProblem(line);

    if (problem !== null) {
      const list = byBranch.get(line.branchId) ?? [];
      list.push(problem);
      byBranch.set(line.branchId, list);
    }
  }

  return health.map((branch) => {
    const problems = (byBranch.get(branch.id) ?? []).toSorted(settle);
    const counts = countByStatus(problems);

    return {
      costValue: branch.costValue,
      covered: counts.covered,
      id: branch.id,
      kind: branch.kind,
      lines: branch.lines,
      low: counts.low,
      name: branch.name,
      out: counts.out + counts.count,
      problems,
    };
  });
};

/** Rows every bin shares, so they line up whatever each one holds. */
export const boardRows = (bins: readonly BoardBin[]): number =>
  Math.max(1, ...bins.map((bin) => Math.ceil(bin.lines / BOARD_COLUMNS)));
