import { parseDocumentQuery } from "@/lib/document-query";
import type { PaletteDocument } from "@/lib/palette-documents";
import type { PaletteProduct } from "@/lib/palette-search";

export interface PaletteResults {
  readonly products: readonly PaletteProduct[];
  readonly documents: readonly PaletteDocument[];
}

export type PaletteSearch = (text: string) => Promise<PaletteResults>;

export type PaletteHit =
  | { readonly type: "product"; readonly product: PaletteProduct }
  | { readonly type: "document"; readonly document: PaletteDocument };

const PRODUCT_PREFIX = "product:";
const DOCUMENT_PREFIX = "document:";
export const SEE_ALL_PRODUCTS = "products:all";

/** Two characters before asking the server; a scan or a number is far longer. */
export const MIN_SEARCH_LENGTH = 2;

/** A scanned barcode or whole SKU: what Enter opens. */
const EXACT_PRODUCT_SCORE = 4;

/** A whole document number: above any page, below a scan. */
const EXACT_DOCUMENT_SCORE = 3.5;

/** Pages and actions that match score 1 to 3; results sit below them. */
const DOCUMENT_FIRST_SCORE = 0.8;
const PRODUCT_SCORE = 0.5;
const DOCUMENT_LAST_SCORE = 0.3;
const SEE_ALL_SCORE = 0.1;

export const productValue = (id: number): string => `${PRODUCT_PREFIX}${id}`;

export const documentValue = (number: string): string =>
  `${DOCUMENT_PREFIX}${number}`;

export const hitsOf = (results: PaletteResults): PaletteHit[] => [
  ...results.products.map((product) => ({ product, type: "product" as const })),
  ...results.documents.map((document) => ({
    document,
    type: "document" as const,
  })),
];

/** Documents before products when the text reads like a document number. */
export const documentsFirst = (query: string): boolean =>
  parseDocumentQuery(query)?.documentLike === true;

/** Where a result goes, or null when the value is a page or an action. */
export const resultHref = (
  value: string,
  query: string,
  hits: readonly PaletteHit[]
): string | null => {
  if (value === SEE_ALL_PRODUCTS) {
    return `/products?q=${encodeURIComponent(query.trim())}`;
  }

  if (value.startsWith(PRODUCT_PREFIX)) {
    return `/products/${value.slice(PRODUCT_PREFIX.length)}`;
  }

  for (const hit of hits) {
    if (
      hit.type === "document" &&
      documentValue(hit.document.number) === value
    ) {
      return hit.document.href;
    }
  }

  return null;
};

/**
 * Whether results that have just arrived take the highlight from this value:
 * from nothing, from "Ask Tally" (`askValue`) or from the last search's
 * results, but not from a page or action the person may be heading for.
 */
export const takesResultHighlight = (
  value: string | null,
  askValue: string
): boolean =>
  value === null ||
  value === askValue ||
  value === SEE_ALL_PRODUCTS ||
  value.startsWith(PRODUCT_PREFIX) ||
  value.startsWith(DOCUMENT_PREFIX);

/** The product a command value stands for, or null for anything else. */
export const productOf = (
  value: string | null,
  hits: readonly PaletteHit[]
): PaletteProduct | null => {
  if (value === null || !value.startsWith(PRODUCT_PREFIX)) {
    return null;
  }

  for (const hit of hits) {
    if (hit.type === "product" && productValue(hit.product.id) === value) {
      return hit.product;
    }
  }

  return null;
};

const hitScore = (hit: PaletteHit, query: string): number => {
  if (hit.type === "product") {
    return hit.product.exact ? EXACT_PRODUCT_SCORE : PRODUCT_SCORE;
  }

  if (hit.document.exact) {
    return EXACT_DOCUMENT_SCORE;
  }

  return documentsFirst(query) ? DOCUMENT_FIRST_SCORE : DOCUMENT_LAST_SCORE;
};

/** The value of the result that ranks highest, or null when there's none. */
export const topResult = (
  query: string,
  hits: readonly PaletteHit[]
): string | null => {
  let top: { value: string; score: number } | null = null;

  for (const hit of hits) {
    const value =
      hit.type === "product"
        ? productValue(hit.product.id)
        : documentValue(hit.document.number);

    const score = hitScore(hit, query);

    if (top === null || score > top.score) {
      top = { score, value };
    }
  }

  return top?.value ?? null;
};

/**
 * The server already matched these, so they skip the palette's own filter;
 * this only places them among the pages and actions. Null for anything else.
 */
export const resultScore = (
  value: string,
  query: string,
  hits: readonly PaletteHit[]
): number | null => {
  if (value === SEE_ALL_PRODUCTS) {
    return SEE_ALL_SCORE;
  }

  for (const hit of hits) {
    const hitValue =
      hit.type === "product"
        ? productValue(hit.product.id)
        : documentValue(hit.document.number);

    if (hitValue === value) {
      return hitScore(hit, query);
    }
  }

  return null;
};
