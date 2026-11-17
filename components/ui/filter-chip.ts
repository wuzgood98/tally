/*
 * A list's filter chip, shared by the `Select` filter variants and the
 * Movements product chip (a link), with every control's corners
 * (`rounded-control`, the Frame tray's 14px).
 */

/** The chip's shape, in either state. A `Select` adds `press`; the link chip isn't pressed. */
export const FILTER_CHIP =
  "inline-flex h-9 max-w-full min-w-0 items-center gap-1.5 rounded-control border px-3.5 text-start text-sm";

/** A chip with a filter on: brand-tinted. */
export const FILTER_CHIP_ON = `${FILTER_CHIP} border-brand/30 bg-brand-soft text-brand font-medium`;

/**
 * The × that clears a chip. It sits 6px in from the chip's end, so its corners
 * are the chip's less that inset (`rounded-lg`, 8px), not a control's own.
 */
export const FILTER_CHIP_CLEAR =
  "text-brand hover:bg-brand/15 grid size-6 place-items-center rounded-lg";
