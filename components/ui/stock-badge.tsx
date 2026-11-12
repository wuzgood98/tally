import type { StockStatus } from "@/lib/queries/stock-status";
import { cn } from "@/lib/utils";

const STYLES: Record<StockStatus, string> = {
  low: "bg-warn-soft text-warn",
  ok: "bg-brand-soft text-good",
  out: "bg-danger-soft text-danger",
};

const LABELS: Record<StockStatus, string> = {
  low: "Low",
  ok: "In stock",
  out: "Out",
};

export const StockBadge = ({
  status,
  label,
}: {
  readonly status: StockStatus;
  readonly label?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
      STYLES[status]
    )}
  >
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    {label ?? LABELS[status]}
  </span>
);
