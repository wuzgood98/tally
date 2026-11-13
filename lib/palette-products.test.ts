import { describe, expect, it } from "vitest";

import { paletteScore } from "@/lib/palette-filter";
import {
  productHref,
  productScore,
  productValue,
  SEE_ALL_PRODUCTS,
} from "@/lib/palette-products";
import type { PaletteProduct } from "@/lib/palette-search";

const rice: PaletteProduct = {
  active: true,
  exact: false,
  id: 7,
  name: "Jasmine rice 5 kg",
  onHand: 12,
  sku: "GR-0001",
};

describe("productScore", () => {
  it("ranks a product below any page that matches, and above See all", () => {
    const product = productScore(productValue(7), [rice]) ?? 0;

    const page = paletteScore(
      { keywords: ["reorder"], label: "Low stock" },
      "reorder"
    );

    expect(product).toBeLessThan(page);
    expect(productScore(SEE_ALL_PRODUCTS, [rice])).toBeLessThan(product);
  });

  it("ranks an exact barcode or SKU above everything", () => {
    const exact =
      productScore(productValue(7), [{ ...rice, exact: true }]) ?? 0;

    expect(exact).toBeGreaterThan(paletteScore({ label: "Low stock" }, "low"));
  });

  it("leaves pages and actions to the palette's own filter", () => {
    expect(productScore("go:/low-stock", [rice])).toBeNull();
  });
});

describe("productHref", () => {
  it("opens a product, or the product list with the search", () => {
    expect(productHref(productValue(7), "rice")).toBe("/products/7");
    expect(productHref(SEE_ALL_PRODUCTS, " rice & beans ")).toBe(
      "/products?q=rice%20%26%20beans"
    );
    expect(productHref("go:/", "rice")).toBeNull();
  });
});
