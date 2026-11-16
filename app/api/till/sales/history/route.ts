/**
 * GET /api/till/sales/history: one page of a store's recorded sales, for the
 * till's on-demand history collection. The query string is a strict
 * allow-list (`lib/till/history-contract.ts`): a store, a time window,
 * payment methods, one sort and a page. Anything else is a 400 rather than
 * ignored, since a dropped filter under a limit is the wrong page.
 *
 * 401 signed out, 404 for someone with no till, 403 for a store a cashier
 * can't see.
 */

import { getDb } from "@/lib/db";
import { jsonFailure, NO_STORE, STOCK_ERROR_STATUS } from "@/lib/http";
import { StockError } from "@/lib/stock/errors";
import { getSaleHistory } from "@/lib/till/api";
import { tillCaller } from "@/lib/till/caller";
import { parseHistoryParams } from "@/lib/till/history-contract";

export const GET = async (request: Request): Promise<Response> => {
  const caller = await tillCaller();

  if (caller instanceof Response) {
    return caller;
  }

  const parsed = parseHistoryParams(new URL(request.url).searchParams);

  if (!parsed.ok) {
    return jsonFailure(400, "invalid_input", parsed.message);
  }

  try {
    return Response.json(
      { sales: await getSaleHistory(getDb(), caller, parsed.query) },
      { headers: NO_STORE }
    );
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
