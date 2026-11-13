/**
 * GET /reports/shrinkage/csv?days=30: stock lost at cost by branch and
 * cause (a total row when the report covers several branches), then the
 * transit losses by route.
 */

import { getDb } from "@/lib/db";
import { loadReportContext } from "@/lib/reports/context";
import { cedisCell, csvResponse } from "@/lib/reports/csv";
import type { Cell } from "@/lib/reports/csv";
import {
  getShrinkage,
  LOSS_COLUMNS,
  LOSS_LABELS,
  shrinkageByBranch,
} from "@/lib/reports/shrinkage";
import type { BranchShrinkage } from "@/lib/reports/shrinkage";
import { listBranches } from "@/lib/scope";
import { getViewer } from "@/lib/session";

const BRANCH_HEADER = [
  "Branch",
  ...LOSS_COLUMNS.flatMap((column) => [
    `${LOSS_LABELS[column]} (GHS)`,
    `${LOSS_LABELS[column]} (units)`,
  ]),
  "Net lost (GHS)",
  "Sales at cost (GHS)",
  "Rate (%)",
];

const ROUTE_HEADER = [
  "From",
  "To",
  "Transfers short",
  "Units lost",
  "Lost at cost (GHS)",
];

const branchLine = (row: BranchShrinkage, name: string): Cell[] => [
  name,
  ...LOSS_COLUMNS.flatMap((column) => [
    cedisCell(row.lost[column]),
    String(row.units[column]),
  ]),
  cedisCell(row.net),
  cedisCell(row.salesCost),
  row.rate === null ? null : (row.rate * 100).toFixed(2),
];

export const GET = async (request: Request): Promise<Response> => {
  const viewer = await getViewer();
  const days = new URL(request.url).searchParams.get("days");
  const context = viewer ? await loadReportContext(viewer, days) : null;

  if (context === null) {
    return new Response("Not found", { status: 404 });
  }

  const [report, branches] = await Promise.all([
    getShrinkage(getDb(), context.branchIds, context.period),
    listBranches(),
  ]);

  const names = new Map(branches.map((item) => [item.id, item.name]));
  const { rows, total } = shrinkageByBranch(report, context.branchIds);

  const lines: Cell[][] = [
    BRANCH_HEADER,
    ...rows.map((row) =>
      branchLine(row, names.get(row.branchId ?? "") ?? row.branchId ?? "")
    ),
    ...(context.company ? [branchLine(total, "All branches")] : []),
    [],
    ROUTE_HEADER,
    ...report.transit.map((route) => [
      names.get(route.fromBranchId) ?? route.fromBranchId,
      names.get(route.toBranchId) ?? route.toBranchId,
      String(route.transfers),
      String(route.units),
      cedisCell(route.value),
    ]),
  ];

  const today = context.period.to.toISOString().slice(0, 10);
  const scope = context.company ? "all-branches" : (context.branchIds[0] ?? "");

  return csvResponse(
    `shrinkage-${scope}-${context.range}d-${today}.csv`,
    lines
  );
};
