/** Ask Tally's stock tools: find a product, where it is, and what's low. */

import { z } from "zod";

import { withCoverage } from "@/lib/ask/context";
import type { AskRefusal } from "@/lib/ask/context";
import {
  branchArgument,
  defineTool,
  LIST_LIMIT,
  productHref,
  markdownLink,
  showingNote,
} from "@/lib/ask/tool-kit";
import type { ToolDeps } from "@/lib/ask/tool-kit";
import { formatCedis } from "@/lib/money";
import { canSeeBranch } from "@/lib/permissions";

/** The days of sales shown beside a product's stock. */
const SOLD_DAYS = 30;

/** A balance below zero (a sale beyond the record) is "none on the shelf". */
const shelf = (onHand: number): number => Math.max(onHand, 0);

const findProducts = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      "Find products by name, SKU or barcode. Use it first to get the product id the other product tools need.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(100)
        .describe("Words from the name, a SKU or a barcode."),
    }),
    run: async ({ query }) => {
      const matches = await data.searchProducts(context.scope, query);

      return {
        products: matches.map((item) => ({
          discontinued: !item.active,
          link: markdownLink(item.name, productHref(item.id)),
          id: item.id,
          name: item.name,
          sku: item.sku,
        })),
      };
    },
  });

const productStock = ({ context, data }: ToolDeps) =>
  defineTool({
    description: `One product's stock at every branch: on the shelf, on the way by transfer, still due on purchase orders, on open requests to the warehouse, and units sold in the last ${SOLD_DAYS} days.`,
    inputSchema: z.object({
      productId: z.number().int().positive(),
    }),
    run: async ({ productId }) => {
      const [info, levels, inTransit, onOrder, requested, sold] =
        await Promise.all([
          data.product(productId),
          data.productLevels(productId),
          data.productInTransit(productId),
          data.productOnOrder(productId),
          data.productRequested(productId),
          data.productUnitsSold(productId, SOLD_DAYS),
        ]);

      if (info === null) {
        const refusal: AskRefusal = { error: "There's no such product." };

        return refusal;
      }

      const seen = new Set(levels.map((level) => level.branchId));

      const branches = context.branches.filter(
        (item) => seen.has(item.id) && canSeeBranch(context.viewer, item.id)
      );

      const rows = branches.map((item) => {
        const level = levels.find((entry) => entry.branchId === item.id);
        const onHand = level?.onHand ?? 0;

        return {
          binLocation: level?.binLocation ?? null,
          branch: item.name,
          onHand: shelf(onHand),
          onOrder: onOrder.get(item.id) ?? 0,
          onTheWay: inTransit.get(item.id) ?? 0,
          out: onHand <= 0,
          requested: requested.get(item.id) ?? 0,
          unitsSold: sold.get(item.id) ?? 0,
          stocked: level?.stocked ?? false,
        };
      });

      let total = 0;

      for (const row of rows) {
        total += row.onHand;
      }

      return {
        branches: rows,
        category: info.categoryName,
        discontinued: !info.active,
        link: markdownLink(info.name, productHref(info.id)),
        name: info.name,
        sellPrice: formatCedis(info.sellPrice),
        sku: info.sku,
        supplier: info.supplierName,
        totalOnHand: total,
        unit: info.unit,
        unitsSoldOverDays: SOLD_DAYS,
      };
    },
  });

const lowStock = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      'Products at or below their reorder point, emptiest first, with what\'s already on the way, on order or requested, and the usual supplier. Answers "what\'s low" and "what should we reorder".',
    inputSchema: z.object({ branch: branchArgument }),
    run: async ({ branch }) =>
      await withCoverage(context, branch, async (coverage) => {
        const lines = await data.reorderLines(coverage.scope);

        return {
          covers: coverage.label,
          showing: showingNote(lines.length),
          lines: lines.slice(0, LIST_LIMIT).map((line) => ({
            branch: line.branchName,
            link: markdownLink(line.name, productHref(line.productId)),
            name: line.name,
            onHand: shelf(line.onHand),
            onOrder: line.onOrder,
            onTheWay: line.inTransit,
            reorderPoint: line.reorderPoint,
            requested: line.requested,
            sku: line.sku,
            supplier: line.supplierName,
          })),
          total: lines.length,
        };
      }),
  });

const stockSummary = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      "Totals for the stock on the shelves: units, value at cost and at shelf price, lines in stock, low and out.",
    inputSchema: z.object({ branch: branchArgument }),
    run: async ({ branch }) =>
      await withCoverage(context, branch, async (coverage) => {
        const totals = await data.stockTotals(coverage.scope);

        return {
          covers: coverage.label,
          linesInStock: totals.linesInStock,
          linesLow: totals.lowLines,
          linesOut: totals.outLines,
          units: totals.units,
          valueAtCost: formatCedis(totals.costValue),
          valueAtShelfPrice: formatCedis(totals.retailValue),
        };
      }),
  });

export const stockTools = (deps: ToolDeps) => ({
  findProducts: findProducts(deps),
  lowStock: lowStock(deps),
  productStock: productStock(deps),
  stockSummary: stockSummary(deps),
});
