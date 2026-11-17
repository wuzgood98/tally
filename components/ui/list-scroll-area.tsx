"use client";

import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ListScrollAreaVariant = "popup" | "flush";

/** Each variant's root, viewport and content classes. */
const VARIANT_CLASSES: Record<
  ListScrollAreaVariant,
  { readonly root: string; readonly viewport: string; readonly content: string }
> = {
  flush: { content: "p-0", root: "rounded-none", viewport: "scroll-py-8" },
  popup: { content: "p-1", root: "rounded-[inherit]", viewport: "scroll-py-1" },
};

interface ListScrollAreaProps {
  readonly children: ReactNode;
  /** Names the viewport, when the list inside has no name of its own. */
  readonly "aria-label"?: string;
  /**
   * `popup` is a `Select`'s list: the popup's corners, a 4px gutter round the
   * rows. `flush` is square and unpadded, for a list that runs to the edges of
   * a larger panel (the command palette), with scroll padding as tall as its
   * edge fades so the highlight stays clear of them.
   */
  readonly variant?: ListScrollAreaVariant;
  /** Laid over the viewport, such as fades at its edges. */
  readonly overlay?: ReactNode;
}

/**
 * A popup's list in ui-sdk's ScrollArea, with the app's thin thumb, for the
 * command palette and every `Select`. It fills a flex-column popup and shrinks
 * with its max height. The list inside keeps the keyboard: ui-sdk scrolls the
 * highlighted option into view through the viewport. ui-sdk makes the viewport
 * a tab stop (the options rove at -1), which is harmless: Tab closes a select's
 * list first, and arrow keys hand focus back to the options after a click on
 * the viewport's padding.
 */
export const ListScrollArea = ({
  children,
  "aria-label": ariaLabel,
  variant = "popup",
  overlay,
}: ListScrollAreaProps) => (
  <ScrollArea
    className={cn(
      "flex min-h-0 flex-col border-0",
      VARIANT_CLASSES[variant].root
    )}
  >
    <ScrollAreaViewport
      aria-label={ariaLabel}
      className={cn(
        "h-auto min-h-0 flex-1 overscroll-contain",
        VARIANT_CLASSES[variant].viewport
      )}
    >
      <ScrollAreaContent className={VARIANT_CLASSES[variant].content}>
        {children}
      </ScrollAreaContent>
    </ScrollAreaViewport>
    {overlay}
    <ScrollAreaScrollbar className="w-2 p-0.5">
      <ScrollAreaThumb className="bg-ink/20 data-dragging:bg-ink/35" />
    </ScrollAreaScrollbar>
  </ScrollArea>
);
