/**
 * How much to send a store that's running low: enough to fill it to twice its
 * reorder point, counting what's already on the way. A simple rule a manager
 * can check in their head; they can change any quantity before sending.
 */

export const TOP_UP_FACTOR = 2;

export interface TopUpLine {
  readonly productId: number;
  readonly onHand: number;
  readonly reorderPoint: number;
  readonly inTransit: number;
}

export const topUpQuantity = (line: TopUpLine): number =>
  Math.max(line.reorderPoint * TOP_UP_FACTOR - line.onHand - line.inTransit, 0);

/** The new-transfer pre-fill: "12:40,15:10", leaving out lines that need nothing. */
export const topUpLinesParam = (lines: readonly TopUpLine[]): string =>
  lines
    .flatMap((line) => {
      const quantity = topUpQuantity(line);

      return quantity > 0 ? [`${line.productId}:${quantity}`] : [];
    })
    .join(",");
