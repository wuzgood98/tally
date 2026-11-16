"use client";

import { PopoverContent as UiPopoverContent } from "@ui-sdk/react/popover";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * ui-sdk's popover content in the Tally look: a floating panel beside its
 * trigger, or a bottom sheet on small touch screens (`presentation="auto"` on
 * the root). Its own padding is zero, so the content lays itself out; pass a
 * width and height for the popover presentation.
 */
export const PopoverContent = ({
  className,
  ...props
}: ComponentProps<typeof UiPopoverContent>) => (
  <UiPopoverContent
    className={cn(
      "border-line-strong bg-surface text-ink shadow-float z-50 flex flex-col overflow-hidden border p-0 font-sans",
      "data-[presentation=popover]:pop-in data-[presentation=popover]:rounded-xl",
      "data-[presentation=sheet]:max-h-[80svh] data-[presentation=sheet]:rounded-t-2xl data-[presentation=sheet]:border-b-0",
      className
    )}
    {...props}
  />
);
