import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * A key or key combination, as text the platform formats (`useShortcutHint`).
 * Hide it from screen readers and put `aria-keyshortcuts` on the control
 * instead, so the keys are announced once, in words.
 */
export const Kbd = ({ className, ...props }: ComponentProps<"kbd">) => (
  <kbd
    className={cn(
      "border-line-strong bg-surface text-ink-3 figures text-2xs inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm border px-1 font-sans leading-none",
      className
    )}
    {...props}
  />
);
