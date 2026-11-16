import "server-only";
import { getDb } from "@/lib/db";
import { jsonFailure } from "@/lib/http";
import { getViewer } from "@/lib/session";
import type { Viewer } from "@/lib/session";
import { tillStoreIds } from "@/lib/till/api";

/**
 * The signed-in person, for a till endpoint, or the reply to send instead:
 * 401 when signed out (the proxy lets `/api/till` through, so a queued sale
 * replayed after the session ended gets a 401 it can wait on, not a sign-in
 * page that would look like success), 404 for someone with no till
 * (storekeepers), so the endpoint doesn't hint that it exists.
 */
export const tillCaller = async (): Promise<Viewer | Response> => {
  const viewer = await getViewer();

  if (viewer === null) {
    return jsonFailure(401, "unauthorized", "Sign in again.");
  }

  const stores = await tillStoreIds(getDb(), viewer);

  if (stores.length === 0) {
    return jsonFailure(404, "not_found", "Not found.");
  }

  return viewer;
};
