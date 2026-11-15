/**
 * The questions an empty Ask Tally offers. Fixed in code (no model call),
 * worded for this person and the branch they're looking at, and only ones
 * the tools can answer for them.
 */

import type { AskScope } from "@/lib/ask/context";
import {
  canAskTally,
  canViewBranchReport,
  canViewEveryBranchReport,
} from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";

/** The branch on screen, or null for all branches. */
export interface SuggestionPlace {
  readonly id: string;
  readonly name: string;
  readonly kind: "store" | "warehouse";
}

const MAX_SUGGESTIONS = 4;

export const askSuggestions = (
  actor: Actor,
  here: SuggestionPlace | null
): string[] => {
  if (here === null) {
    return [
      "What's running low across the branches?",
      "Which transfers are still on the road?",
      "What sold best this week?",
      // A manager's reports cover their own branch only.
      canViewEveryBranchReport(actor)
        ? "Which branch lost the most to shrinkage this month?"
        : "Which purchase orders are still due?",
    ];
  }

  const atHere = `at ${here.name}`;

  const questions =
    here.kind === "warehouse"
      ? [
          `What's running low ${atHere}?`,
          "Which stock requests are waiting to be fulfilled?",
          `Which purchase orders are still due ${atHere}?`,
        ]
      : [
          `What's running low ${atHere}?`,
          `What's on the way to ${here.name}?`,
          `What sold best ${atHere} this week?`,
        ];

  const last = canViewBranchReport(actor, here.id)
    ? `How much stock did ${here.name} lose this month?`
    : "Which deliveries came in most recently?";

  return [...questions, last].slice(0, MAX_SUGGESTIONS);
};

/**
 * What the palette needs for Ask Tally: its suggestions, or null when Ask
 * Tally is off or isn't for this person.
 */
export const askPaletteSettings = (
  actor: Actor,
  scope: AskScope,
  branches: readonly SuggestionPlace[],
  /** From `askTallyOn()`: the server's key and the company's opt-in. */
  on: boolean
): { readonly suggestions: readonly string[] } | null => {
  if (!on || !canAskTally(actor)) {
    return null;
  }

  const here =
    scope.kind === "branch"
      ? branches.find((item) => item.id === scope.branchId)
      : undefined;

  return { suggestions: askSuggestions(actor, here ?? null) };
};
