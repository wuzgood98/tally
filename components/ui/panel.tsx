import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PanelProps {
  readonly title?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  /** Tables run edge to edge; prose gets padding. */
  readonly flush?: boolean;
  readonly id?: string;
}

export const Panel = ({
  title,
  action,
  children,
  className,
  flush = false,
  id,
}: PanelProps) => (
  <section
    aria-labelledby={
      title !== undefined && id !== undefined ? `${id}-title` : undefined
    }
    className={cn(
      "border-line bg-surface min-w-0 overflow-hidden rounded-xl border",
      className
    )}
  >
    {title === undefined ? null : (
      <div className="border-line flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2">
        <h2
          className="text-sm font-medium"
          id={id === undefined ? undefined : `${id}-title`}
        >
          {title}
        </h2>
        {action}
      </div>
    )}
    <div className={flush ? undefined : "p-4"}>{children}</div>
  </section>
);
