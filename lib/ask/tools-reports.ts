/**
 * Ask Tally's report tools, for head office and managers only: sellers,
 * shrinkage and stock value over the reports' fixed ranges.
 */

import { z } from "zod";

import { withReportCoverage } from "@/lib/ask/context";
import {
  branchArgument,
  daysArgument,
  defineTool,
  LIST_LIMIT,
  productHref,
  markdownLink,
  showingNote,
} from "@/lib/ask/tool-kit";
import type { ToolDeps } from "@/lib/ask/tool-kit";
import { formatDay } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { reportPeriod } from "@/lib/reports/period";
import { groupSellers } from "@/lib/reports/sellers";
import type { SellerRow } from "@/lib/reports/sellers";
import {
  LOSS_COLUMNS,
  LOSS_LABELS,
  shrinkageByBranch,
} from "@/lib/reports/shrinkage";
import type { BranchShrinkage } from "@/lib/reports/shrinkage";

const reportInput = z.object({ branch: branchArgument, days: daysArgument });

const percent = (rate: number | null): string | null =>
  rate === null ? null : `${(rate * 100).toFixed(1)}%`;

const sellerLine = (row: SellerRow) => ({
  daysOfCover: row.daysOfCover === null ? null : Math.round(row.daysOfCover),
  link: markdownLink(row.name, productHref(row.productId)),
  margin: formatCedis(row.margin),
  name: row.name,
  onHand: row.onHand,
  sales: formatCedis(row.sales),
  sku: row.sku,
  stockValueAtCost: formatCedis(row.stockValue),
  unitsSold: row.units,
});

/** One of the report's lists: its first rows, how many in all, and a note when cut. */
const sellerList = (rows: readonly SellerRow[]) => ({
  products: rows.slice(0, LIST_LIMIT).map(sellerLine),
  showing: showingNote(rows.length),
  total: rows.length,
});

const sellersReport = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      "Sales by product over the period, net of returns: fast sellers, slow sellers (stock lasting over 90 days at this rate), stock that didn't sell, and totals with gross margin.",
    inputSchema: reportInput,
    run: async ({ branch, days }) =>
      await withReportCoverage(context, branch, async (coverage) => {
        const rows = await data.sellers(
          coverage.branchIds,
          reportPeriod(Number(days), context.now)
        );

        const groups = groupSellers(rows);

        return {
          covers: coverage.label,
          days: Number(days),
          fast: sellerList(groups.fast),
          slow: sellerList(groups.slow),
          totals: {
            cost: formatCedis(groups.totals.cost),
            margin: formatCedis(groups.totals.margin),
            sales: formatCedis(groups.totals.sales),
            unitsSold: groups.totals.units,
            unsoldStockValueAtCost: formatCedis(groups.totals.unsoldValue),
          },
          unsold: sellerList(groups.unsold),
        };
      }),
  });

const shrinkageLine = (row: BranchShrinkage, name: string) => {
  const causes = [];

  for (const column of LOSS_COLUMNS) {
    if (row.lost[column] !== 0) {
      causes.push({
        cause: LOSS_LABELS[column],
        units: row.units[column],
        valueAtCost: formatCedis(row.lost[column]),
      });
    }
  }

  return {
    branch: name,
    causes,
    netLossAtCost: formatCedis(row.net),
    rateOfSalesAtCost: percent(row.rate),
  };
};

const shrinkageReport = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      "Stock lost over the period, at cost, by branch and cause: damaged, expired, theft, counts, internal use, damaged returns and units lost in transit. Positive is a loss; the rate is the loss as a share of what sold, at cost.",
    inputSchema: reportInput,
    run: async ({ branch, days }) =>
      await withReportCoverage(context, branch, async (coverage) => {
        const report = await data.shrinkage(
          coverage.branchIds,
          reportPeriod(Number(days), context.now)
        );

        const byBranch = shrinkageByBranch(report, coverage.branchIds);

        const nameOf = (id: string | null): string =>
          context.branches.find((item) => item.id === id)?.name ??
          coverage.label;

        return {
          branches: byBranch.rows.map((row) =>
            shrinkageLine(row, nameOf(row.branchId))
          ),
          covers: coverage.label,
          days: Number(days),
          // The total covers what the report does: one branch or all.
          total: shrinkageLine(byBranch.total, coverage.label),
        };
      }),
  });

const stockValueReport = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      "Book value of stock at cost over the period: at the start and now, on the shelves and on the road, and the change.",
    inputSchema: reportInput,
    run: async ({ branch, days }) =>
      await withReportCoverage(context, branch, async (coverage) => {
        const series = await data.stockValue(
          coverage.branchIds,
          reportPeriod(Number(days), context.now)
        );

        const [first] = series;
        const last = series.at(-1);

        if (first === undefined || last === undefined) {
          return {
            covers: coverage.label,
            error: "There's no stock value to show.",
          };
        }

        return {
          change: formatCedis(last.total - first.total),
          covers: coverage.label,
          days: Number(days),
          now: {
            inTransit: formatCedis(last.inTransit),
            onShelves: formatCedis(last.onShelves),
            total: formatCedis(last.total),
          },
          start: { day: formatDay(first.day), total: formatCedis(first.total) },
        };
      }),
  });

export const reportTools = (deps: ToolDeps) => ({
  sellersReport: sellersReport(deps),
  shrinkageReport: shrinkageReport(deps),
  stockValueReport: stockValueReport(deps),
});
