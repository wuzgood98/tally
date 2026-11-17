/**
 * What the till's pages and its service worker (`public/till-sw.js`) must
 * agree on. The worker is plain JavaScript with no build step, so it can't
 * import these: it repeats them, and `till-sw.test.ts` drives the worker with
 * these values, so a copy that drifts fails the test.
 */

/** Every cache the worker writes is named `tally-till-…`. */
export const TILL_CACHE_PREFIX = "tally-till-";

/** Set by the worker on every page and data copy it keeps: when it was saved. */
export const SAVED_AT_HEADER = "X-Tally-Saved-At";

/** The page asks the worker to save what it loaded before the worker was in charge. */
export const WARM_MESSAGE = "tally-till-warm";

/** Sign-out asks the worker to stop saving and delete every copy. */
export const FORGET_MESSAGE = "tally-till-forget";

/** The till's eager data endpoints, kept network first. */
export const TILL_DATA_URLS = [
  "/api/till/catalogue",
  "/api/till/stock-levels",
  "/api/till/sales",
] as const;
