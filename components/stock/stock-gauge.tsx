import { SHELF_STATUS } from "@/components/ui/shelf-status";
import { formatCount } from "@/lib/format";
import { stockStatus } from "@/lib/queries/stock-status";
import { gaugeScale, incomingLabel, incomingUnits } from "@/lib/stock/coverage";
import type { ShelfLine } from "@/lib/stock/coverage";
import { cn } from "@/lib/utils";

interface StockGaugeProps {
  readonly line: ShelfLine;
  /** Read after the reorder point, such as "set for this branch". */
  readonly reorderNote?: string;
}

/** "0 on hand, reorder at 60, 120 on the way." */
const spoken = (
  line: ShelfLine,
  note: string | undefined,
  incoming: string | null
): string => {
  const reorder = `reorder at ${formatCount(line.reorderPoint)}${note === undefined ? "" : ` (${note})`}`;
  const parts = [`${formatCount(line.onHand)} on hand`, reorder];

  if (incoming !== null) {
    parts.push(incoming.replace("+", ""));
  }

  return `${parts.join(", ")}.`;
};

/**
 * One line's stock as a bar: the fill is the shelf, the tick is the reorder
 * point, the hatching is stock already coming. The track ends at the top-up
 * target, so a line that only needs a nudge looks it. Drawn once, without
 * motion: people read these tables many times a day.
 */
export const StockGauge = ({ line, reorderNote }: StockGaugeProps) => {
  const { onHand, reorderPoint } = line;
  const coming = incomingUnits(line);
  const scale = gaugeScale(line);
  const label = incomingLabel(line);
  const status = stockStatus(onHand, reorderPoint);

  return (
    <div className="grid min-w-36 gap-1.5">
      <span
        aria-hidden="true"
        className="bg-surface-2 ring-line relative block h-2 rounded-xs ring-1 ring-inset"
      >
        {status === "count" ? (
          <span className="gauge-short absolute inset-y-0 right-full mr-0.5 w-2.5 rounded-l-xs" />
        ) : null}
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-(--fill) rounded-xs",
            SHELF_STATUS[status].fill
          )}
          style={{ "--fill": `${scale.fill}%` }}
        />
        {coming > 0 ? (
          <span
            className="gauge-incoming absolute inset-y-0 left-(--fill) w-(--incoming) rounded-r-xs"
            style={{
              "--fill": `${scale.fill}%`,
              "--incoming": `${scale.incoming}%`,
            }}
          />
        ) : null}
        <span
          className="bg-ink absolute -inset-y-0.75 left-(--mark) w-0.5 -translate-x-1/2 rounded-full"
          style={{ "--mark": `${scale.mark}%` }}
        />
      </span>
      <span
        aria-hidden="true"
        className="figures text-ink-3 text-2xs flex justify-between gap-3 whitespace-nowrap"
      >
        <span>
          <span
            className={cn(
              "font-semibold",
              status === "count" ? "text-danger" : "text-ink"
            )}
          >
            {formatCount(onHand)}
          </span>{" "}
          / {formatCount(reorderPoint)}
        </span>
        {label === null ? null : <span className="text-brand">{label}</span>}
      </span>
      <span className="sr-only">{spoken(line, reorderNote, label)}</span>
    </div>
  );
};
