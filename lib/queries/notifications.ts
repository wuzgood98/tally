import "server-only";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db";
import {
  notification,
  purchaseOrder,
  stockRequest,
  stockTransfer,
  supplier,
  user,
} from "@/lib/db/schema";
import type { NotificationRecord } from "@/lib/notifications/describe";

/** The bell shows the last 30 days, at most this many. */
export const NOTIFICATION_LIMIT = 30;

const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

const actor = alias(user, "notification_actor");

/** The request a transfer fulfilled, for "sent stock … for REQ-…". */
const fulfilled = alias(stockRequest, "fulfilled_request");

export const countUnreadNotifications = async (
  userId: string
): Promise<number> => {
  const [row] = await getDb()
    .select({ total: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

  return row?.total ?? 0;
};

export const listNotifications = async (
  userId: string,
  now = new Date()
): Promise<NotificationRecord[]> => {
  const rows = await getDb()
    .select({
      actorName: actor.name,
      createdAt: notification.createdAt,
      id: notification.id,
      kind: notification.kind,
      orderBranchId: purchaseOrder.branchId,
      orderId: purchaseOrder.id,
      orderNumber: purchaseOrder.number,
      readAt: notification.readAt,
      requestBranchId: stockRequest.branchId,
      requestId: stockRequest.id,
      requestNumber: stockRequest.number,
      supplierName: supplier.name,
      transferFrom: stockTransfer.fromBranchId,
      transferId: stockTransfer.id,
      transferNumber: stockTransfer.number,
      transferRequest: fulfilled.number,
      transferTo: stockTransfer.toBranchId,
      units: notification.units,
    })
    .from(notification)
    .leftJoin(actor, eq(actor.id, notification.actorId))
    .leftJoin(purchaseOrder, eq(purchaseOrder.id, notification.purchaseOrderId))
    .leftJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
    .leftJoin(stockTransfer, eq(stockTransfer.id, notification.transferId))
    .leftJoin(fulfilled, eq(fulfilled.transferId, notification.transferId))
    .leftJoin(stockRequest, eq(stockRequest.id, notification.requestId))
    .where(
      and(
        eq(notification.userId, userId),
        gte(
          notification.createdAt,
          new Date(now.getTime() - WINDOW_DAYS * DAY_MS)
        )
      )
    )
    .orderBy(desc(notification.id))
    .limit(NOTIFICATION_LIMIT);

  return rows.map((row) => ({
    actorName: row.actorName,
    createdAt: row.createdAt,
    id: row.id,
    kind: row.kind,
    purchaseOrder:
      row.orderId === null || row.orderNumber === null
        ? null
        : {
            branchId: row.orderBranchId ?? "",
            id: row.orderId,
            number: row.orderNumber,
            supplierName: row.supplierName ?? "the supplier",
          },
    readAt: row.readAt,
    request:
      row.requestId === null || row.requestNumber === null
        ? null
        : {
            branchId: row.requestBranchId ?? "",
            id: row.requestId,
            number: row.requestNumber,
          },
    transfer:
      row.transferId === null || row.transferNumber === null
        ? null
        : {
            fromBranchId: row.transferFrom ?? "",
            id: row.transferId,
            number: row.transferNumber,
            requestNumber: row.transferRequest,
            toBranchId: row.transferTo ?? "",
          },
    units: row.units,
  }));
};
