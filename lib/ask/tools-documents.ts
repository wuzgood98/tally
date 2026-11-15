/** Ask Tally's document tools: transfers, purchase orders, requests, receipts. */

import { z } from "zod";

import { withCoverage } from "@/lib/ask/context";
import type { PurchaseOrderRow } from "@/lib/ask/data";
import {
  branchArgument,
  defineTool,
  LIST_LIMIT,
  purchaseOrderHref,
  receiptHref,
  requestHref,
  statusWords,
  sumOfAll,
  transferHref,
  markdownLink,
  showingNote,
} from "@/lib/ask/tool-kit";
import type { ToolDeps } from "@/lib/ask/tool-kit";
import {
  purchaseOrderStatusEnum,
  stockRequestStatusEnum,
  transferStatusEnum,
} from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { formatCedis } from "@/lib/money";
import { TRANSFER_DIRECTIONS } from "@/lib/transfer-direction";

/** Money summed over every row, formatted; null when not every row was read. */
const cedisOfAll = <Row>(
  rows: readonly Row[],
  total: number,
  figure: (row: Row) => number
): string | null => {
  const sum = sumOfAll(rows, total, figure);

  return sum === null ? null : formatCedis(sum);
};

const transfers = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      "Stock transfers between branches, newest first. By default the ones still on the road. For one branch, choose incoming, outgoing or both. Gives the units and value of all of them together when it read them all.",
    inputSchema: z.object({
      branch: branchArgument,
      direction: z.enum(TRANSFER_DIRECTIONS).default("both"),
      status: z
        .enum([...transferStatusEnum.enumValues, "any"])
        .default("in_transit"),
    }),
    run: async ({ branch, direction, status }) =>
      await withCoverage(context, branch, async (coverage) => {
        const page = await data.transfers(
          coverage.scope,
          status === "any" ? null : status,
          direction
        );

        return {
          covers: coverage.label,
          showing: showingNote(page.total),
          total: page.total,
          totalUnits: sumOfAll(page.rows, page.total, (row) => row.unitsSent),
          totalValueAtCost: cedisOfAll(
            page.rows,
            page.total,
            (row) => row.totalCost
          ),
          transfers: page.rows.slice(0, LIST_LIMIT).map((row) => ({
            from: row.fromName,
            link: markdownLink(row.number, transferHref(row.id)),
            number: row.number,
            sent: formatDate(row.createdAt),
            status: statusWords(row.status),
            to: row.toName,
            units: row.unitsSent,
            valueAtCost: formatCedis(row.totalCost),
          })),
        };
      }),
  });

const OPEN_ORDER_STATUSES = ["approved", "partly_received"] as const;

const purchaseOrders = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      'Purchase orders to suppliers, newest first. "open" (the default) means approved and still due, in full or in part. Gives the units due and value of all of them together when it read them all.',
    inputSchema: z.object({
      branch: branchArgument,
      status: z
        .enum([...purchaseOrderStatusEnum.enumValues, "open", "any"])
        .default("open"),
    }),
    run: async ({ branch, status }) =>
      await withCoverage(context, branch, async (coverage) => {
        const statuses =
          status === "open"
            ? OPEN_ORDER_STATUSES
            : [status === "any" ? null : status];

        const pages = await Promise.all(
          statuses.map(
            async (item) => await data.purchaseOrders(coverage.scope, item)
          )
        );

        const rows: PurchaseOrderRow[] = [];
        let total = 0;

        for (const page of pages) {
          rows.push(...page.rows);
          total += page.total;
        }

        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return {
          covers: coverage.label,
          orders: rows.slice(0, LIST_LIMIT).map((row) => ({
            branch: row.branchName,
            expected:
              row.expectedAt === null ? null : formatDate(row.expectedAt),
            link: markdownLink(row.number, purchaseOrderHref(row.id)),
            number: row.number,
            raised: formatDate(row.createdAt),
            status: statusWords(row.status),
            supplier: row.supplierName,
            unitsDue: row.ordered - row.received,
            unitsOrdered: row.ordered,
            valueAtCost: formatCedis(row.totalCost),
          })),
          showing: showingNote(total),
          total,
          totalUnitsDue: sumOfAll(
            rows,
            total,
            (row) => row.ordered - row.received
          ),
          totalValueAtCost: cedisOfAll(rows, total, (row) => row.totalCost),
        };
      }),
  });

const stockRequests = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      "Stores' requests to the warehouse for stock, newest first. By default the ones still waiting to be fulfilled. Gives the units of all of them together when it read them all.",
    inputSchema: z.object({
      branch: branchArgument,
      status: z
        .enum([...stockRequestStatusEnum.enumValues, "any"])
        .default("requested"),
    }),
    run: async ({ branch, status }) =>
      await withCoverage(context, branch, async (coverage) => {
        const page = await data.stockRequests(
          coverage.scope,
          status === "any" ? null : status
        );

        return {
          covers: coverage.label,
          requests: page.rows.slice(0, LIST_LIMIT).map((row) => ({
            link: markdownLink(row.number, requestHref(row.id)),
            number: row.number,
            raised: formatDate(row.createdAt),
            status: statusWords(row.status),
            store: row.storeName,
            units: row.units,
          })),
          showing: showingNote(page.total),
          total: page.total,
          totalUnits: sumOfAll(page.rows, page.total, (row) => row.units),
        };
      }),
  });

const recentReceipts = ({ context, data }: ToolDeps) =>
  defineTool({
    description:
      "Goods received from suppliers (GRNs), newest first. Gives the value of all of them together when it read them all.",
    inputSchema: z.object({ branch: branchArgument }),
    run: async ({ branch }) =>
      await withCoverage(context, branch, async (coverage) => {
        const page = await data.receipts(coverage.scope);

        return {
          covers: coverage.label,
          receipts: page.rows.slice(0, LIST_LIMIT).map((row) => ({
            branch: row.branchName,
            link: markdownLink(row.number, receiptHref(row.id)),
            number: row.number,
            received: formatDate(row.createdAt),
            supplier: row.supplierName,
            valueAtCost: formatCedis(row.totalCost),
          })),
          showing: showingNote(page.total),
          total: page.total,
          totalValueAtCost: cedisOfAll(
            page.rows,
            page.total,
            (row) => row.totalCost
          ),
        };
      }),
  });

export const documentTools = (deps: ToolDeps) => ({
  purchaseOrders: purchaseOrders(deps),
  recentReceipts: recentReceipts(deps),
  stockRequests: stockRequests(deps),
  transfers: transfers(deps),
});
