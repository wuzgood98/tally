import { describe, expect, it } from "vitest";

import { groupSellers, SLOW_COVER_DAYS } from "@/lib/reports/sellers";
import type { SellerRow } from "@/lib/reports/sellers";

const row = (overrides: Partial<SellerRow> & { productId: number }) => ({
  active: true,
  category: "Groceries",
  cost: 0,
  daysOfCover: null,
  margin: 0,
  name: `Product ${overrides.productId}`,
  onHand: 0,
  returnedUnits: 0,
  sales: 0,
  sku: `SKU-${overrides.productId}`,
  stockValue: 0,
  units: 0,
  ...overrides,
});

const ids = (list: readonly SellerRow[]) => list.map((item) => item.productId);

describe("groupSellers", () => {
  const rows = [
    row({ cost: 400, margin: 600, productId: 1, sales: 1000, units: 10 }),
    row({ cost: 900, margin: 300, productId: 2, sales: 1200, units: 30 }),
    row({
      daysOfCover: SLOW_COVER_DAYS + 30,
      onHand: 40,
      productId: 3,
      units: 1,
    }),
    row({ daysOfCover: SLOW_COVER_DAYS, productId: 4, units: 2 }),
    row({ onHand: 5, productId: 5, stockValue: 500 }),
    row({ onHand: 9, productId: 6, stockValue: 2000 }),
    // Sold one, then it came back: nothing sold, net.
    row({ onHand: 3, productId: 7, returnedUnits: 1, stockValue: 30 }),
    // More came back than was sold in the period: not a seller, and with
    // nothing on the shelf, not dead stock either.
    row({ productId: 8, returnedUnits: 2, units: -1 }),
  ];

  const groups = groupSellers(rows);

  it("ranks fast sellers by units", () => {
    expect(ids(groups.fast)).toEqual([2, 1, 4, 3]);
  });

  it("calls stock slow only beyond the cover limit", () => {
    expect(ids(groups.slow)).toEqual([3]);
  });

  it("lists stock that didn't sell by the money tied up", () => {
    expect(ids(groups.unsold)).toEqual([6, 5, 7]);
  });

  it("totals the period, returns netted", () => {
    expect(groups.totals).toEqual({
      cost: 1300,
      margin: 900,
      sales: 2200,
      units: 42,
      unsoldValue: 2530,
    });
  });
});
