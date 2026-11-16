/**
 * The till's sales.
 *
 * GET: today's sales the signed-in person rang up, for the till's sales
 * collection.
 *
 * POST: charge a sale (`tillSaleBody`). The till's offline queue sends it, and
 * may send it again after a dropped connection or a reload, so it is
 * idempotent by clientRef: 201 with the sale, 200 with `duplicate: true` for
 * one already recorded. A sale charged by someone other than the person now
 * signed in gets 401 `wrong_user`, which the queue holds on to until that
 * person signs in again; it is never recorded against someone else. 400 / 403
 * / 404 are permanent refusals.
 */

import { getDb } from "@/lib/db";
import { jsonFailure, NO_STORE, STOCK_ERROR_STATUS } from "@/lib/http";
import { StockError } from "@/lib/stock/errors";
import { chargeTillSale, getTillSales } from "@/lib/till/api";
import { tillCaller } from "@/lib/till/caller";
import { tillSaleBody } from "@/lib/till/schema";

export const GET = async (): Promise<Response> => {
  const caller = await tillCaller();

  if (caller instanceof Response) {
    return caller;
  }

  return Response.json(
    { sales: await getTillSales(getDb(), caller) },
    { headers: NO_STORE }
  );
};

/** The body, parsed, or null when it isn't JSON at all. */
const readBody = async (request: Request) => {
  try {
    return tillSaleBody.safeParse(await request.json());
  } catch {
    return null;
  }
};

export const POST = async (request: Request): Promise<Response> => {
  const caller = await tillCaller();

  if (caller instanceof Response) {
    return caller;
  }

  const body = await readBody(request);

  if (body === null || !body.success) {
    const issue = body?.error.issues[0];

    return jsonFailure(
      400,
      "invalid_input",
      issue === undefined
        ? "The body must be JSON."
        : `${issue.path.join(".") || "body"}: ${issue.message}`
    );
  }

  if (body.data.cashierId !== caller.id) {
    return jsonFailure(
      401,
      "wrong_user",
      "This sale was charged by someone else. It will be sent when they sign in."
    );
  }

  try {
    const reply = await chargeTillSale(getDb(), caller, body.data);

    return Response.json(reply, {
      headers: NO_STORE,
      status: reply.duplicate ? 200 : 201,
    });
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
