/**
 * POST /api/v1/sales: a POS till reports a sale. Authenticated with the
 * till's key (`Authorization: Bearer tly_…`), which also fixes the store.
 *
 * 201 with the new sale; 200 with `duplicate: true` when the till resends a
 * sale it already sent (same clientRef); 400 / 401 / 403 / 404 / 409 with
 * `{ error: { code, message } }` otherwise.
 */

import { getDb, databaseReady } from "@/lib/db";
import {
  answerStockErrors,
  invalidBody,
  jsonFailure,
  readBody,
} from "@/lib/http";
import { apiSaleBody, postTillSale } from "@/lib/sales-api";
import { authenticateTill } from "@/lib/tills";

export const POST = async (request: Request): Promise<Response> => {
  await databaseReady();
  const db = getDb();

  const identity = await authenticateTill(
    db,
    request.headers.get("authorization")
  );

  if (identity === null) {
    return jsonFailure(
      401,
      "unauthorized",
      "Send a valid till key as a Bearer token.",
      { "WWW-Authenticate": "Bearer" }
    );
  }

  const body = await readBody(request, apiSaleBody);

  if (body === undefined || !body.success) {
    return invalidBody(body?.error);
  }

  const sale = body.data;

  return await answerStockErrors(async () => {
    const recorded = await postTillSale(db, identity, sale);

    return Response.json(
      {
        duplicate: recorded.duplicate,
        sale: {
          id: recorded.id,
          number: recorded.number,
          total: recorded.total,
        },
      },
      { status: recorded.duplicate ? 200 : 201 }
    );
  });
};
