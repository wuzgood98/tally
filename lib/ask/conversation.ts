/**
 * What the Ask Tally panel reads from a conversation, kept pure so it can
 * be tested: which links an answer may follow, what's happening while the
 * tools run, and what to say when something fails.
 */

import type { UIMessage } from "ai";
import { z } from "zod";

import { ALL_WORDS } from "@/lib/ask/context";
import { branchArgument } from "@/lib/ask/tool-kit";
import type { AskTools } from "@/lib/ask/tools";

/**
 * A record's link as a tool hands it over, `"link":"[Milo 400g](/products/7)"`
 * in the tool's JSON. Only the `link` field counts, so a product or supplier
 * name can't smuggle a link in, and only the record pages the tools link to:
 * never another site, not even `//host`.
 */
const TOOL_LINK =
  /"link":"\[(?<label>[^"[\]]+)\]\((?<href>\/(?:products|transfers|purchase-orders|requests|receipts)\/\d+)\)"/gu;

/** A link already in an answer: left exactly as it is. */
const ANSWER_LINK = /\[[^\]]*\]\([^)]*\)/u;

/** Labels this short would match inside other words. */
const MIN_LABEL_LENGTH = 4;

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/gu;

/** What an answer may link to. */
export interface ToolLinks {
  /** Every href the tools returned: the only ones an answer may follow. */
  readonly hrefs: ReadonlySet<string>;
  /**
   * Label to href, for naming records the answer didn't link. A label two
   * records share is left out: which one was meant can't be told.
   */
  readonly labels: ReadonlyMap<string, string>;
}

/** The text of a message's text parts, as one markdown string. */
export const messageText = (message: UIMessage): string => {
  const texts: string[] = [];

  for (const part of message.parts) {
    if (part.type === "text") {
      texts.push(part.text);
    }
  }

  return texts.join("\n\n").trim();
};

/**
 * Every record the tools handed the model in these messages. An answer may
 * only link to these: anything else the model writes as a link stays plain
 * text.
 */
export const toolLinks = (messages: readonly UIMessage[]): ToolLinks => {
  const hrefs = new Set<string>();
  const labels = new Map<string, string>();
  const shared = new Set<string>();

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "dynamic-tool" && part.state === "output-available") {
        for (const match of JSON.stringify(part.output).matchAll(TOOL_LINK)) {
          const { href, label } = match.groups ?? {};

          if (href !== undefined && label !== undefined) {
            hrefs.add(href);

            const known = labels.get(label);

            if (known !== undefined && known !== href) {
              shared.add(label);
            }

            labels.set(label, href);
          }
        }
      }
    }
  }

  for (const label of shared) {
    labels.delete(label);
  }

  return { hrefs, labels };
};

/**
 * Links the records an answer names but didn't link. Free models often
 * write a document number in bold rather than copy its link; the link
 * comes from the tool, never from the model. Only whole words match, and
 * existing links are left alone, so nothing nests.
 */
export const linkRecords = (
  text: string,
  labels: ReadonlyMap<string, string>
): string => {
  const names = [...labels.keys()]
    .filter((label) => label.length >= MIN_LABEL_LENGTH)
    .toSorted((a, b) => b.length - a.length)
    .map((label) => label.replaceAll(REGEX_SPECIALS, "\\$&"));

  if (names.length === 0) {
    return text;
  }

  const named = new RegExp(
    `${ANSWER_LINK.source}|(?<![\\p{L}\\p{N}])(?:${names.join("|")})(?![\\p{L}\\p{N}])`,
    "gu"
  );

  return text.replaceAll(named, (found) => {
    const href = labels.get(found);

    return href === undefined ? found : `[${found}](${href})`;
  });
};

/** What each tool is doing, for the status line. Every tool needs one. */
const TOOL_PHRASES: ReadonlyMap<string, string> = new Map(
  Object.entries({
    bestSellers: "Checking the best sellers",
    findProducts: "Looking up products",
    lowStock: "Checking what's low",
    productStock: "Checking stock",
    purchaseOrders: "Checking purchase orders",
    recentReceipts: "Checking deliveries",
    sellersReport: "Reading the sellers report",
    shrinkageReport: "Reading the shrinkage report",
    stockRequests: "Checking stock requests",
    stockSummary: "Adding up the stock",
    stockValueReport: "Reading the stock value report",
    todaysSales: "Checking today's sales",
    transfers: "Checking transfers",
  } satisfies Record<keyof AskTools, string>)
);

const branchInput = z.object({ branch: branchArgument });

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
const FINAL_CODES = new Set([
  "forbidden",
  "invalid_input",
  "not_found",
  "rate_limited",
  "unauthorized",
]);

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

/**
 * An answer that finished with no words: the model used up its steps on
 * tools, or sent nothing. The panel says so rather than show a blank.
 */
export const isEmptyAnswer = (message: UIMessage | undefined): boolean =>
  message?.role === "assistant" && messageText(message) === "";
