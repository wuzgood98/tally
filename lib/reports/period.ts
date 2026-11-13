/**
 * Which branches and which days a report covers. Kept free of server-only
 * imports so the report queries can be tested against a test database.
 */

import { canViewReports } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";

/** The ranges a report offers, in days, today included. */
export const REPORT_RANGES = [7, 30, 90] as const;

export type ReportRange = (typeof REPORT_RANGES)[number];

export const DEFAULT_REPORT_RANGE: ReportRange = 30;

const DAY_MS = 86_400_000;

export interface ReportPeriod {
  /** Midnight starting the first day. Accra keeps GMT all year, so UTC days are local days. */
  readonly from: Date;
  /** The moment the report runs to: now. */
  readonly to: Date;
  readonly days: number;
}

/** The last `days` calendar days, today included, up to now. */
export const reportPeriod = (days: number, now = new Date()): ReportPeriod => {
  const startOfToday = Math.floor(now.getTime() / DAY_MS) * DAY_MS;

  return {
    days,
    from: new Date(startOfToday - (days - 1) * DAY_MS),
    to: now,
  };
};

/** "2026-11-13" for each day of the period, oldest first. */
export const periodDays = (period: ReportPeriod): string[] =>
  Array.from({ length: period.days }, (_, index) =>
    new Date(period.from.getTime() + index * DAY_MS).toISOString().slice(0, 10)
  );

/** What the branch switcher shows: everything, or one branch. */
export type ReportScope =
  | { readonly kind: "all" }
  | { readonly kind: "branch"; readonly branchId: string };

/**
 * The branches a report covers for this person. Head office follows the
 * branch switcher; a manager always sees their own branch, whatever the
 * switcher says. Anyone else gets none.
 */
export const reportBranchIds = (
  actor: Actor,
  scope: ReportScope,
  allBranchIds: readonly string[]
): string[] => {
  if (!canViewReports(actor)) {
    return [];
  }

  if (actor.role !== "admin") {
    return allBranchIds.filter((id) => id === actor.branchId);
  }

  return scope.kind === "all"
    ? [...allBranchIds]
    : allBranchIds.filter((id) => id === scope.branchId);
};
