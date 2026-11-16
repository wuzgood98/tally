/**
 * Turns stored notifications into what the bell shows: a sentence, the
 * document's number and link, grouped by Accra day. Worked out when shown,
 * not stored, so names stay current. Pure, so it's tested without a database.
 */

import type { NotificationKind } from "@/lib/db/schema";
import { formatDay, formatTime, formatUnits } from "@/lib/format";
import {
  isOrderKind,
  isRequestKind,
  isTransferKind,
} from "@/lib/notifications/kinds";
import type {
  OrderNotificationKind,
  RequestNotificationKind,
  TransferNotificationKind,
} from "@/lib/notifications/kinds";
import { DAY_MS } from "@/lib/time";

export interface NotificationRecord {
  readonly id: number;
  readonly kind: NotificationKind;
  readonly createdAt: Date;
  readonly readAt: Date | null;
  readonly units: number | null;
  readonly actorName: string | null;
  readonly purchaseOrder: {
    readonly id: number;
    readonly number: string;
    readonly branchId: string;
    readonly supplierName: string;
  } | null;
  readonly transfer: {
    readonly id: number;
    readonly number: string;
    readonly fromBranchId: string;
    readonly toBranchId: string;
    /** The request this transfer fulfilled, if any. */
    readonly requestNumber: string | null;
  } | null;
  readonly request: {
    readonly id: number;
    readonly number: string;
    readonly branchId: string;
  } | null;
}

export interface NotificationItem {
  readonly id: number;
  readonly kind: NotificationKind;
  readonly text: string;
  readonly number: string;
  readonly href: string;
  readonly time: string;
  /** ISO, for `<time dateTime>`. */
  readonly at: string;
  readonly unread: boolean;
}

export interface NotificationDay {
  readonly label: string;
  readonly items: readonly NotificationItem[];
}

type BranchNames = ReadonlyMap<string, string>;

const nameOf = (branches: BranchNames, id: string): string =>
  branches.get(id) ?? id;

type Order = NonNullable<NotificationRecord["purchaseOrder"]>;

type Transfer = NonNullable<NotificationRecord["transfer"]>;

type Request = NonNullable<NotificationRecord["request"]>;

/** What every sentence may draw on besides its document. */
interface TextContext {
  /** Who did it, or "Someone" if they're gone. */
  readonly who: string;
  readonly units: number | null;
  readonly branches: BranchNames;
}

// One sentence per kind, in a Record per document, so a new kind doesn't
// compile until it has its wording.

const ORDER_TEXT: Record<
  OrderNotificationKind,
  (order: Order, context: TextContext) => string
> = {
  po_approved: (order, { who }) =>
    `${who} approved the order from ${order.supplierName}`,
  po_cancelled: (order, { who }) =>
    `${who} cancelled the order from ${order.supplierName}`,
  po_closed: (order, { who }) =>
    `${who} closed the order from ${order.supplierName} short`,
  po_drafted: (order, { branches, who }) =>
    `${who} drafted an order from ${order.supplierName} for ${nameOf(branches, order.branchId)}, for you to approve`,
};

const TRANSFER_TEXT: Record<
  TransferNotificationKind,
  (transfer: Transfer, context: TextContext) => string
> = {
  transfer_cancelled: (transfer, { branches, who }) =>
    `${who} called back the transfer from ${nameOf(branches, transfer.fromBranchId)}`,
  transfer_dispatched: (transfer, { branches, who }) => {
    const purpose =
      transfer.requestNumber === null ? "" : ` for ${transfer.requestNumber}`;

    return `${who} sent stock from ${nameOf(branches, transfer.fromBranchId)}${purpose}`;
  },
  transfer_received_short: (transfer, { branches, units }) =>
    `${nameOf(branches, transfer.toBranchId)} received it ${formatUnits(units ?? 0)} short`,
};

const REQUEST_TEXT: Record<
  RequestNotificationKind,
  (request: Request, context: TextContext) => string
> = {
  request_cancelled: (request, { branches, who }) =>
    `${who} cancelled ${nameOf(branches, request.branchId)}'s request`,
  request_raised: (request, { branches, who }) =>
    `${who} asked for stock for ${nameOf(branches, request.branchId)}`,
};

/** The sentence, number and link; null if its document is missing. */
const describe = (
  record: NotificationRecord,
  branches: BranchNames
): Pick<NotificationItem, "href" | "number" | "text"> | null => {
  const { kind, purchaseOrder, request, transfer } = record;

  const context: TextContext = {
    branches,
    units: record.units,
    who: record.actorName ?? "Someone",
  };

  if (purchaseOrder !== null && isOrderKind(kind)) {
    return {
      href: `/purchase-orders/${purchaseOrder.id}`,
      number: purchaseOrder.number,
      text: ORDER_TEXT[kind](purchaseOrder, context),
    };
  }

  if (transfer !== null && isTransferKind(kind)) {
    return {
      href: `/transfers/${transfer.id}`,
      number: transfer.number,
      text: TRANSFER_TEXT[kind](transfer, context),
    };
  }

  if (request !== null && isRequestKind(kind)) {
    return {
      href: `/requests/${request.id}`,
      number: request.number,
      text: REQUEST_TEXT[kind](request, context),
    };
  }

  return null;
};

/** Accra's day is the UTC day: "2026-11-12". */
const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

const dayLabel = (key: string, now: Date): string => {
  if (key === dayKey(now)) {
    return "Today";
  }

  if (key === dayKey(new Date(now.getTime() - DAY_MS))) {
    return "Yesterday";
  }

  return formatDay(key);
};

/** Newest first, as given, grouped under Today / Yesterday / "10 Nov". */
export const notificationDays = (
  records: readonly NotificationRecord[],
  branches: BranchNames,
  now: Date
): NotificationDay[] => {
  const days: { key: string; items: NotificationItem[] }[] = [];

  for (const record of records) {
    const described = describe(record, branches);

    if (described === null) {
      continue;
    }

    const key = dayKey(record.createdAt);
    let day = days.at(-1);

    if (day?.key !== key) {
      day = { items: [], key };
      days.push(day);
    }

    day.items.push({
      ...described,
      at: record.createdAt.toISOString(),
      id: record.id,
      kind: record.kind,
      time: formatTime(record.createdAt),
      unread: record.readAt === null,
    });
  }

  return days.map((day) => ({
    items: day.items,
    label: dayLabel(day.key, now),
  }));
};
