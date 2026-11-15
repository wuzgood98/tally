import type { ShelfStatus } from "@/lib/stock/coverage";

interface ShelfStatusLook {
  /** As a badge reads it: "Needs a count". */
  readonly label: string;
  readonly badge: string;
  /** The gauge's fill. A covered line's shelf is still low, so it fills amber. */
  readonly fill: string;
}

/** How each stock status looks, wherever it's drawn. */
export const SHELF_STATUS: Record<ShelfStatus, ShelfStatusLook> = {
  count: {
    badge: "bg-danger-soft text-danger",
    fill: "",
    label: "Needs a count",
  },
  covered: {
    badge: "bg-brand-soft text-brand",
    fill: "bg-warn",
    label: "Covered",
  },
  low: {
    badge: "bg-warn-soft text-warn",
    fill: "bg-warn",
    label: "Low",
  },
  ok: {
    badge: "bg-brand-soft text-good",
    fill: "bg-brand/55",
    label: "In stock",
  },
  out: {
    badge: "bg-danger-soft text-danger",
    fill: "",
    label: "Out",
  },
};
