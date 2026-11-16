/**
 * The notification kinds by the document they point at. A kind's prefix names
 * its document (the migration's CHECK holds it to that), so code that words,
 * links or routes a kind narrows by document here once.
 */

import type { NotificationKind } from "@/lib/db/schema";

export type OrderNotificationKind = Extract<NotificationKind, `po_${string}`>;

export type TransferNotificationKind = Extract<
  NotificationKind,
  `transfer_${string}`
>;

export type RequestNotificationKind = Extract<
  NotificationKind,
  `request_${string}`
>;

export const isOrderKind = (
  kind: NotificationKind
): kind is OrderNotificationKind => kind.startsWith("po_");

export const isTransferKind = (
  kind: NotificationKind
): kind is TransferNotificationKind => kind.startsWith("transfer_");

export const isRequestKind = (
  kind: NotificationKind
): kind is RequestNotificationKind => kind.startsWith("request_");
