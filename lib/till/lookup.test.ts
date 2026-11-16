import { describe, expect, it } from "vitest";

import { chargeBody, draftSale } from "@/lib/till/draft";
import { lookupTillProducts } from "@/lib/till/lookup";
import type { TillProduct, TillStockLevel } from "@/lib/till/schema";

const product = (
  id: number,
  name: string,
  sku: string,
  barcode: string | null = null
): TillProduct => ({
  barcode,
  id,
  name,
  sellPrice: 1000 * id,
  sku,
  unit: "each",
});

const PRODUCTS = [
  product(1, "Jasmine rice 5 kg", "GR-0001", "6031234567890"),
  product(2, "Jasmine rice 25 kg", "GR-0002"),
  product(3, "Electric kettle 1.7 L", "HK-0001"),
];

const LEVELS: TillStockLevel[] = [
  { branchId: "SPX", key: "SPX:1", onHand: 12, productId: 1 },
  { branchId: "KSI", key: "KSI:1", onHand: -2, productId: 1 },
  { branchId: "SPX", key: "SPX:3", onHand: 4, productId: 3 },
];

describe("lookupTillProducts", () => {
  it("adds a scanned barcode at once, with its counts and no cost", () => {
    const { exact, matches } = lookupTillProducts(
      " 6031234567890 ",
      PRODUCTS,
      LEVELS
    );

    expect(matches).toEqual([]);
    expect(exact).toMatchObject({
      averageCost: null,
      id: 1,
      onHand: { KSI: -2, SPX: 12 },
    });
  });

  it("matches a SKU in any case", () => {
    expect(lookupTillProducts("hk-0001", PRODUCTS, LEVELS).exact?.id).toBe(3);
  });

  it("lists name matches in name order, with empty counts where never stocked", () => {
    const { exact, matches } = lookupTillProducts("RICE", PRODUCTS, LEVELS);

    expect(exact).toBeNull();
    expect(matches.map((item) => item.id)).toEqual([2, 1]);
    expect(matches[0]?.onHand).toEqual({});
  });

  it("finds nothing for blank text", () => {
    expect(lookupTillProducts("   ", PRODUCTS, LEVELS)).toEqual({
      exact: null,
      matches: [],
    });
  });
});

describe("a charged sale before the server answers", () => {
  const input = {
    branchId: "SPX",
    cashierId: "u-till",
    clientRef: "till-ref-0001",
    expectedTotal: 37_000,
    lines: [
      { productId: 1, quantity: 2 },
      { productId: 3, quantity: 1 },
    ],
    paymentMethod: "cash" as const,
  };

  it("shows the till's total and no number yet", () => {
    const now = new Date("2026-11-16T10:00:00.000Z");

    expect(draftSale(input, now)).toEqual({
      branchId: "SPX",
      clientRef: "till-ref-0001",
      createdAt: "2026-11-16T10:00:00.000Z",
      expectedTotal: 37_000,
      id: null,
      number: null,
      paymentMethod: "cash",
      total: 37_000,
      units: 3,
    });
  });

  it("sends ids and quantities, never prices", () => {
    const body = chargeBody(input);

    expect(body.lines).toEqual([
      { productId: 1, quantity: 2 },
      { productId: 3, quantity: 1 },
    ]);
    expect(JSON.stringify(body)).not.toContain("Price");
  });
});
