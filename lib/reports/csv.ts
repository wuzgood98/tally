/**
 * Report downloads as CSV, for Excel or Google Sheets. Amounts are cedis with
 * two decimals (no currency sign, so they stay numbers in a spreadsheet).
 */

/** Numbers go in already formatted (see `cedisCell`), so every cell is text. */
export type Cell = string | null;

const NEEDS_QUOTES = /[",\r\n]/u;

/**
 * A spreadsheet treats a cell starting with = + - @ as a formula, so text
 * (a product name, say) gets a leading apostrophe; a plain number, negative
 * or not, is left alone so it stays a number.
 */
const FORMULA_START = /^[=+\-@\t\r]/u;
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/u;

const csvCell = (cell: Cell): string => {
  if (cell === null) {
    return "";
  }

  const safe =
    FORMULA_START.test(cell) && !PLAIN_NUMBER.test(cell) ? `'${cell}` : cell;

  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

/** Pesewas as a cedi amount: 123456 → "1234.56". */
export const cedisCell = (pesewas: number): string =>
  (Math.round(pesewas) / 100).toFixed(2);

export const toCsv = (rows: readonly (readonly Cell[])[]): string =>
  `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;

const BYTE_ORDER_MARK = String.fromCodePoint(0xfe_ff);

/** A download, with a byte-order mark so Excel reads it as UTF-8. */
export const csvResponse = (
  filename: string,
  rows: readonly (readonly Cell[])[]
) =>
  new Response(`${BYTE_ORDER_MARK}${toCsv(rows)}`, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
