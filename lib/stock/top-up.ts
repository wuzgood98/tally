/**
 * How much a branch that's running low needs: enough to fill it to twice its
 * reorder point, counting what's already on the way from another branch and
 * what's already on order from a supplier. A simple rule a manager can check
 * in their head; they can change any quantity before sending or ordering.
 */

export const TOP_UP_FACTOR = 2;

export interface TopUpLine {
  readonly productId: number;
  readonly onHand: number;
  readonly reorderPoint: number;
  readonly inTransit: number;
  /** Still due on approved purchase orders. */
  readonly onOrder?: number;
}

export const topUpQuantity = (line: TopUpLine): number =>
  Math.max(
    line.reorderPoint * TOP_UP_FACTOR -
      line.onHand -
      line.inTransit -
      (line.onOrder ?? 0),
    0
  );

/** A form pre-fill, "12:40,15:10", leaving out lines that need nothing. */
export const topUpLinesParam = (lines: readonly TopUpLine[]): string =>
  lines
    .flatMap((line) => {
      const quantity = topUpQuantity(line);

      return quantity > 0 ? [`${line.productId}:${quantity}`] : [];
    })
    .join(",");
