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
