/**
 * Ask Tally's agent: the tools for this person, the system prompt, and the
 * caps. The model is passed in, so tests run the loop against a mock.
 */

import { isStepCount, ToolLoopAgent } from "ai";
import type { LanguageModel, ToolSet } from "ai";

import type { AskContext } from "@/lib/ask/context";
import type { AskData } from "@/lib/ask/data";
import { askInstructions } from "@/lib/ask/instructions";
import { ASK_MAX_OUTPUT_TOKENS, ASK_MAX_STEPS } from "@/lib/ask/settings";
import { askTools } from "@/lib/ask/tools";

interface AskAgentOptions {
  readonly model: LanguageModel;
  readonly context: AskContext;
  readonly data: AskData;
  readonly companyName: string;
  readonly viewerName: string;
  /**
   * Retries after a failed model call. Free models are rate limited, so a
   * retry mostly spends the day's allowance; one is enough.
   */
  readonly maxRetries?: number;
}

/**
 * The agent for someone `canAskTally` allows. The route checks that first;
 * asking for a cashier's agent is a bug, so it throws.
 */
export const createAskAgent = ({
  companyName,
  context,
  data,
  maxRetries = 1,
  model,
  viewerName,
}: AskAgentOptions) => {
  const tools = askTools({ context, data });

  if (tools === null) {
    throw new Error(
      "Ask Tally isn't for this person: check canAskTally first."
    );
  }

  const sdkTools: ToolSet = {};

  for (const [name, definition] of Object.entries(tools)) {
    if (definition !== undefined) {
      sdkTools[name] = definition.sdk;
    }
  }

  return new ToolLoopAgent({
    instructions: askInstructions(context, { companyName, viewerName }),
    maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    maxRetries,
    model,
    // The last step is offered no tools, so it can only write: an answer
    // that ran out of steps on tools would otherwise end with nothing to say.
    prepareStep: ({ stepNumber }) =>
      stepNumber >= ASK_MAX_STEPS - 1 ? { activeTools: [] } : undefined,
    stopWhen: isStepCount(ASK_MAX_STEPS),
    tools: sdkTools,
  });
};
