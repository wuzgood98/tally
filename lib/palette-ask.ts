/**
 * The palette's way into Ask Tally: one row, "Ask Tally" while nothing is
 * typed and "Ask Tally: “…”" once something is, carrying the text over. It
 * always matches, so a search that finds nothing still offers to ask.
 */

import {
  isResultValue,
  LOWEST_RESULT_SCORE,
  MIN_SEARCH_LENGTH,
} from "@/lib/palette-results";

export const ASK_VALUE = "ask-tally";

/** Typed into an empty palette, opens Ask Tally. */
export const ASK_KEY = "?";

/** Any score above zero shows the row; markup order keeps it last. */
const ALWAYS = 1;

/**
 * Below every product and document result, so the top result is highlighted,
 * not the offer to ask. From the moment a search starts: once highlighted,
 * the row would keep the highlight when the results arrived.
 */
const BELOW_RESULTS = LOWEST_RESULT_SCORE / 2;

const QUOTE_LIMIT = 60;

export const askRowLabel = (query: string): string => {
  const text = query.trim();

  if (text === "") {
    return "Ask Tally";
  }

  const quoted =
    text.length > QUOTE_LIMIT ? `${text.slice(0, QUOTE_LIMIT - 1)}…` : text;

  return `Ask Tally: “${quoted}”`;
};

/**
 * The row's score for the typed text: it always shows, but gives way once
 * the text is long enough to search products and documents, so Enter (or
 * Ctrl+C) acts on the top result.
 */
export const askScore = (text: string): number =>
  text.trim().length >= MIN_SEARCH_LENGTH ? BELOW_RESULTS : ALWAYS;

/**
 * Whether results that have just arrived take the highlight from this value:
 * from nothing, from this row or from the last search's results, but not
 * from a page or action the person may be heading for.
 */
export const takesResultHighlight = (value: string | null): boolean =>
  value === null || value === ASK_VALUE || isResultValue(value);

/** Typing "?" into an empty palette opens Ask Tally. */
export const opensAsk = (previous: string, next: string): boolean =>
  previous === "" && next === ASK_KEY;
