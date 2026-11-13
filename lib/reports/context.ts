import "server-only";
import { canViewReports } from "@/lib/permissions";
import {
  DEFAULT_REPORT_RANGE,
  REPORT_RANGES,
  reportBranchIds,
  reportPeriod,
} from "@/lib/reports/period";
import type { ReportPeriod, ReportRange } from "@/lib/reports/period";
import { getScope, listBranches } from "@/lib/scope";
import type { BranchSummary } from "@/lib/scope";
import type { Viewer } from "@/lib/session";

export interface ReportContext {
  readonly range: ReportRange;
  readonly period: ReportPeriod;
  /** The branches covered, in the switcher's order. */
  readonly branches: readonly BranchSummary[];
  readonly branchIds: readonly string[];
  /** "All branches", or the one branch's name. */
  readonly label: string;
  /** More than one branch: worth a per-branch breakdown. */
  readonly company: boolean;
}

/** `?days=` as one of the offered ranges, or the default. */
export const rangeParam = (value: string | null): ReportRange =>
  REPORT_RANGES.find((range) => String(range) === value) ??
  DEFAULT_REPORT_RANGE;

/**
 * What a report shows this person, or null if they can't see reports (the
 * page answers 404, as for any page that isn't theirs).
 */
export const loadReportContext = async (
  viewer: Viewer,
  days: string | null
): Promise<ReportContext | null> => {
  if (!canViewReports(viewer)) {
    return null;
  }

  const [all, scope] = await Promise.all([listBranches(), getScope(viewer)]);

  const ids = new Set(
    reportBranchIds(
      viewer,
      scope,
      all.map((item) => item.id)
    )
  );

  const branches = all.filter((item) => ids.has(item.id));
  const range = rangeParam(days);
  const [only] = branches;

  return {
    branchIds: branches.map((item) => item.id),
    branches,
    company: branches.length > 1,
    label:
      branches.length === 1 && only !== undefined ? only.name : "All branches",
    period: reportPeriod(range),
    range,
  };
};
