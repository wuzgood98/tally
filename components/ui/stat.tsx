import Link from "next/link";
import type { ReactNode } from "react";

import { Frame, FramePanel } from "@/components/ui/frame";
import { cn } from "@/lib/utils";

interface StatProps {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone?: "warn" | "danger";
  readonly href?: string;
  /** A small chart under the figure, such as a `Sparkline`. */
  readonly trend?: ReactNode;
  /** The period the chart covers, such as "Last 14 days". */
  readonly trendLabel?: string;
}

const TONES = { danger: "text-danger", warn: "text-warn" } as const;

/** Joins its stats into one instrument panel, divided by hairlines. */
export const StatGroup = ({
  children,
  className,
}: {
  readonly children: ReactNode;
  /** Columns only, such as `grid-cols-2 xl:grid-cols-4`. */
  readonly className?: string;
}) => (
  <Frame>
    <FramePanel clip flush>
      <div className={cn("bg-line grid gap-px", className)}>{children}</div>
    </FramePanel>
  </Frame>
);

export const Stat = ({
  label,
  value,
  detail,
  tone,
  href,
  trend,
  trendLabel,
}: StatProps) => {
  const body = (
    <>
      <p className="text-ink-2 text-sm">{label}</p>
      <p
        className={cn(
          "tabular text-figure mt-2.5 font-medium tracking-tighter",
          tone ? TONES[tone] : undefined
        )}
      >
        {value}
      </p>
      <p className="text-ink-3 mt-1.5 text-xs">{detail}</p>
      {trend === undefined ? null : (
        // Pinned to the bottom, so charts line up across a row of stats.
        <div className="mt-auto pt-4">
          {trend}
          {trendLabel === undefined ? null : (
            <p className="text-ink-3 text-2xs mt-1.5">{trendLabel}</p>
          )}
        </div>
      )}
    </>
  );

  const className = "bg-surface flex min-w-0 flex-col p-4";

  return href === undefined ? (
    <div className={className}>{body}</div>
  ) : (
    <Link
      className={cn(
        className,
        "press [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-2 focus-visible:-outline-offset-2"
      )}
      href={href}
    >
      {body}
    </Link>
  );
};
