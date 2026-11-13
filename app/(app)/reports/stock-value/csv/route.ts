/**
 * GET /reports/stock-value/csv?days=30: the stock value report as a CSV,
 * one row per day, a column per branch, then goods in transit and the total.
 */

import { getDb } from "@/lib/db";
import { loadReportContext } from "@/lib/reports/context";
import { cedisCell, csvResponse } from "@/lib/reports/csv";
import { getStockValueSeries } from "@/lib/reports/stock-value";
import { getViewer } from "@/lib/session";

export const GET = async (request: Request): Promise<Response> => {
  const viewer = await getViewer();
  const days = new URL(request.url).searchParams.get("days");
  const context = viewer ? await loadReportContext(viewer, days) : null;

  if (context === null) {
    return new Response("Not found", { status: 404 });
  }

  const series = await getStockValueSeries(
    getDb(),
    context.branchIds,
    context.period
  );

  const header = [
    "Day",
    ...context.branches.map((item) => `${item.name} (GHS)`),
    "In transit (GHS)",
    "Total (GHS)",
  ];

  const rows = series.map((day) => [
    day.day,
    ...context.branches.map((item) => cedisCell(day.byBranch[item.id] ?? 0)),
    cedisCell(day.inTransit),
    cedisCell(day.total),
  ]);

  const today = series.at(-1)?.day ?? "today";
  const scope = context.company ? "all-branches" : (context.branchIds[0] ?? "");

  return csvResponse(`stock-value-${scope}-${context.range}d-${today}.csv`, [
    header,
    ...rows,
  ]);
};
