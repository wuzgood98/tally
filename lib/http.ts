/**
 * JSON replies for route handlers, shared by the POS sales API and the till's
 * own endpoints, so a client can tell a permanent refusal
 * (`REFUSED_STATUSES`) from one worth retrying (401, 5xx). Free of the
 * database, since the till's browser queue reads `REFUSED_STATUSES` too.
 */

import type { z } from "zod";

import { StockError } from "@/lib/stock/errors";
import type { StockErrorCode } from "@/lib/stock/errors";

export const STOCK_ERROR_STATUS: Record<StockErrorCode, number> = {
  conflict: 409,
  forbidden: 403,
  insufficient_stock: 409,
  invalid_input: 400,
  no_change: 400,
  not_found: 404,
};

/** Statuses that mean Tally will never accept the request as it stands. */
export const REFUSED_STATUSES: ReadonlySet<number> = new Set([
  400, 403, 404, 409,
]);

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

/**
 * Runs a route's work, answering a `StockError` with its status; anything
 * else is a bug and is thrown again.
 */
export const answerStockErrors = async (
  work: () => Promise<Response>
): Promise<Response> => {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof StockError)) {
      throw error;
    }

    return jsonFailure(
      STOCK_ERROR_STATUS[error.code],
      error.code,
      error.message
    );
  }
};

/** The request's body parsed with `schema`, or undefined when it isn't JSON at all. */
export const readBody = async <T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<z.ZodSafeParseResult<T> | undefined> => {
  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return undefined;
  }

  return schema.safeParse(json);
};

/** A 400 naming the first thing wrong with a body that didn't parse. */
export const invalidBody = (error: z.ZodError | undefined): Response => {
  const issue = error?.issues[0];

  return jsonFailure(
    400,
    "invalid_input",
    issue === undefined
      ? "The body must be JSON."
      : `${issue.path.join(".") || "body"}: ${issue.message}`
  );
};
