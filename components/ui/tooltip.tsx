"use client";

import { TooltipContent as UiTooltipContent } from "@ui-sdk/react/tooltip";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * ui-sdk's tooltip content in the Tally look. Its default padding sits in the
 * lowest cascade layer, under Tailwind's reset, so it has to be set here.
 * A shortcut (`TooltipShortcut`) sits beside the text. A tooltip that opens
 * at once (the next one along a row) skips the animation.
 */
export const TooltipContent = ({
  className,
  ...props
}: ComponentProps<typeof UiTooltipContent>) => (
  <UiTooltipContent
    className={cn(
      "bg-ink text-canvas pop-in shadow-popover flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap data-instant:transition-none",
      className
    )}
    {...props}
  />
);
