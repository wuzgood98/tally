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
  // Whoever calls it, the input is parsed here: the model's arguments are
  // untrusted, and the schema fills in the defaults.
  const run = async (input: z.input<Schema>): Promise<Result> =>
    await definition.run(definition.inputSchema.parse(input));

  return {
    description: definition.description,
    run,
    // Dynamic: the SDK can't infer a generic schema's type. Its `execute`
    // takes the model's input as `unknown`, which `run`'s typed parameter
    // can't accept (and lint forbids an `unknown` one), so it parses too.
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

/** Brackets and quotes would break a link's label; line breaks, its line. */
const LABEL_BREAKERS = /["[\]]/gu;
const LINE_BREAKS = /\s+/gu;

/**
 * A record's link as ready-made markdown, so the model copies it rather
 * than building a URL. The panel only links what these produce.
 */
export const markdownLink = (label: string, href: string): string =>
  `[${label.replaceAll(LABEL_BREAKERS, "").replaceAll(LINE_BREAKS, " ").trim()}](${href})`;

/** "Showing 10 of 23." when a list was cut short; null when it wasn't. */
export const showingNote = (total: number): string | null =>
  total > LIST_LIMIT
    ? `Showing ${LIST_LIMIT} of ${total}. Say there are ${total} in all.`
    : null;

/**
 * A figure added up over every row, or null when the rows are only the
 * first page of more: a total of some of them would mislead.
 */
export const sumOfAll = <Row>(
  rows: readonly Row[],
  total: number,
  figure: (row: Row) => number
): number | null => {
  if (rows.length < total) {
    return null;
  }

  let sum = 0;

  for (const row of rows) {
    sum += figure(row);
  }

  return sum;
};

/** "in_transit" → "in transit". */
export const statusWords = (status: string): string =>
  status.replaceAll("_", " ");
