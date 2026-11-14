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

/*
 * EAN-13 bars. Each digit is seven modules (1 = bar, 0 = space). The left six
 * use the L or G set, chosen by the first digit, which is never drawn; the
 * right six use R. Guards frame both halves: 3 + 42 + 5 + 42 + 3 = 95.
 */
const L_CODES = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
] as const;

const invert = (code: string): string =>
  code.replaceAll("0", "x").replaceAll("1", "0").replaceAll("x", "1");

const R_CODES = L_CODES.map(invert);
const G_CODES = R_CODES.map((code) => code.split("").toReversed().join(""));

/** Which set (L or G) each left-hand digit uses, keyed by the first digit. */
const PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
] as const;

const EAN13 = /^\d{13}$/u;

/** The 95 modules of an EAN-13 code, as a string of 0s and 1s. */
export const ean13Modules = (code: string): string => {
  if (!(EAN13.test(code) && isValidGtin(code))) {
    throw new Error(`Not a valid EAN-13 code: ${code}`);
  }

  const digits = code.split("").map(Number);
  const [first, ...rest] = digits;
  const parity = PARITY[first ?? 0];

  const left = rest
    .slice(0, 6)
    .map((digit, index) =>
      parity[index] === "G" ? G_CODES[digit] : L_CODES[digit]
    )
    .join("");

  const right = rest
    .slice(6)
    .map((digit) => R_CODES[digit])
    .join("");

  return `101${left}01010${right}101`;
};

/** Each bar as a start module and a width, ready to draw. */
export const barRuns = (
  modules: string
): readonly { readonly x: number; readonly width: number }[] => {
  const runs: { x: number; width: number }[] = [];

  for (const [x, module] of modules.split("").entries()) {
    const last = runs.at(-1);

    if (module !== "1") {
      continue;
    }

    if (last !== undefined && last.x + last.width === x) {
      last.width += 1;
    } else {
      runs.push({ width: 1, x });
    }
  }

  return runs;
};
