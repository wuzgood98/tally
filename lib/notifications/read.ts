/**
 * Marking notifications read. Each person can only touch their own: the
 * user id is part of every WHERE clause, so a forged id marks nothing.
 */

import { and, eq, isNull } from "drizzle-orm";

import type { Db } from "@/lib/db/client";
import { notification } from "@/lib/db/schema";

export const markNotificationRead = async (
  db: Db,
  userId: string,
  notificationId: number,
  now = new Date()
): Promise<void> => {
  await db
    .update(notification)
    .set({ readAt: now })
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.userId, userId),
        isNull(notification.readAt)
      )
    );
};

export const markAllNotificationsRead = async (
  db: Db,
  userId: string,
  now = new Date()
): Promise<void> => {
  await db
    .update(notification)
    .set({ readAt: now })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
};
