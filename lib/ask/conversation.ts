/**
 * What the Ask Tally panel reads from a conversation, kept pure so it can
 * be tested: which links an answer may follow, what's happening while the
 * tools run, and what to say when something fails.
 */

import type { UIMessage } from "ai";
import { z } from "zod";

import { ALL_WORDS } from "@/lib/ask/context";

/** A markdown link to a page of Tally's: `[Milo 400g](/products/7)`. */
// The label holds no brackets or quotes, so in the tools' JSON a match
// can't start at an array's "[" or run across two values.
const MARKDOWN_LINK = /\[(?<label>[^"[\]]+)\]\((?<href>\/[^")\s]*)\)/gu;

/** Labels this short would match inside other words. */
const MIN_LABEL_LENGTH = 4;

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/gu;

/**
 * Every record the tools handed the model in these messages, label to
 * link. An answer may only link to these: anything else the model writes
 * as a link stays plain text.
 */
export const toolLinks = (
  messages: readonly UIMessage[]
): Map<string, string> => {
  const links = new Map<string, string>();

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "dynamic-tool" && part.state === "output-available") {
        for (const match of JSON.stringify(part.output).matchAll(
          MARKDOWN_LINK
        )) {
          const { href, label } = match.groups ?? {};

          if (href !== undefined && label !== undefined) {
            links.set(label, href);
          }
        }
      }
    }
  }

  return links;
};

/**
 * Links the records an answer names but didn't link. Free models often
 * write a document number in bold rather than copy its link; the link
 * comes from the tool, never from the model.
 */
export const linkRecords = (
  text: string,
  links: ReadonlyMap<string, string>
): string => {
  const labels = [...links.keys()]
    .filter((label) => label.length >= MIN_LABEL_LENGTH)
    .toSorted((a, b) => b.length - a.length)
    .map((label) => label.replaceAll(REGEX_SPECIALS, "\\$&"));

  if (labels.length === 0) {
    return text;
  }

  // Not already a link's text: no "[" before it, no "](" after it.
  const named = new RegExp(`(?<!\\[)(?:${labels.join("|")})(?!\\]\\()`, "gu");

  return text.replaceAll(named, (label) => {
    const href = links.get(label);

    return href === undefined ? label : `[${label}](${href})`;
  });
};

const TOOL_PHRASES = new Map([
  ["bestSellers", "Checking the best sellers"],
  ["findProducts", "Looking up products"],
  ["lowStock", "Checking what's low"],
  ["productStock", "Checking stock"],
  ["purchaseOrders", "Checking purchase orders"],
  ["recentReceipts", "Checking deliveries"],
  ["sellersReport", "Reading the sellers report"],
  ["shrinkageReport", "Reading the shrinkage report"],
  ["stockRequests", "Checking stock requests"],
  ["stockSummary", "Adding up the stock"],
  ["stockValueReport", "Reading the stock value report"],
  ["todaysSales", "Checking today's sales"],
  ["transfers", "Checking transfers"],
]);

const branchInput = z.object({ branch: z.string().max(60).optional() });

/**
 * The quiet line shown while an answer is on its way: what the tools are
 * doing ("Checking what's low at Kumasi…"), or "Thinking…" between them.
 */
export const askStatusLine = (message: UIMessage | undefined): string => {
  const running = message?.parts.findLast(
    (part) =>
      part.type === "dynamic-tool" &&
      (part.state === "input-streaming" || part.state === "input-available")
  );

  if (running?.type !== "dynamic-tool") {
    return "Thinking…";
  }

  const phrase = TOOL_PHRASES.get(running.toolName) ?? "Checking";
  const input = branchInput.safeParse(running.input);
  const branch = input.success ? input.data.branch?.trim() : undefined;

  if (branch === undefined || branch === "") {
    return `${phrase}…`;
  }

  return ALL_WORDS.has(branch.toLowerCase())
    ? `${phrase} across all branches…`
    : `${phrase} at ${branch}…`;
};

/** Said when anything fails that has no message of its own. */
export const ASK_FAILED = "Ask Tally couldn't answer just now. Try again.";

const routeError = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

/** Codes where asking again at once won't help. */
const FINAL_CODES = new Set(["rate_limited", "invalid_input", "not_found"]);

export interface AskFailure {
  readonly message: string;
  /** Worth a Retry button. */
  readonly retry: boolean;
}

const parseJson = (text: string) => {
  try {
    return routeError.safeParse(JSON.parse(text));
  } catch {
    return null;
  }
};

/**
 * What to say about a failed question. The route answers errors as
 * `{ error: { code, message } }`, which the chat hook passes on as the
 * error's message; a failure mid-answer arrives as its own text.
 */
export const askFailure = (error: Error): AskFailure => {
  const parsed = parseJson(error.message);

  if (parsed?.success === true) {
    return {
      message: parsed.data.error.message,
      retry: !FINAL_CODES.has(parsed.data.error.code),
    };
  }

  return { message: ASK_FAILED, retry: true };
};
