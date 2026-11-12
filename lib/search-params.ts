/** Reading Next.js searchParams safely: one string per key, anything else ignored. */

type RawParams = Record<string, string | string[] | undefined>;

/** A repeated key (?a=1&a=2) arrives as an array; only a single value counts. */
export const param = (params: RawParams, key: string): string => {
  const value = params[key];

  return value === undefined || Array.isArray(value) ? "" : value;
};

/** A positive whole number, or the fallback. */
export const intParam = (
  params: RawParams,
  key: string,
  fallback: number
): number => {
  const value = Number(param(params, key));

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

/** One of the allowed values, or the fallback. */
export const enumParam = <T extends string>(
  params: RawParams,
  key: string,
  allowed: readonly T[],
  fallback: T
): T => {
  const value = param(params, key);

  return allowed.find((item) => item === value) ?? fallback;
};

/** Builds a query string from the non-empty entries. */
export const queryString = (
  entries: Record<string, string | number | null | undefined>
): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(entries)) {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const text = search.toString();

  return text ? `?${text}` : "";
};

const LINE_PATTERN = /^(?<id>\d+):(?<quantity>\d+)$/u;

/**
 * "?lines=12:40,15:10": products and quantities to pre-fill a form with, e.g.
 * from the low-stock list. Anything malformed is skipped, and at most `max`.
 */
export const lineParam = (
  text: string,
  max: number
): { id: number; quantity: number }[] =>
  text
    .split(",")
    .slice(0, max)
    .flatMap((part) => {
      const match = LINE_PATTERN.exec(part.trim());

      if (match === null) {
        return [];
      }

      const id = Number(match.groups?.id);
      const quantity = Number(match.groups?.quantity);

      return Number.isSafeInteger(id) &&
        id > 0 &&
        Number.isSafeInteger(quantity)
        ? [{ id, quantity }]
        : [];
    });
