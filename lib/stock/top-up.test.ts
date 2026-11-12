import { describe, expect, it } from "vitest";

import { topUpLinesParam, topUpQuantity } from "@/lib/stock/top-up";

describe("topUpQuantity", () => {
  it("fills to twice the reorder point", () => {
    expect(
      topUpQuantity({ inTransit: 0, onHand: 3, productId: 1, reorderPoint: 10 })
    ).toBe(17);
  });

  it("counts what is already on the way", () => {
    expect(
      topUpQuantity({
        inTransit: 12,
        onHand: 3,
        productId: 1,
        reorderPoint: 10,
      })
    ).toBe(5);
  });

  it("counts what is already on order from a supplier", () => {
    expect(
      topUpQuantity({
        inTransit: 4,
        onHand: 3,
        onOrder: 6,
        productId: 1,
        reorderPoint: 10,
      })
    ).toBe(7);
  });

  it("never asks for a negative amount", () => {
    expect(
      topUpQuantity({
        inTransit: 30,
        onHand: 0,
        productId: 1,
        reorderPoint: 10,
      })
    ).toBe(0);
  });
});

describe("topUpLinesParam", () => {
  it("lists only the lines that need stock", () => {
    expect(
      topUpLinesParam([
        { inTransit: 0, onHand: 0, productId: 7, reorderPoint: 5 },
        { inTransit: 20, onHand: 0, productId: 8, reorderPoint: 5 },
        { inTransit: 0, onHand: 4, productId: 9, reorderPoint: 5 },
      ])
    ).toBe("7:10,9:6");
  });
});
