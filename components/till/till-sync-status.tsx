"use client";

import { Cloud, CloudOff, MonitorX, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { useSyncStatus } from "@/components/till/till-data-provider";
import { formatSales } from "@/lib/format";
import type { SyncStatus } from "@/lib/till/client/sync";
import { cn } from "@/lib/utils";

interface Look {
  readonly icon: ReactNode;
  readonly text: string;
  readonly tone: "quiet" | "warn";
}

const ICON = "size-3.5 shrink-0";

/** What the till says about its queue, from most to least pressing. */
const describe = (status: SyncStatus): Look => {
  if (!status.canQueue) {
    return {
      icon: <MonitorX aria-hidden="true" className={ICON} />,
      text: "This tab can't keep sales without a connection: the till is open in another tab, or the browser won't store them. Charging needs a connection here.",
      tone: "warn",
    };
  }

  if (!status.online) {
    return {
      icon: <CloudOff aria-hidden="true" className={ICON} />,
      text:
        status.queued === 0
          ? "Offline. Keep charging: sales are saved on this till and sent when the connection is back."
          : `Offline · ${formatSales(status.queued)} saved on this till, sent when the connection is back.`,
      tone: "warn",
    };
  }

  if (status.queued > 0) {
    const reason =
      status.lastError === null ? "" : ` Last try: ${status.lastError}`;

    return {
      icon: <RefreshCw aria-hidden="true" className={ICON} />,
      text: `Sending ${formatSales(status.queued)} saved on this till.${reason}`,
      tone: status.lastError === null ? "quiet" : "warn",
    };
  }

  return {
    icon: <Cloud aria-hidden="true" className={ICON} />,
    text: "Online · every sale has reached Tally.",
    tone: "quiet",
  };
};

/**
 * One line above the till about its offline queue. An `<output>`, so a screen
 * reader hears it change (going offline, the queue emptying).
 */
export const TillSyncStatus = () => {
  const look = describe(useSyncStatus());

  return (
    <output
      className={cn(
        "flex items-start gap-2 text-xs",
        look.tone === "warn" ? "text-warn" : "text-ink-3"
      )}
    >
      <span className="mt-px">{look.icon}</span>
      {look.text}
    </output>
  );
};
