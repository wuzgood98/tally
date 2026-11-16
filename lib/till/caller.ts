import "server-only";
import { getDb } from "@/lib/db";
import { getViewer } from "@/lib/session";
import type { Viewer } from "@/lib/session";
import { tillAccess } from "@/lib/till/api";

/**
 * The signed-in person, for a till endpoint, or the reply to send instead:
 * see `tillAccess`. A charge passes `chargedBy`, the cashier the till says
 * charged it.
 */
export const tillCaller = async (
  chargedBy?: string
): Promise<Viewer | Response> =>
  await tillAccess(getDb(), await getViewer(), chargedBy);
