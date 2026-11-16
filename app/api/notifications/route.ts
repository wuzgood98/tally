/**
 * GET /api/notifications?after=<id>: the signed-in person's unread count,
 * newest notification id, and how many unread are newer than `after` (the
 * newest the page shows), for the bell's poll. A route handler rather than a
 * server action, so a poll never queues behind a sale at the till.
 *
 * 401 signed out (the proxy lets this path through so the poll gets a 401,
 * not a sign-in page), 404 for people who are never notified (cashiers).
 */

import { z } from "zod";

import { canBrowseBackOffice } from "@/lib/permissions";
import { getNotificationSummary } from "@/lib/queries/notifications";
import { getViewer } from "@/lib/session";

const NO_STORE = { "Cache-Control": "no-store" };

/** A missing or malformed `after` counts every unread one as new. */
const afterParam = z.coerce.number().int().nonnegative().catch(0);

export const GET = async (request: Request): Promise<Response> => {
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

  const after = afterParam.parse(
    new URL(request.url).searchParams.get("after") ?? undefined
  );

  return Response.json(await getNotificationSummary(viewer.id, after), {
    headers: NO_STORE,
  });
};
