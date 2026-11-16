/**
 * GET /api/till/catalogue: every product the till can sell, with its shelf
 * price and no cost. The till loads it once into its products collection and
 * looks scans up locally, so a scan works while the connection is down.
 */

import { getDb } from "@/lib/db";
import { NO_STORE } from "@/lib/http";
import { getTillCatalogue } from "@/lib/till/api";
import { tillCaller } from "@/lib/till/caller";

export const GET = async (): Promise<Response> => {
  const caller = await tillCaller();

  if (caller instanceof Response) {
    return caller;
  }

  return Response.json(
    { products: await getTillCatalogue(getDb()) },
    { headers: NO_STORE }
  );
};
