/**
 * Writes the notifications for one event. Domain functions call it inside
 * their own transaction, after the change itself has gone through, so a change
 * that rolls back tells no one. It checks no permissions: the domain function
 * already checked the actor. Deactivated staff are skipped.
 */

import { asc, eq } from "drizzle-orm";

import type { Executor } from "@/lib/db/client";
import { notification, user } from "@/lib/db/schema";
import { recipientsFor } from "@/lib/notifications/recipients";
import type { NotificationEvent } from "@/lib/notifications/recipients";
import type { Actor } from "@/lib/permissions";

const documentOf = (event: NotificationEvent) => {
  if ("purchaseOrderId" in event) {
    return { purchaseOrderId: event.purchaseOrderId };
  }

  if ("transferId" in event) {
    return { transferId: event.transferId, units: event.units ?? null };
  }

  return { requestId: event.requestId };
};

export const notify = async (
  db: Executor,
  actor: Actor,
  event: NotificationEvent
): Promise<void> => {
  const staff = await db
    .select({ branchId: user.branchId, id: user.id, role: user.role })
    .from(user)
    .where(eq(user.banned, false))
    .orderBy(asc(user.id));

  const recipients = recipientsFor(actor, event, staff);

  if (recipients.length === 0) {
    return;
  }

  const document = documentOf(event);

  await db.insert(notification).values(
    recipients.map((userId) => ({
      ...document,
      actorId: actor.id,
      kind: event.kind,
      userId,
    }))
  );
};
