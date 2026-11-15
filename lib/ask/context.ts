/**
 * Who is asking and where they're looking. Built from the session on the
 * server, never from anything the model says: the tools only ever narrow it.
 */

import {
  canSeeBranch,
  canViewEveryBranchReport,
  canViewReports,
} from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";
import { reportBranchIds } from "@/lib/reports/period";
import type { Scope } from "@/lib/scope";

/** The branch switcher's choice: lib/scope's own type. */
export type AskScope = Scope;

export interface AskBranch {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly kind: "store" | "warehouse";
}

export interface AskContext {
  readonly viewer: Actor;
  /** The branch switcher, as `getScope` resolved it for this viewer. */
  readonly scope: AskScope;
  /** Every branch, in the switcher's order. */
  readonly branches: readonly AskBranch[];
  readonly now: Date;
}

/** What a tool covers: a scope and the words the answer should use for it. */
export interface Coverage {
  readonly scope: AskScope;
  readonly label: string;
}

/** A tool's answer when it can't help: the model passes the message on. */
export interface AskRefusal {
  readonly error: string;
}

/** What the model may say for every branch. */
export const ALL_WORDS: ReadonlySet<string> = new Set([
  "all",
  "all branches",
  "company",
  "everywhere",
]);

/** What the coverage checks return: something to go on, or a refusal. */
type Resolved = AskBranch | Coverage | ReportCoverage | AskRefusal;

export const isRefusal = (value: Resolved): value is AskRefusal =>
  "error" in value;

export const scopeName = (
  scope: AskScope,
  branches: readonly AskBranch[]
): string =>
  scope.kind === "all"
    ? "All branches"
    : (branches.find((item) => item.id === scope.branchId)?.name ??
      scope.branchId);

const branchList = (branches: readonly AskBranch[]): string =>
  branches.map((item) => `${item.name} (${item.id})`).join(", ");

const matchBranch = (
  text: string,
  branches: readonly AskBranch[]
): AskBranch | AskRefusal => {
  const wanted = text.toLowerCase();

  const exact = branches.find(
    (item) =>
      item.id.toLowerCase() === wanted ||
      item.name.toLowerCase() === wanted ||
      item.city.toLowerCase() === wanted
  );

  if (exact !== undefined) {
    return exact;
  }

  const partial = branches.filter(
    (item) =>
      item.name.toLowerCase().includes(wanted) ||
      item.city.toLowerCase().includes(wanted)
  );

  const [only] = partial;

  if (partial.length === 1 && only !== undefined) {
    return only;
  }

  return {
    error: `There's no single branch called "${text}". The branches are ${branchList(branches)}.`,
  };
};

/**
 * The scope a question covers: the switcher's, unless the model named a
 * branch (or "all"), which must be one this person may see.
 */
export const resolveCoverage = (
  context: AskContext,
  branch: string | undefined
): Coverage | AskRefusal => {
  const { branches, viewer } = context;
  const text = branch?.trim() ?? "";

  if (text === "") {
    return {
      label: scopeName(context.scope, branches),
      scope: context.scope,
    };
  }

  if (ALL_WORDS.has(text.toLowerCase())) {
    const seesAll = branches.every((item) => canSeeBranch(viewer, item.id));

    return seesAll
      ? { label: "All branches", scope: { kind: "all" } }
      : { error: "You can only see your own branch." };
  }

  const found = matchBranch(text, branches);

  if (isRefusal(found)) {
    return found;
  }

  if (!canSeeBranch(viewer, found.id)) {
    return { error: `You can't see ${found.name}.` };
  }

  return { label: found.name, scope: { branchId: found.id, kind: "branch" } };
};

/** The branches a report covers, and the words for them. */
export interface ReportCoverage {
  readonly branchIds: readonly string[];
  readonly label: string;
}

/**
 * Reports follow the reports page: head office sees what it asks for, a
 * manager only their own branch. Unlike the page, a manager who names
 * another branch is told so rather than shown their own figures.
 */
export const resolveReportCoverage = (
  context: AskContext,
  branch: string | undefined
): ReportCoverage | AskRefusal => {
  const { branches, viewer } = context;

  if (!canViewReports(viewer)) {
    return { error: "Reports are for head office and branch managers." };
  }

  const coverage = resolveCoverage(context, branch);

  if (isRefusal(coverage)) {
    return coverage;
  }

  const branchIds = reportBranchIds(
    viewer,
    coverage.scope,
    branches.map((item) => item.id)
  );

  const named = branch !== undefined && branch.trim() !== "";
  const own = branches.find((item) => item.id === viewer.branchId);

  const elsewhere =
    !canViewEveryBranchReport(viewer) &&
    named &&
    (coverage.scope.kind === "all" ||
      coverage.scope.branchId !== viewer.branchId);

  if (elsewhere) {
    return {
      error: `Managers see reports for their own branch only${own === undefined ? "" : ` (${own.name})`}.`,
    };
  }

  const [onlyId] = branchIds;

  return {
    branchIds,
    label:
      branchIds.length === 1 && onlyId !== undefined
        ? scopeName({ branchId: onlyId, kind: "branch" }, branches)
        : "All branches",
  };
};

/** Runs a tool for the branch a question covers, or passes on the refusal. */
export const withCoverage = async <Result>(
  context: AskContext,
  branch: string | undefined,
  run: (coverage: Coverage) => Promise<Result>
): Promise<Result | AskRefusal> => {
  const coverage = resolveCoverage(context, branch);

  return isRefusal(coverage) ? coverage : await run(coverage);
};

/** Runs a report tool for the branches it covers, or passes on the refusal. */
export const withReportCoverage = async <Result>(
  context: AskContext,
  branch: string | undefined,
  run: (coverage: ReportCoverage) => Promise<Result>
): Promise<Result | AskRefusal> => {
  const coverage = resolveReportCoverage(context, branch);

  return isRefusal(coverage) ? coverage : await run(coverage);
};
