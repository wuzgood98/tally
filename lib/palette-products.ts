import type { PaletteProduct } from "@/lib/palette-search";

export type ProductSearch = (text: string) => Promise<PaletteProduct[]>;

const PRODUCT_PREFIX = "product:";
export const SEE_ALL_PRODUCTS = "products:all";

/** Names need two letters to be worth a round trip; scans are far longer. */
export const MIN_PRODUCT_QUERY = 2;

/** Above any page or action, so a scanned barcode is what Enter opens. */
const EXACT_SCORE = 4;

/** Below every page or action that matches, above "See all". */
const PRODUCT_SCORE = 0.5;
const SEE_ALL_SCORE = 0.1;

export const productValue = (id: number): string => `${PRODUCT_PREFIX}${id}`;

/** Where a product result goes, or null when the value isn't one. */
export const productHref = (value: string, query: string): string | null => {
  if (value === SEE_ALL_PRODUCTS) {
    return `/products?q=${encodeURIComponent(query.trim())}`;
  }

  return value.startsWith(PRODUCT_PREFIX)
    ? `/products/${value.slice(PRODUCT_PREFIX.length)}`
    : null;
};

/**
 * The server already matched these, so they skip the palette's own filter;
 * this only places them among the pages and actions.
 */
export const productScore = (
  value: string,
  products: readonly PaletteProduct[]
): number | null => {
  if (value === SEE_ALL_PRODUCTS) {
    return SEE_ALL_SCORE;
  }

  if (!value.startsWith(PRODUCT_PREFIX)) {
    return null;
  }

  const found = products.find((item) => productValue(item.id) === value);

  return found?.exact === true ? EXACT_SCORE : PRODUCT_SCORE;
};
