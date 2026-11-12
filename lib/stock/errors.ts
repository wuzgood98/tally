/**
 * Errors a person can act on. Server Actions show `message` as is; anything
 * else that's thrown is a bug and gets a generic message.
 */

export type StockErrorCode =
  /** The document changed under you, e.g. a transfer someone already received. */
  | "conflict"
  | "forbidden"
  | "insufficient_stock"
  | "invalid_input"
  | "not_found"
  | "no_change";

export class StockError extends Error {
  readonly code: StockErrorCode;

  constructor(code: StockErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "StockError";
  }
}
