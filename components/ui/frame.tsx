import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/*
 * coss ui's Frame (coss.com/ui/docs/components/frame), drawn in Tally's
 * tokens: a soft graphite tray that holds one or more raised panels, with the
 * heading and any footer sitting on the tray itself rather than in a panel.
 * Two panels in a row sit one tray-width apart.
 */

export const Frame = ({
  as: Element = "div",
  className,
  ...props
}: ComponentProps<"div"> & {
  /** `section` when the frame carries a heading. */
  readonly as?: "div" | "section";
}) => (
  <Element
    className={cn(
      "bg-paper/80 relative flex min-w-0 flex-col rounded-2xl p-1 print:bg-transparent print:p-0 *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
      className
    )}
    data-slot="frame"
    {...props}
  />
);

const PANEL =
  "border-line bg-surface relative min-w-0 grow rounded-xl border bg-clip-padding shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)] print:shadow-none print:before:hidden";

interface FramePanelOptions {
  /** Tables and lists run edge to edge; prose and fields get padding. */
  readonly flush?: boolean;
  /** Clip content to the rounded corners. Leave off when a popup opens inside. */
  readonly clip?: boolean;
}

export const FramePanel = ({
  className,
  flush = false,
  clip = false,
  ...props
}: ComponentProps<"div"> & FramePanelOptions) => (
  <div
    className={cn(PANEL, !flush && "p-4", clip && "overflow-hidden", className)}
    data-slot="frame-panel"
    {...props}
  />
);

/** A whole panel that is one link, such as a card on an index page. */
export const FramePanelLink = ({
  className,
  ...props
}: ComponentProps<typeof Link>) => (
  <Link
    className={cn(
      PANEL,
      "press [@media(hover:hover)_and_(pointer:fine)]:hover:border-line-strong block p-4 focus-visible:-outline-offset-2",
      className
    )}
    data-slot="frame-panel"
    {...props}
  />
);

/** A whole panel that is one button, such as a bin on the branch board. */
export const FramePanelButton = ({
  className,
  pending = false,
  ...props
}: Omit<ComponentProps<"button">, "type"> & {
  /** Its action is under way, such as a branch switch: pulses and is busy. */
  readonly pending?: boolean;
}) => (
  <button
    aria-busy={pending || undefined}
    className={cn(
      PANEL,
      "press [@media(hover:hover)_and_(pointer:fine)]:hover:border-line-strong block p-3 text-left focus-visible:-outline-offset-2",
      pending && "pending-pulse",
      className
    )}
    data-slot="frame-panel"
    type="button"
    {...props}
  />
);

export const FrameHeader = ({
  className,
  ...props
}: ComponentProps<"header">) => (
  <header
    className={cn("flex min-h-10 flex-col justify-center px-3 py-2", className)}
    data-slot="frame-panel-header"
    {...props}
  />
);

export const FrameTitle = ({
  className,
  children,
  ...props
}: ComponentProps<"h2">) => (
  <h2
    className={cn("text-sm font-medium", className)}
    data-slot="frame-panel-title"
    {...props}
  >
    {children}
  </h2>
);

export const FrameDescription = ({
  className,
  ...props
}: ComponentProps<"p">) => (
  <p
    className={cn("text-ink-3 text-xs", className)}
    data-slot="frame-panel-description"
    {...props}
  />
);

export const FrameFooter = ({
  className,
  ...props
}: ComponentProps<"footer">) => (
  <footer
    className={cn("px-3 py-2", className)}
    data-slot="frame-panel-footer"
    {...props}
  />
);
