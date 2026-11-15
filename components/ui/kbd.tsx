import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * A key or key combination, as text the platform formats (`useShortcutHint`).
 * Hide it from screen readers and put `aria-keyshortcuts` on the control
 * instead, so the keys are announced once, in words.
 */
export const Kbd = ({
  className,
  inverse = false,
  ...props
}: ComponentProps<"kbd"> & {
  /** On a dark button, such as the till's Charge. */
  readonly inverse?: boolean;
}) => (
  <kbd
    className={cn(
      "figures text-2xs inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm border px-1 font-sans leading-none",
      inverse
        ? "border-paper/25 text-paper/70 bg-transparent"
        : "border-line-strong bg-surface text-ink-3",
      className
    )}
    {...props}
  />
);
