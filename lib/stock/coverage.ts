/**
 * What a reorder gauge shows: the shelf against its reorder point, and the
 * stock already coming to it. Pure, so the tables and their tests share it.
 */
import { formatCount } from "@/lib/format";
import { stockStatus } from "@/lib/queries/stock-status";
import type { StockStatus } from "@/lib/queries/stock-status";
import { TOP_UP_FACTOR } from "@/lib/stock/top-up";

/**
 * "covered": low or empty, but what's on the way, on order or requested
 * already lifts it above its reorder point, so nobody needs to act on it.
 */
export type ShelfStatus = StockStatus | "covered";

export interface Incoming {
  /** On a transfer to this branch. */
  readonly inTransit: number;
  /** Still due on approved purchase orders. */
  readonly onOrder: number;
  /** On this branch's open requests to the warehouse. */
  readonly requested: number;
}

/** One branch's stock of one product: the shelf, its threshold, what's coming. */
export interface ShelfLine extends Incoming {
  readonly onHand: number;
  readonly reorderPoint: number;
}

export const incomingUnits = (incoming: Incoming): number =>
  incoming.inTransit + incoming.onOrder + incoming.requested;

/**
 * A line that needs a count stays "count" whatever is coming: its record is
 * wrong, and more stock won't fix that.
 */
export const shelfStatus = (line: ShelfLine): ShelfStatus => {
  const { onHand, reorderPoint } = line;
  const status = stockStatus(onHand, reorderPoint);
  const lifted = onHand + incomingUnits(line) > reorderPoint;

  return (status === "low" || status === "out") && lifted ? "covered" : status;
};

/** Positions along the gauge's track, as percentages of its width. */
export interface GaugeScale {
  readonly fill: number;
  readonly incoming: number;
  readonly mark: number;
}

const PERCENT = 100;

const share = (units: number, of: number): number =>
  Math.round((Math.min(Math.max(units, 0), of) / of) * PERCENT * 10) / 10;

/**
 * The track runs to the top-up target (twice the reorder point), or further
 * when the shelf and what's coming hold more, so nothing spills off the end.
 */
export const gaugeScale = (line: ShelfLine): GaugeScale => {
  const { onHand, reorderPoint } = line;
  const incoming = incomingUnits(line);
  const shelf = Math.max(onHand, 0);
  const end = Math.max(reorderPoint * TOP_UP_FACTOR, shelf + incoming, 1);
  const fill = share(shelf, end);

  return {
    fill,
    incoming: Math.min(share(incoming, end), PERCENT - fill),
    mark: share(reorderPoint, end),
  };
};

/** "+120 on the way", or "+160 coming" when it comes by more than one road. */
export const incomingLabel = (incoming: Incoming): string | null => {
  const parts = [
    { label: "on the way", units: incoming.inTransit },
    { label: "on order", units: incoming.onOrder },
    { label: "requested", units: incoming.requested },
  ].filter((part) => part.units > 0);

  const [only] = parts;

  if (only === undefined) {
    return null;
  }

  const total = formatCount(incomingUnits(incoming));

  return parts.length === 1 ? `+${total} ${only.label}` : `+${total} coming`;
};
