/** Ask Tally's sales tools: today's takings and the best sellers. */

import { z } from "zod";

import { withCoverage } from "@/lib/ask/context";
import {
  branchArgument,
  daysArgument,
  defineTool,
  LIST_LIMIT,
  productHref,
  markdownLink,
} from "@/lib/ask/tool-kit";
import type { ToolDeps } from "@/lib/ask/tool-kit";
import { formatCedis } from "@/lib/money";

const todaysSales = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      "Today's sales so far: how many and the takings, VAT included. Returns aren't netted.",
    inputSchema: z.object({ branch: branchArgument }),
    run: async ({ branch }) =>
      await withCoverage(context, branch, async (coverage) => {
        const totals = await data.todaySales(coverage.scope);

        return {
          covers: coverage.label,
          sales: totals.count,
          takings: formatCedis(totals.total),
        };
      }),
  });

const bestSellers = ({ context, data }: ToolDeps) =>
  defineTool({
    description: `The ${LIST_LIMIT} products that sold the most units over the last 7, 30 or 90 days, with their takings. A top ${LIST_LIMIT}, not every product that sold.`,
    inputSchema: z.object({ branch: branchArgument, days: daysArgument }),
    run: async ({ branch, days }) =>
      await withCoverage(context, branch, async (coverage) => {
        const rows = await data.bestSellers(
          coverage.scope,
          Number(days),
          LIST_LIMIT
        );

        return {
          covers: coverage.label,
          days: Number(days),
          products: rows.map((row) => ({
            link: markdownLink(row.name, productHref(row.productId)),
            name: row.name,
            sku: row.sku,
            takings: formatCedis(row.revenue),
            units: row.units,
          })),
        };
      }),
  });

export const salesTools = (deps: ToolDeps) => ({
  bestSellers: bestSellers(deps),
  todaysSales: todaysSales(deps),
});
