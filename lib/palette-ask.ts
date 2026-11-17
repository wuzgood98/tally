/**
 * The palette's way into Ask Tally: one row, "Ask Tally" while nothing is
 * typed and "Ask Tally: “…”" once something is, carrying the text over. It
 * always matches, so a search that finds nothing still offers to ask.
 */

export const ASK_VALUE = "ask-tally";

/** Typed into an empty palette, opens Ask Tally. */
export const ASK_KEY = "?";

/** Any score above zero shows the row; markup order keeps it last. */
const ALWAYS = 1;

/**
 * Below every product and document result (the lowest, See all, is 0.1), so
 * the top result is highlighted, not the offer to ask. From the moment a
 * search starts: once highlighted, the row would keep the highlight when the
 * results arrived.
 */
const BELOW_RESULTS = 0.05;

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
 * The row's score for the palette's filter: it always shows, but gives way
 * while products and documents are searched, so Enter (or Ctrl+C) acts on
 * the top result.
 */
export const askScore = (searching: boolean): number =>
  searching ? BELOW_RESULTS : ALWAYS;

/** Typing "?" into an empty palette opens Ask Tally. */
export const opensAsk = (previous: string, next: string): boolean =>
  previous === "" && next === ASK_KEY;
