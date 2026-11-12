/**
 * POST /api/v1/sales: a POS till reports a sale. Authenticated with the
 * till's key (`Authorization: Bearer tly_…`), which also fixes the store.
 *
 * 201 with the new sale; 200 with `duplicate: true` when the till resends a
 * sale it already sent (same clientRef); 400 / 401 / 404 with
 * `{ error: { code, message } }` otherwise.
 */

import { getDb, databaseReady } from "@/lib/db";
import { apiSaleBody, postTillSale } from "@/lib/sales-api";
import { StockError } from "@/lib/stock/errors";
import type { StockErrorCode } from "@/lib/stock/errors";
import { authenticateTill } from "@/lib/tills";

const STATUS: Record<StockErrorCode, number> = {
  conflict: 409,
  forbidden: 403,
  insufficient_stock: 409,
  invalid_input: 400,
  no_change: 400,
  not_found: 404,
};

const failure = (status: number, code: string, message: string): Response =>
  Response.json(
    { error: { code, message } },
    {
      headers: status === 401 ? { "WWW-Authenticate": "Bearer" } : undefined,
      status,
    }
  );

/** The body, parsed, or null when it isn't JSON at all. */
const readSaleBody = async (request: Request) => {
  try {
    return apiSaleBody.safeParse(await request.json());
  } catch {
    return null;
  }
};

export const POST = async (request: Request): Promise<Response> => {
  await databaseReady();
  const db = getDb();

  const identity = await authenticateTill(
    db,
    request.headers.get("authorization")
  );

  if (identity === null) {
    return failure(
      401,
      "unauthorized",
      "Send a valid till key as a Bearer token."
    );
  }

  const body = await readSaleBody(request);

  if (body === null) {
    return failure(400, "invalid_input", "The body must be JSON.");
  }

  if (!body.success) {
    const [issue] = body.error.issues;

    return failure(
      400,
      "invalid_input",
      issue === undefined
        ? "The body must be JSON."
        : `${issue.path.join(".") || "body"}: ${issue.message}`
    );
  }

  try {
    const recorded = await postTillSale(db, identity, body.data);

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
  } catch (error) {
    if (!(error instanceof StockError)) {
      throw error;
    }

    return failure(STATUS[error.code], error.code, error.message);
  }
};
