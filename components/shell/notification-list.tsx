"use client";

import {
  ArrowLeftRight,
  Inbox,
  PackageX,
  ShoppingCart,
  TriangleAlert,
  Truck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { NotificationKind } from "@/lib/db/schema";
import type {
  NotificationDay,
  NotificationItem,
} from "@/lib/notifications/describe";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<NotificationKind, ReactNode> = {
  po_approved: <ShoppingCart />,
  po_cancelled: <PackageX />,
  po_closed: <PackageX />,
  po_drafted: <ShoppingCart />,
  request_cancelled: <Inbox />,
  request_raised: <Inbox />,
  transfer_cancelled: <ArrowLeftRight />,
  transfer_dispatched: <Truck />,
  transfer_received_short: <TriangleAlert />,
};

/** A loss is the one kind worth a warning colour. */
const isWarning = (kind: NotificationKind): boolean =>
  kind === "transfer_received_short";

interface RowProps {
  readonly item: NotificationItem;
  readonly onFollow: (item: NotificationItem) => void;
}

const NotificationRow = ({ item, onFollow }: RowProps) => (
  <li>
    <Link
      className="row-hover hover:bg-surface-2 focus-visible:bg-surface-2 flex gap-3 rounded-lg px-2.5 py-2 outline-none"
      data-notification=""
      href={item.href}
      onClick={() => {
        onFollow(item);
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-surface-2 mt-0.5 grid size-7 shrink-0 place-items-center rounded-md [&_svg]:size-3.5",
          isWarning(item.kind) ? "text-warn" : "text-ink-3"
        )}
      >
        {KIND_ICONS[item.kind]}
      </span>
      <span className="grid min-w-0 grow gap-0.5">
        <span
          className={cn(
            "text-sm leading-snug",
            item.unread ? "text-ink font-medium" : "text-ink-2"
          )}
        >
          {item.unread ? <span className="sr-only">Unread: </span> : null}
          {item.text}
        </span>
        <span className="text-ink-3 flex items-center gap-2 text-xs">
          <span className="figures truncate">{item.number}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.at}>{item.time}</time>
        </span>
      </span>
      {item.unread ? (
        <span
          aria-hidden="true"
          className="bg-brand mt-2 size-2 shrink-0 rounded-full"
        />
      ) : null}
    </Link>
  </li>
);

interface ListProps {
  readonly days: readonly NotificationDay[];
  readonly onFollow: (item: NotificationItem) => void;
}

export const NotificationList = ({ days, onFollow }: ListProps) => {
  if (days.length === 0) {
    return (
      <p className="text-ink-3 px-4 py-8 text-center text-sm">
        Nothing in the last 30 days. You&rsquo;ll hear here when stock is sent
        your way or an order changes.
      </p>
    );
  }

  return (
    <div className="grid gap-2 px-2 pt-1 pb-2">
      {days.map((day) => (
        <section aria-label={day.label} key={day.label}>
          <h3 className="text-ink-3 px-2.5 pt-1 pb-1 text-xs">{day.label}</h3>
          <ul className="grid gap-px">
            {day.items.map((item) => (
              <NotificationRow item={item} key={item.id} onFollow={onFollow} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
