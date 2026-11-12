/**
 * GTIN barcodes (EAN-8, UPC-A, EAN-13, GTIN-14) end in a check digit: weight
 * the other digits 3, 1, 3, 1… from the right, and the check digit brings the
 * sum to a multiple of ten. It catches most mistyped or misread codes.
 */

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** Check digit for a GTIN body (everything but the last digit). */
export const gtinCheckDigit = (body: string): number => {
  let sum = 0;

  for (const [offset, digit] of body.split("").toReversed().entries()) {
    sum += Number(digit) * (offset % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10;
};

export const isValidGtin = (code: string): boolean =>
  /^\d+$/u.test(code) &&
  GTIN_LENGTHS.has(code.length) &&
  gtinCheckDigit(code.slice(0, -1)) === Number(code.at(-1));
