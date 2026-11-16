/**
 * The till's sales.
 *
 * GET: today's sales the signed-in person rang up, for the till's sales
 * collection.
 *
 * POST: charge a sale (`tillCharge`). The till's offline queue sends it, and
 * may send it again after a dropped connection or a reload, so it is
 * idempotent by clientRef: 201 with the sale, 200 with `duplicate: true` for
 * one already recorded. A sale charged by someone other than the person now
 * signed in gets 401 `wrong_user` before anything else is checked, which the
 * queue holds on to until that person signs in again; it is never recorded
 * against someone else. `REFUSED_STATUSES` (`lib/http.ts`) are permanent
 * refusals.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { answerStockErrors, invalidBody, NO_STORE, readBody } from "@/lib/http";
import { chargeTillSale, getTillSales } from "@/lib/till/api";
import { tillCaller } from "@/lib/till/caller";
import { tillCharge } from "@/lib/till/schema";

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

/** Just who charged it, read even from a body that fails the full parse. */
const chargedByOnly = z.object({ cashierId: z.string() });

export const POST = async (request: Request): Promise<Response> => {
  // Read from a copy: the full body is parsed below, once the caller is known.
  const chargedBy = await readBody(request.clone(), chargedByOnly);
  const caller = await tillCaller(chargedBy?.data?.cashierId);

  if (caller instanceof Response) {
    return caller;
  }

  const body = await readBody(request, tillCharge);

  if (body === undefined || !body.success) {
    return invalidBody(body?.error);
  }

  const charge = body.data;

  return await answerStockErrors(async () => {
    const reply = await chargeTillSale(getDb(), caller, charge);

    // Nav badges and the overview count today's sales and stock.
    if (!reply.duplicate) {
      revalidatePath("/", "layout");
    }

    return Response.json(reply, {
      headers: NO_STORE,
      status: reply.duplicate ? 200 : 201,
    });
  });
};
