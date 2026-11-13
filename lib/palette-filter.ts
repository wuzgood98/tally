interface Searchable {
  readonly label: string;
  readonly keywords?: readonly string[];
}

const WHITESPACE = /\s+/u;

const LABEL_STARTS = 3;
const LABEL_WORDS = 2;
const KEYWORD_WORDS = 1;
const NO_MATCH = 0;

const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(WHITESPACE)
    .filter((word) => word !== "");

const everyTokenStartsAWord = (
  tokens: readonly string[],
  words: readonly string[]
): boolean =>
  tokens.every((token) => words.some((word) => word.startsWith(token)));

/**
 * How well a command matches what was typed, for the palette's `filter`:
 * every typed word must start a word of the label or its keywords. Letters
 * scattered through a word don't count, so "rep" finds Reports, not the
 * "receipts" keyword on Sales. Higher scores rank first; 0 hides it.
 */
export const paletteScore = (item: Searchable, query: string): number => {
  const tokens = wordsOf(query);

  if (tokens.length === 0) {
    return KEYWORD_WORDS;
  }

  const label = item.label.toLowerCase();

  if (label.startsWith(tokens.join(" "))) {
    return LABEL_STARTS;
  }

  const labelWords = wordsOf(label);

  if (everyTokenStartsAWord(tokens, labelWords)) {
    return LABEL_WORDS;
  }

  const allWords = [
    ...labelWords,
    ...(item.keywords ?? []).flatMap((keyword) => wordsOf(keyword)),
  ];

  return everyTokenStartsAWord(tokens, allWords) ? KEYWORD_WORDS : NO_MATCH;
};
