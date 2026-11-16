"use client";

import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover";
import { Bell } from "lucide-react";
import { useState, useTransition } from "react";

import {
  readAllNotifications,
  readNotification,
} from "@/app/(app)/notification-actions";
import { shellIconButton } from "@/components/shell/icon-button";
import { NotificationList } from "@/components/shell/notification-list";
import type {
  NotificationDay,
  NotificationItem,
} from "@/lib/notifications/describe";
import { cn } from "@/lib/utils";

/** Above this the badge reads "9+". */
const BADGE_MAX = 9;

export interface NotificationFeed {
  readonly unread: number;
  readonly days: readonly NotificationDay[];
}

interface NotificationBellProps {
  /** Null for people who are never notified (cashiers): no bell at all. */
  readonly feed: NotificationFeed | null;
  /** Which side of the trigger the panel opens on. */
  readonly side?: "bottom" | "right";
}

const bellLabel = (unread: number): string =>
  unread === 0 ? "Notifications" : `Notifications, ${unread} unread`;

const BellPanel = ({
  feed,
  side = "bottom",
}: NotificationBellProps & { readonly feed: NotificationFeed }) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { unread, days } = feed;

  const follow = (item: NotificationItem) => {
    setOpen(false);

    if (item.unread) {
      startTransition(async () => {
        await readNotification(item.id);
      });
    }
  };

  return (
    <Popover onOpenChange={setOpen} open={open} presentation="auto">
      <PopoverTrigger
        aria-label={bellLabel(unread)}
        className={cn(shellIconButton, "relative")}
      >
        <Bell aria-hidden="true" className="size-4" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="bg-brand text-primary-foreground figures text-2xs absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 leading-none font-semibold"
          >
            {unread > BADGE_MAX ? `${BADGE_MAX}+` : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align={side === "right" ? "start" : "end"}
        className="border-line-strong bg-surface text-ink shadow-float data-[presentation=popover]:pop-in z-50 flex flex-col overflow-hidden border p-0 font-sans data-[presentation=popover]:max-h-[min(30rem,80vh)] data-[presentation=popover]:w-88 data-[presentation=popover]:rounded-xl data-[presentation=sheet]:max-h-[80svh] data-[presentation=sheet]:rounded-t-2xl data-[presentation=sheet]:border-b-0"
        // Start on the newest notification, not "Mark all read", so a stray
        // Enter doesn't clear everything.
        initialFocus="[data-notification]"
        side={side}
        sideOffset={8}
      >
        <div className="border-line flex items-center gap-3 border-b px-4 py-2.5">
          <PopoverTitle className="text-md m-0 grow font-semibold">
            Notifications
          </PopoverTitle>
          {unread > 0 ? (
            <button
              className="press text-brand hover:bg-surface-2 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-60"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await readAllNotifications();
                });
              }}
              type="button"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="pb-safe min-h-0 overflow-y-auto overscroll-contain">
          <NotificationList days={days} onFollow={follow} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const NotificationBell = ({ feed, side }: NotificationBellProps) =>
  feed === null ? null : <BellPanel feed={feed} side={side} />;
