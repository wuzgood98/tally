/**
 * GET /api/till/stock-levels: balances at the stores the signed-in person
 * may sell at, for the till's stock-levels collection.
 */

import { getDb } from "@/lib/db";
import { NO_STORE } from "@/lib/http";
import { getTillStockLevels } from "@/lib/till/api";
import { tillCaller } from "@/lib/till/caller";

export const GET = async (): Promise<Response> => {
  const caller = await tillCaller();

  if (caller instanceof Response) {
    return caller;
  }

  return Response.json(
    { levels: await getTillStockLevels(getDb(), caller) },
    { headers: NO_STORE }
  );
};
