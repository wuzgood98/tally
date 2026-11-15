import { SHELF_STATUS } from "@/components/ui/shelf-status";
import type { ShelfStatus } from "@/lib/stock/coverage";
import { cn } from "@/lib/utils";

export const StockBadge = ({
  status,
  label,
}: {
  readonly status: ShelfStatus;
  readonly label?: string;
}) => (
  <span
    className={cn(
      "inline-flex h-5 items-center gap-1.5 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap",
      SHELF_STATUS[status].badge
    )}
  >
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    {label ?? SHELF_STATUS[status].label}
  </span>
);
