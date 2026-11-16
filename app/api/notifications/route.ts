/**
 * GET /api/notifications: the signed-in person's unread count and newest
 * notification id, for the bell's poll. A route handler rather than a server
 * action, so a poll never queues behind a sale at the till.
 *
 * 401 signed out (the proxy lets this path through so the poll gets a 401,
 * not a sign-in page), 404 for people who are never notified (cashiers).
 */

import { canBrowseBackOffice } from "@/lib/permissions";
import { getNotificationSummary } from "@/lib/queries/notifications";
import { getViewer } from "@/lib/session";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = async (): Promise<Response> => {
  const viewer = await getViewer();

  if (viewer === null) {
    return Response.json(
      { error: { code: "unauthorized", message: "Sign in again." } },
      { headers: NO_STORE, status: 401 }
    );
  }

  if (!canBrowseBackOffice(viewer)) {
    return Response.json(
      { error: { code: "not_found", message: "Not found." } },
      { headers: NO_STORE, status: 404 }
    );
  }

  return Response.json(await getNotificationSummary(viewer.id), {
    headers: NO_STORE,
  });
};
