"use client";

import { useShortcut } from "@ui-sdk/react/shortcuts";
import { toast } from "@ui-sdk/react/toast";
import type { RefObject } from "react";

/** Copies the highlighted product's SKU, as Ctrl+C or ⌘C would copy text. */
export const COPY_SKU_SHORTCUT = "mod+c";

/**
 * Text selected in the palette keeps the browser's copy: in the search box,
 * or dragged across a row while the box keeps focus. A selection left on the
 * page behind the palette doesn't count.
 */
const hasSelectedText = (palette: HTMLElement | null): boolean => {
  const field = document.activeElement;

  if (
    (field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement) &&
    field.selectionStart !== field.selectionEnd
  ) {
    return true;
  }

  const selection = window.getSelection();

  return (
    selection !== null &&
    !selection.isCollapsed &&
    palette?.contains(selection.anchorNode) === true
  );
};

const copySku = async (sku: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(sku);
    toast.success(`Copied ${sku}`);
  } catch {
    toast.error("Couldn't copy the SKU");
  }
};

/**
 * Ctrl/Cmd+C copies this SKU; the palette stays open. Rendered only while a
 * product is highlighted, and on the palette's layer, so it's off otherwise.
 */
export const CopySkuShortcut = ({
  layer,
  sku,
}: {
  readonly layer: RefObject<HTMLElement | null>;
  readonly sku: string;
}) => {
  useShortcut(
    COPY_SKU_SHORTCUT,
    () => {
      void copySku(sku);
    },
    {
      allowInInput: true,
      description: "Copy SKU",
      layer,
      when: () => !hasSelectedText(layer.current),
    }
  );

  return null;
};
