/**
 * Turns stored notifications into what the bell shows: a sentence, the
 * document's number and link, grouped by Accra day. Worked out when shown,
 * not stored, so names stay current. Pure, so it's tested without a database.
 */

import type { NotificationKind } from "@/lib/db/schema";
import { formatDay, formatTime, formatUnits } from "@/lib/format";

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

const orderText = (
  record: NotificationRecord,
  order: NonNullable<NotificationRecord["purchaseOrder"]>,
  branches: BranchNames
): string => {
  const who = record.actorName ?? "Someone";
  const from = `the order from ${order.supplierName}`;

  if (record.kind === "po_drafted") {
    return `${who} drafted an order from ${order.supplierName} for ${nameOf(branches, order.branchId)}, for you to approve`;
  }

  if (record.kind === "po_approved") {
    return `${who} approved ${from}`;
  }

  if (record.kind === "po_cancelled") {
    return `${who} cancelled ${from}`;
  }

  return `${who} closed ${from} short`;
};

const transferText = (
  record: NotificationRecord,
  transfer: NonNullable<NotificationRecord["transfer"]>,
  branches: BranchNames
): string => {
  const who = record.actorName ?? "Someone";
  const from = nameOf(branches, transfer.fromBranchId);

  if (record.kind === "transfer_dispatched") {
    const purpose =
      transfer.requestNumber === null ? "" : ` for ${transfer.requestNumber}`;

    return `${who} sent stock from ${from}${purpose}`;
  }

  if (record.kind === "transfer_received_short") {
    return `${nameOf(branches, transfer.toBranchId)} received it ${formatUnits(record.units ?? 0)} short`;
  }

  return `${who} called back the transfer from ${from}`;
};

const requestText = (
  record: NotificationRecord,
  request: NonNullable<NotificationRecord["request"]>,
  branches: BranchNames
): string => {
  const who = record.actorName ?? "Someone";
  const store = nameOf(branches, request.branchId);

  return record.kind === "request_raised"
    ? `${who} asked for stock for ${store}`
    : `${who} cancelled ${store}'s request`;
};

/** The sentence, number and link; null if its document is missing. */
const describe = (
  record: NotificationRecord,
  branches: BranchNames
): Pick<NotificationItem, "href" | "number" | "text"> | null => {
  const { purchaseOrder, request, transfer } = record;

  if (purchaseOrder !== null) {
    return {
      href: `/purchase-orders/${purchaseOrder.id}`,
      number: purchaseOrder.number,
      text: orderText(record, purchaseOrder, branches),
    };
  }

  if (transfer !== null) {
    return {
      href: `/transfers/${transfer.id}`,
      number: transfer.number,
      text: transferText(record, transfer, branches),
    };
  }

  if (request !== null) {
    return {
      href: `/requests/${request.id}`,
      number: request.number,
      text: requestText(record, request, branches),
    };
  }

  return null;
};

const DAY_MS = 86_400_000;

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
