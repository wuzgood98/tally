"use client";

import { Cloud, CloudOff, MonitorX, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import {
  useSavedCopy,
  useSyncStatus,
} from "@/components/till/till-data-provider";
import { statusLine } from "@/lib/till/client/status-text";
import type { StatusKind } from "@/lib/till/client/status-text";
import { cn } from "@/lib/utils";

const ICON = "size-3.5 shrink-0";

const ICONS: Record<StatusKind, ReactNode> = {
  "no-queue": <MonitorX aria-hidden="true" className={ICON} />,
  offline: <CloudOff aria-hidden="true" className={ICON} />,
  sending: <RefreshCw aria-hidden="true" className={ICON} />,
  sent: <Cloud aria-hidden="true" className={ICON} />,
};

/**
 * One line above the till about its connection and offline queue, and how
 * old its prices and counts are when Tally can't be reached. An `<output>`,
 * so a screen reader hears it change (going offline, the queue emptying).
 */
export const TillSyncStatus = () => {
  const line = statusLine(useSyncStatus(), useSavedCopy());

  return (
    <output
      className={cn(
        "flex items-start gap-2 text-xs",
        line.tone === "warn" ? "text-warn" : "text-ink-3"
      )}
    >
      <span className="mt-px">{ICONS[line.kind]}</span>
      {line.text}
    </output>
  );
};
