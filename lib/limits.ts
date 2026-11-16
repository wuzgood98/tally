/**
 * Numbers the database schema, the domain and the forms share. No imports,
 * so the schema (read by drizzle-kit) and client components can use it.
 */

/** The longest name, for a person or the company. */
export const NAME_MAX_LENGTH = 80;

/** The longest receipt footer head office can save. */
export const RECEIPT_FOOTER_MAX = 160;

/** Where a new product's reorder point starts until head office picks one. */
export const DEFAULT_REORDER_POINT = 10;

/** Better Auth's minimum (`minPasswordLength` in `lib/auth.ts`). */
export const MIN_PASSWORD_LENGTH = 10;

/** The units a product is sold in: the database enum and the till's rows both read this. */
export const PRODUCT_UNITS = ["each", "pack", "kg", "litre", "pair"] as const;

/** The most lines one sale can have. */
export const MAX_SALE_LINES = 200;

/** A sanity cap per line, so a barcode scanned into the quantity box is caught. */
export const MAX_SALE_QUANTITY = 10_000;

/** How much of a scan or search a product lookup reads. */
export const LOOKUP_TEXT_MAX = 100;

/** How many name matches a product lookup lists. */
export const LOOKUP_MATCHES_MAX = 8;
