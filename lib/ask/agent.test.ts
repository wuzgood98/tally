import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { createAskAgent } from "@/lib/ask/agent";
import type { AskBranch, AskContext } from "@/lib/ask/context";
import { ASK_MAX_OUTPUT_TOKENS, ASK_MAX_STEPS } from "@/lib/ask/settings";
import type { Actor } from "@/lib/permissions";
import { fakeData } from "@/test/ask-data";

const BRANCHES: readonly AskBranch[] = [
  { city: "Kumasi", id: "KSI", kind: "store", name: "Kumasi (Ahinsan)" },
  { city: "Accra", id: "SPX", kind: "store", name: "Spintex" },
];

const manager: Actor = { branchId: "SPX", id: "m", role: "manager" };
const storekeeper: Actor = { branchId: "SPX", id: "s", role: "storekeeper" };
const cashier: Actor = { branchId: "SPX", id: "c", role: "cashier" };

const contextFor = (viewer: Actor): AskContext => ({
  branches: BRANCHES,
  now: new Date("2026-11-15T12:00:00Z"),
  scope: { branchId: "SPX", kind: "branch" },
  viewer,
});

const USAGE = {
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: 10,
    total: 10,
  },
  outputTokens: { reasoning: undefined, text: 10, total: 10 },
};

/** What the mock model returns from one call. */
type Generated = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

const callTool = (
  toolName: string,
  input: Readonly<Record<string, string>>,
  id = "call-1"
): Generated => ({
  content: [
    {
      input: JSON.stringify(input),
      toolCallId: id,
      toolName,
      type: "tool-call" as const,
    },
  ],
  finishReason: { raw: undefined, unified: "tool-calls" as const },
  usage: USAGE,
  warnings: [],
});

const answer = (text: string): Generated => ({
  content: [{ text, type: "text" as const }],
  finishReason: { raw: undefined, unified: "stop" as const },
  usage: USAGE,
  warnings: [],
});

/** A model that gives these responses in turn, repeating the last. */
const scriptedModel = (responses: readonly Generated[]) => {
  let turn = 0;

  return new MockLanguageModelV4({
    doGenerate: async () => {
      const response = responses[Math.min(turn, responses.length - 1)];
      turn += 1;

      if (response === undefined) {
        throw new Error("No scripted response");
      }

      return await Promise.resolve(response);
    },
  });
};

const agentFor = (
  viewer: Actor,
  model: MockLanguageModelV4,
  data = fakeData().data
) =>
  createAskAgent({
    companyName: "Akwaaba Mall",
    context: contextFor(viewer),
    data,
    model,
    viewerName: "Ama Owusu",
  });

/** The tools the agent offered the model on its first call. */
const offered = (model: MockLanguageModelV4): string[] =>
  model.doGenerateCalls[0]?.tools?.map((item) => item.name) ?? [];

describe("createAskAgent", () => {
  it("refuses to build an agent for a cashier", () => {
    expect(() => agentFor(cashier, scriptedModel([answer("Hi")]))).toThrow(
      "check canAskTally first"
    );
  });

  it("runs a tool from the session's scope and answers from its result", async () => {
    const { calls, data } = fakeData({
      stockTotals: async () =>
        await Promise.resolve({
          costValue: 1_234_500,
          linesInStock: 40,
          lowLines: 3,
          outLines: 1,
          retailValue: 2_000_000,
          units: 900,
        }),
    });

    const model = scriptedModel([
      callTool("stockSummary", {}),
      answer("At Spintex: GH₵12,345.00 at cost."),
    ]);

    const result = await agentFor(manager, model, data).generate({
      prompt: "What's our stock worth?",
    });

    expect(result.text).toBe("At Spintex: GH₵12,345.00 at cost.");
    expect(calls).toEqual([
      { args: [{ branchId: "SPX", kind: "branch" }], name: "stockTotals" },
    ]);
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain(
      "GH₵12,345.00"
    );
  });

  it("offers the report tools only to those who can see reports", async () => {
    const managerModel = scriptedModel([answer("Hi")]);
    const storekeeperModel = scriptedModel([answer("Hi")]);

    await agentFor(manager, managerModel).generate({ prompt: "Hi" });
    await agentFor(storekeeper, storekeeperModel).generate({ prompt: "Hi" });

    expect(offered(managerModel)).toContain("shrinkageReport");
    expect(offered(storekeeperModel)).toContain("lowStock");
    expect(offered(storekeeperModel)).not.toContain("shrinkageReport");
  });

  it("stops at the step cap, with a last step that can only answer", async () => {
    const toolSteps = Array.from({ length: ASK_MAX_STEPS - 1 }, (_, index) =>
      callTool("lowStock", {}, `call-${index}`)
    );

    const model = scriptedModel([...toolSteps, answer("Three lines are low.")]);

    const result = await agentFor(storekeeper, model).generate({
      prompt: "Keep going",
    });

    expect(result.steps).toHaveLength(ASK_MAX_STEPS);
    expect(result.text).toBe("Three lines are low.");
    expect(model.doGenerateCalls[0]?.tools?.length).toBeGreaterThan(0);
    expect(model.doGenerateCalls.at(-1)?.tools ?? []).toEqual([]);
    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(
      ASK_MAX_OUTPUT_TOKENS
    );
  });

  it("passes a refusal back to the model rather than reading another branch", async () => {
    const { calls, data } = fakeData();

    const model = scriptedModel([
      callTool("sellersReport", { branch: "Kumasi" }),
      answer("You can only see Spintex's reports."),
    ]);

    await agentFor(manager, model, data).generate({
      prompt: "How did Kumasi sell?",
    });

    expect(calls).toEqual([]);
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain(
      "Managers see reports for their own branch only (Spintex)."
    );
  });
});
