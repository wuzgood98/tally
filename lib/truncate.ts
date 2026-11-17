/** Room kept at the end of a cut name: "rice 25 kg", "2.8 L, red". */
const TAIL_LENGTH = 12;

/** A single long word keeps this many letters at its end. */
const WORD_TAIL_LENGTH = 6;

/**
 * Splits a name so CSS can cut its middle: the head truncates with an
 * ellipsis while the tail (its last words, which carry the size or variant
 * that tells products apart) always shows. Head and tail together are the
 * whole name; the tail keeps its leading space.
 */
export const splitForMiddleTruncation = (
  name: string
): readonly [head: string, tail: string] => {
  const words = name.split(" ");

  if (words.length === 1) {
    const cut = Math.max(0, name.length - WORD_TAIL_LENGTH);

    return [name.slice(0, cut), name.slice(cut)];
  }

  // Keep at least the first word in the head, so there is a middle to cut.
  let first = words.length - 1;

  while (first > 1 && words.slice(first - 1).join(" ").length <= TAIL_LENGTH) {
    first -= 1;
  }

  return [words.slice(0, first).join(" "), ` ${words.slice(first).join(" ")}`];
};
