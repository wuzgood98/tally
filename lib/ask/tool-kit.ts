/**
 * The pieces every Ask Tally tool shares: how a tool is defined, the branch
 * argument, and the links its answers carry. Tools hand the model finished
 * figures (money formatted, totals added up) so it never does the sums.
 */

import { dynamicTool } from "ai";
import type { Tool } from "ai";
import { z } from "zod";

import type { AskContext } from "@/lib/ask/context";
import type { AskData } from "@/lib/ask/data";

/** Rows a list answer carries; the total says how many there were. */
export const LIST_LIMIT = 10;

/**
 * A tool as Ask Tally defines it. Tests call `run`, which parses its input
 * again (defaults included) whoever calls it; the agent hands `sdk`, the
 * same tool for the AI SDK, to the model.
 */
export interface AskTool<Schema extends z.ZodType, Result> {
  readonly description: string;
  readonly run: (input: z.input<Schema>) => Promise<Result>;
  readonly sdk: Tool;
}

interface ToolDefinition<Schema extends z.ZodType, Result> {
  readonly description: string;
  readonly inputSchema: Schema;
  readonly run: (input: z.output<Schema>) => Promise<Result>;
}

export const defineTool = <Schema extends z.ZodType, Result>(
  definition: ToolDefinition<Schema, Result>
): AskTool<Schema, Result> => {
  const run = async (input: z.input<Schema>): Promise<Result> =>
    await definition.run(definition.inputSchema.parse(input));

  return {
    description: definition.description,
    run,
    // Dynamic: the SDK can't infer a generic schema's type, and the input
    // is parsed here anyway.
    sdk: dynamicTool({
      description: definition.description,
      execute: async (input) =>
        await definition.run(definition.inputSchema.parse(input)),
      inputSchema: definition.inputSchema,
    }),
  };
};

/** What every tool factory is given. */
export interface ToolDeps {
  readonly context: AskContext;
  readonly data: AskData;
}

export const branchArgument = z
  .string()
  .max(60)
  .optional()
  .describe(
    'A branch name, city or code, or "all". Leave out to use the branch the person is looking at.'
  );

/** The fixed report ranges, in days. */
export const daysArgument = z
  .enum(["7", "30", "90"])
  .default("30")
  .describe("How many days back, today included: 7, 30 or 90.");

export const productHref = (id: number): string => `/products/${id}`;
export const transferHref = (id: number): string => `/transfers/${id}`;

export const purchaseOrderHref = (id: number): string =>
  `/purchase-orders/${id}`;

export const requestHref = (id: number): string => `/requests/${id}`;
export const receiptHref = (id: number): string => `/receipts/${id}`;

/**
 * A record's link as ready-made markdown, so the model copies it rather
 * than building a URL. Brackets in the label would break the link.
 */
export const markdownLink = (label: string, href: string): string =>
  `[${label.replaceAll(/[[\]]/gu, "")}](${href})`;

/** "Showing 10 of 23." when a list was cut short; null when it wasn't. */
export const showingNote = (total: number): string | null =>
  total > LIST_LIMIT
    ? `Showing ${LIST_LIMIT} of ${total}. Say there are ${total} in all.`
    : null;

/** "in_transit" → "in transit". */
export const statusWords = (status: string): string =>
  status.replaceAll("_", " ");
