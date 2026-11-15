/** What's printed on a staff badge, worked out from the account. Pure. */

import { gtinCheckDigit } from "@/lib/barcode";

const GHANA_PREFIX = "603";
const BODY_DIGITS = 9;
const HASH_MODULUS = 10 ** BODY_DIGITS;
const HASH_BASE = 31;

/**
 * A made-up but valid EAN-13 for the bars on someone's badge, the same for
 * them every time: Ghana's GS1 prefix, nine digits from their id, and the
 * check digit.
 */
export const badgeBarcode = (userId: string): string => {
  let hash = 0;

  for (const char of userId) {
    hash = (hash * HASH_BASE + (char.codePointAt(0) ?? 0)) % HASH_MODULUS;
  }

  const body = `${GHANA_PREFIX}${String(hash).padStart(BODY_DIGITS, "0")}`;

  return `${body}${gtinCheckDigit(body)}`;
};

/** Two letters for the badge photo and the sidebar avatar. */
export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
