"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/lib/db";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/read";
import { requireViewer } from "@/lib/session";

const notificationId = z.int().positive();

/** Marks one of the viewer's notifications read; the bell catches up. */
export const readNotification = async (id: number): Promise<void> => {
  const viewer = await requireViewer();
  const parsed = notificationId.safeParse(id);

  if (!parsed.success) {
    return;
  }

  await markNotificationRead(getDb(), viewer.id, parsed.data);
  refresh();
};

export const readAllNotifications = async (): Promise<void> => {
  const viewer = await requireViewer();

  await markAllNotificationsRead(getDb(), viewer.id);
  refresh();
};
