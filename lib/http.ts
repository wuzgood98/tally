/**
 * JSON error replies for route handlers, shared by the POS sales API and the
 * till's own endpoints, so a client can tell a permanent refusal (400, 403,
 * 404) from one worth retrying (401, 5xx).
 */

import type { StockErrorCode } from "@/lib/stock/errors";

export const STOCK_ERROR_STATUS: Record<StockErrorCode, number> = {
  conflict: 409,
  forbidden: 403,
  insufficient_stock: 409,
  invalid_input: 400,
  no_change: 400,
  not_found: 404,
};

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export const jsonFailure = (
  status: number,
  code: string,
  message: string,
  headers: Readonly<Record<string, string>> = {}
): Response =>
  Response.json(
    { error: { code, message } },
    { headers: { ...NO_STORE, ...headers }, status }
  );
