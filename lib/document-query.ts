/** Every kind of document number Tally prints, by its prefix. */
export const DOCUMENT_PREFIXES = [
  "PO",
  "GRN",
  "TRF",
  "REQ",
  "SAL",
  "RET",
] as const;

export type DocumentPrefix = (typeof DOCUMENT_PREFIXES)[number];

export interface DocumentQuery {
  readonly prefix: DocumentPrefix | null;
  /** A branch code, or the start of one: "SP" for SPX. */
  readonly branch: string | null;
  /** The serial as typed, leading zeros dropped: "000042" and "42" are both "42". */
  readonly serial: string;
  /** Typed like a document number rather than a product: rank documents first. */
  readonly documentLike: boolean;
}

const TOKENS = /[A-Z]+|\d+/gu;
const MAX_SERIAL_DIGITS = 9;
const MAX_BRANCH_LETTERS = 4;

/** Document serials are six digits; a longer run of digits is a barcode. */
const SERIAL_DIGITS = 6;

const isPrefix = (token: string): token is DocumentPrefix =>
  DOCUMENT_PREFIXES.some((prefix) => prefix === token);

/**
 * Reads what someone typed as a document number, forgivingly: "PO-SPX-000012",
 * "po spx 12", "spx-12", "trf 7" and "000042" all parse. Returns null unless
 * there's a serial number at the end, so plain words never search documents.
 */
export const parseDocumentQuery = (text: string): DocumentQuery | null => {
  const tokens = text.toUpperCase().match(TOKENS) ?? [];
  const last = tokens.at(-1);

  if (last === undefined || !/^\d+$/u.test(last)) {
    return null;
  }

  const serial = last.replace(/^0+(?=\d)/u, "");

  if (serial.length > MAX_SERIAL_DIGITS) {
    return null;
  }

  let prefix: DocumentPrefix | null = null;
  let branch: string | null = null;

  for (const token of tokens.slice(0, -1)) {
    if (prefix === null && branch === null && isPrefix(token)) {
      prefix = token;
    } else if (
      branch === null &&
      /^[A-Z]+$/u.test(token) &&
      token.length <= MAX_BRANCH_LETTERS
    ) {
      branch = token;
    } else {
      return null;
    }
  }

  return {
    branch,
    documentLike:
      prefix !== null || branch !== null || last.length <= SERIAL_DIGITS,
    prefix,
    serial,
  };
};
