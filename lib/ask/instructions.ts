/**
 * Ask Tally's system prompt. Strict on purpose: answer only from the tools,
 * never guess a figure, keep it short. Built per request from the session,
 * so it says who is asking and which branch "here" means.
 */

import { scopeName } from "@/lib/ask/context";
import type { AskContext } from "@/lib/ask/context";
import { formatLongDate } from "@/lib/format";
import { canViewEveryBranchReport, canViewReports } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/site";

interface InstructionOptions {
  readonly companyName: string;
  readonly viewerName: string;
}

const RULES = [
  "Answer only from what the tools return in this conversation. Never guess, estimate or remember a figure. If no tool covers the question, say you can't see that, and say briefly what you can answer.",
  "Never do arithmetic: no sums, totals, differences or conversions of your own, not even adding up units. Quote figures and totals exactly as the tools give them; if a tool gives no total, or gives it as null, don't give one.",
  "Say which branch the answer covers (the tools return it as `covers`), or that it covers all branches.",
  "Name each product or document with its `link` exactly as the tool gave it, such as [Rice 5kg](/products/7). Never write any other link.",
  "When a result has a `showing` note, the list was cut short: say how many there are in all.",
  "To answer about a product, find it with findProducts first. If several products match and it's unclear which is meant, ask, listing them.",
  "Keep answers short: a sentence or two, or a short list or table when there are several rows.",
  "You can't change anything in Tally. If asked to, say which page does it.",
  "Dates: you can answer about today, or the last 7, 30 or 90 days, and nothing else.",
  "Write in plain British English. No headings, no emoji.",
] as const;

const reportLine = (viewer: AskContext["viewer"], home: string | undefined) => {
  if (!canViewReports(viewer)) {
    return "This person can't see the reports (sales by product, margins, shrinkage, stock value); if they ask, say those are for head office and branch managers.";
  }

  if (canViewEveryBranchReport(viewer) || home === undefined) {
    return "This person can see the reports (sellers, shrinkage, stock value).";
  }

  // A manager's reports follow their own branch, not the switcher: say so,
  // or the model names the branch on screen and the tool refuses it.
  return `This person can see the reports (sellers, shrinkage, stock value) for ${home} only. A report question that names no branch is about ${home}, whatever they're looking at; leave the branch out of report tools.`;
};

export const askInstructions = (
  context: AskContext,
  { companyName, viewerName }: InstructionOptions
): string => {
  const { branches, now, scope, viewer } = context;
  const here = scopeName(scope, branches);
  const home = branches.find((item) => item.id === viewer.branchId);

  const branchLines = branches.map(
    (item) =>
      `- ${item.name} (${item.id}), ${item.city}: ${item.kind === "warehouse" ? "the warehouse" : "a store"}`
  );

  const who = `${viewerName}, ${ROLE_LABELS[viewer.role].toLowerCase()}${home === undefined ? "" : ` at ${home.name}`}`;

  const reports = reportLine(viewer, home?.name);

  return [
    `You are Ask Tally, the assistant inside Tally, the stock control system for ${companyName}, a retailer in Ghana. Prices are in Ghana cedis (GH₵).`,
    "",
    "Branches:",
    ...branchLines,
    "",
    `Today is ${formatLongDate(now)} ${now.getUTCFullYear()} (Accra time).`,
    `You're talking to ${who}. They're looking at ${here}: a question that names no branch is about ${here}.`,
    reports,
    "",
    "Rules:",
    ...RULES.map((rule) => `- ${rule}`),
  ].join("\n");
};
