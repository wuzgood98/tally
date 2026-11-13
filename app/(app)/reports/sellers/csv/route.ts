/**
 * GET /reports/sellers/csv?days=30: every product sold, returned or held,
 * busiest first, with takings, cost and margin in cedis.
 */

import { getDb } from "@/lib/db";
import { loadReportContext } from "@/lib/reports/context";
import { cedisCell, csvResponse } from "@/lib/reports/csv";
import { getSellers } from "@/lib/reports/sellers";
import { getViewer } from "@/lib/session";

const HEADER = [
  "SKU",
  "Product",
  "Category",
  "Status",
  "Units sold (net)",
  "Units returned",
  "Takings (GHS)",
  "Cost (GHS)",
  "Margin (GHS)",
  "On hand",
  "Stock at cost (GHS)",
  "Days of cover",
];

export const GET = async (request: Request): Promise<Response> => {
  const viewer = await getViewer();
  const days = new URL(request.url).searchParams.get("days");
  const context = viewer ? await loadReportContext(viewer, days) : null;

  if (context === null) {
    return new Response("Not found", { status: 404 });
  }

  const rows = await getSellers(getDb(), context.branchIds, context.period);

  const lines = rows.map((row) => [
    row.sku,
    row.name,
    row.category,
    row.active ? "Active" : "Discontinued",
    String(row.units),
    String(row.returnedUnits),
    cedisCell(row.sales),
    cedisCell(row.cost),
    cedisCell(row.margin),
    String(row.onHand),
    cedisCell(row.stockValue),
    row.daysOfCover === null ? null : String(row.daysOfCover),
  ]);

  const today = context.period.to.toISOString().slice(0, 10);
  const scope = context.company ? "all-branches" : (context.branchIds[0] ?? "");

  return csvResponse(`sellers-${scope}-${context.range}d-${today}.csv`, [
    HEADER,
    ...lines,
  ]);
};
