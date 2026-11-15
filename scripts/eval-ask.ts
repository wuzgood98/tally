/**
 * `pnpm eval:ask [--cases rice,low] [model …]`: golden questions for Ask
 * Tally, run against real OpenRouter models. The tools read fixture data
 * (never the database), so this can run beside `next dev`, and every answer
 * can be checked for the exact figures the tools gave.
 *
 * It spends real requests: OpenRouter's free models allow about 50 a day,
 * and each question takes two or three. Keep runs small.
 */

import { openrouter } from "@openrouter/ai-sdk-provider";

import { createAskAgent } from "@/lib/ask/agent";
import type { AskBranch, AskContext } from "@/lib/ask/context";
import type { AskData } from "@/lib/ask/data";
import { askModelIds } from "@/lib/ask/settings";
import type { Actor } from "@/lib/permissions";
import type { ReorderLine } from "@/lib/queries/overview";
import { fakeData } from "@/test/ask-data";

const BRANCHES: readonly AskBranch[] = [
  { city: "Kumasi", id: "KSI", kind: "store", name: "Kumasi (Ahinsan)" },
  { city: "Amasaman", id: "AMS", kind: "store", name: "Amasaman" },
  { city: "Ashaiman", id: "ASH", kind: "store", name: "Ashaiman" },
  { city: "Accra", id: "SPX", kind: "store", name: "Spintex" },
  { city: "Weija", id: "WJA", kind: "store", name: "Weija" },
  {
    city: "Tema",
    id: "TMA",
    kind: "warehouse",
    name: "Tema Distribution Centre",
  },
];

const RICE = 41;

const manager: Actor = { branchId: "SPX", id: "m", role: "manager" };

const reorderLine = (
  productId: number,
  name: string,
  onHand: number,
  reorderPoint: number,
  extra: Partial<ReorderLine> = {}
): ReorderLine => ({
  branchId: "SPX",
  branchName: "Spintex",
  categoryName: "Groceries",
  inTransit: 0,
  name,
  onHand,
  onOrder: 0,
  productId,
  reorderPoint,
  requested: 0,
  sku: `SKU-${productId}`,
  supplierId: 1,
  supplierName: "Golden Harvest Foods",
  ...extra,
});

/** A small, known world: one rice line and a few low shelves at Spintex. */
const FIXTURES: Partial<AskData> = {
  product: async (id) =>
    await Promise.resolve(
      id === RICE
        ? {
            active: true,
            categoryName: "Rice & grains",
            id: RICE,
            name: "Long grain perfumed rice 5kg",
            sellPrice: 4800,
            sku: "RIC-PERF-5",
            supplierName: "Golden Harvest Foods",
            unit: "each" as const,
          }
        : null
    ),
  productInTransit: async () => await Promise.resolve(new Map([["KSI", 20]])),
  productLevels: async () =>
    await Promise.resolve(
      [
        ["SPX", 34],
        ["WJA", 0],
        ["ASH", 12],
        ["AMS", 5],
        ["KSI", 18],
        ["TMA", 240],
      ].map(([branchId, onHand]) => ({
        binLocation: null,
        branchId: String(branchId),
        onHand: Number(onHand),
        stocked: true,
      }))
    ),
  productOnOrder: async () => await Promise.resolve(new Map([["SPX", 60]])),
  productRequested: async () => await Promise.resolve(new Map([["WJA", 30]])),
  productUnitsSold: async () =>
    await Promise.resolve(
      new Map([
        ["SPX", 41],
        ["KSI", 22],
      ])
    ),
  reorderLines: async () =>
    await Promise.resolve([
      reorderLine(7, "Milo 400g tin", 0, 24, { onOrder: 48 }),
      reorderLine(9, "Frytol cooking oil 1L", 3, 30),
      reorderLine(12, "Peak milk powder 400g", 6, 20, { inTransit: 12 }),
    ]),
  searchProducts: async (_scope, text) =>
    await Promise.resolve(
      text.toLowerCase().includes("rice")
        ? [
            {
              active: true,
              id: RICE,
              name: "Long grain perfumed rice 5kg",
              sku: "RIC-PERF-5",
            },
          ]
        : []
    ),
};

interface Case {
  readonly id: string;
  readonly question: string;
  /** Data calls that must happen (a tool read what it should). */
  readonly reads: readonly (keyof AskData)[];
  /** Data calls that must not happen (a leak). */
  readonly forbidden: readonly (keyof AskData)[];
  /** Text the answer must contain, each a list of acceptable spellings. */
  readonly says: readonly (readonly string[])[];
}

const CASES: readonly Case[] = [
  {
    forbidden: [],
    id: "rice",
    question:
      "How many bags of the 5kg perfumed rice does Kumasi have, and is any on the way there?",
    reads: ["searchProducts", "productLevels"],
    says: [["18"], ["20"], ["Kumasi"]],
  },
  {
    forbidden: [],
    id: "low",
    question: "What's running low here?",
    reads: ["reorderLines"],
    says: [["Milo"], ["Frytol"], ["Spintex"], ["/products/7"]],
  },
  {
    forbidden: ["shrinkage"],
    id: "refuse",
    question: "How much stock did Kumasi lose to shrinkage this month?",
    reads: [],
    says: [["own branch", "only see", "only your", "can't see", "cannot see"]],
  },
];

const contextFor = (viewer: Actor): AskContext => ({
  branches: BRANCHES,
  now: new Date(),
  scope: { branchId: "SPX", kind: "branch" },
  viewer,
});

interface Outcome {
  readonly passed: boolean;
  readonly problems: readonly string[];
  readonly ms: number;
  readonly tools: readonly string[];
  readonly answer: string;
}

const runCase = async (modelId: string, item: Case): Promise<Outcome> => {
  const { calls, data } = fakeData(FIXTURES);

  const agent = createAskAgent({
    companyName: "Akwaaba Mall",
    context: contextFor(manager),
    data,
    maxRetries: 0,
    model: openrouter(modelId),
    viewerName: "Ama Mensah",
  });

  if (agent === null) {
    throw new Error("The eval's viewer can't ask");
  }

  const started = performance.now();

  try {
    const result = await agent.generate({ prompt: item.question });
    const ms = Math.round(performance.now() - started);
    const read = new Set(calls.map((call) => call.name));
    const problems: string[] = [];

    for (const name of item.reads) {
      if (!read.has(name)) {
        problems.push(`didn't read ${name}`);
      }
    }

    for (const name of item.forbidden) {
      if (read.has(name)) {
        problems.push(`read ${name}`);
      }
    }

    const lower = result.text.toLowerCase();

    for (const options of item.says) {
      if (!options.some((option) => lower.includes(option.toLowerCase()))) {
        problems.push(`answer lacks ${options.join(" / ")}`);
      }
    }

    return {
      answer: result.text,
      ms,
      passed: problems.length === 0,
      problems,
      tools: result.steps.flatMap((step) =>
        step.toolCalls.map((call) => call.toolName)
      ),
    };
  } catch (error) {
    return {
      answer: "",
      ms: Math.round(performance.now() - started),
      passed: false,
      problems: [
        error instanceof Error ? error.message.slice(0, 200) : "error",
      ],
      tools: [],
    };
  }
};

const parseArgs = (args: readonly string[]) => {
  const models: string[] = [];
  let caseIds: string[] | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";

    if (arg === "--cases") {
      caseIds = (args[index + 1] ?? "").split(",");
      index += 1;
    } else if (arg !== "") {
      models.push(arg);
    }
  }

  return {
    cases:
      caseIds === null
        ? CASES
        : CASES.filter((item) => caseIds?.includes(item.id)),
    models: models.length > 0 ? models : askModelIds(),
  };
};

const main = async (): Promise<void> => {
  const { cases, models } = parseArgs(process.argv.slice(2));

  for (const modelId of models) {
    for (const item of cases) {
      // One at a time: free models are rate limited.
      // oxlint-disable-next-line no-await-in-loop
      const outcome = await runCase(modelId, item);
      const mark = outcome.passed ? "PASS" : "FAIL";

      process.stdout.write(
        `${mark} ${modelId} ${item.id} ${outcome.ms}ms tools=[${outcome.tools.join(",")}]\n`
      );

      for (const problem of outcome.problems) {
        process.stdout.write(`     - ${problem}\n`);
      }

      process.stdout.write(
        `     > ${outcome.answer.replaceAll("\n", " ").slice(0, 400)}\n`
      );
    }
  }
};

await main();
