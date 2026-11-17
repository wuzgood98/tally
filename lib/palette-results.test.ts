import { describe, expect, it } from "vitest";

import type { PaletteDocument } from "@/lib/palette-documents";
import { paletteScore } from "@/lib/palette-filter";
import {
  documentsFirst,
  documentValue,
  hitsOf,
  keepsWhileLoading,
  productOf,
  productValue,
  resultHref,
  resultScore,
  LOWEST_RESULT_SCORE,
  SEE_ALL_PRODUCTS,
  topResult,
} from "@/lib/palette-results";
import type { PaletteProduct } from "@/lib/palette-search";

const rice: PaletteProduct = {
  active: true,
  exact: false,
  id: 7,
  name: "Jasmine rice 5 kg",
  onHand: 12,
  sku: "GR-0001",
};

const order: PaletteDocument = {
  detail: "Spintex · Draft",
  exact: false,
  href: "/purchase-orders/3",
  kind: "Purchase order",
  number: "PO-SPX-000012",
};

const hits = hitsOf({ documents: [order], products: [rice] });
const lowStockPage = paletteScore({ label: "Low stock" }, "low");

describe("resultScore", () => {
  it("ranks products and documents below any page that matches, and See all last", () => {
    const product = resultScore(productValue(7), "rice", hits) ?? 0;
    const document = resultScore(documentValue(order.number), "12", hits) ?? 0;

    expect(product).toBeLessThan(lowStockPage);
    expect(document).toBeLessThan(lowStockPage);
    expect(resultScore(SEE_ALL_PRODUCTS, "rice", hits)).toBeLessThan(product);
  });

  it("puts documents above products only for text that reads like a number", () => {
    const value = documentValue(order.number);
    const product = resultScore(productValue(7), "x", hits) ?? 0;

    expect(resultScore(value, "po 12", hits)).toBeGreaterThan(product);
    expect(resultScore(value, "1234567", hits)).toBeLessThan(product);
  });

  it("ranks a scan above a whole document number, and both above every page", () => {
    const scanned = hitsOf({
      documents: [{ ...order, exact: true }],
      products: [{ ...rice, exact: true }],
    });

    const scan = resultScore(productValue(7), "x", scanned) ?? 0;
    const number = resultScore(documentValue(order.number), "x", scanned) ?? 0;

    expect(scan).toBeGreaterThan(number);
    expect(number).toBeGreaterThan(
      paletteScore({ label: "Low stock" }, "low stock")
    );
  });

  it("leaves pages and actions to the palette's own filter", () => {
    expect(resultScore("go:/low-stock", "low", hits)).toBeNull();
  });
});

describe("resultHref", () => {
  it("opens a product, a document, or the product list with the search", () => {
    expect(resultHref(productValue(7), "rice", hits)).toBe("/products/7");
    expect(resultHref(documentValue(order.number), "12", hits)).toBe(
      "/purchase-orders/3"
    );
    expect(resultHref(SEE_ALL_PRODUCTS, " rice & beans ", hits)).toBe(
      "/products?q=rice%20%26%20beans"
    );
    expect(resultHref("go:/", "rice", hits)).toBeNull();
  });
});

describe("documentsFirst", () => {
  it("reads prefixes, branches and short serials as document numbers", () => {
    expect(documentsFirst("PO-SPX-12")).toBe(true);
    expect(documentsFirst("spx 12")).toBe(true);
    expect(documentsFirst("000042")).toBe(true);
    expect(documentsFirst("rice")).toBe(false);
    expect(documentsFirst("5012345678900")).toBe(false);
  });
});

describe("productOf", () => {
  it("finds the product a highlighted value stands for", () => {
    expect(productOf(productValue(7), hits)).toBe(rice);
    expect(productOf(productValue(8), hits)).toBeNull();
    expect(productOf(documentValue(order.number), hits)).toBeNull();
    expect(productOf(SEE_ALL_PRODUCTS, hits)).toBeNull();
    expect(productOf(null, hits)).toBeNull();
  });
});

describe("topResult", () => {
  it("picks the highest-ranked result, or none", () => {
    const exactOrder = hitsOf({
      documents: [{ ...order, exact: true }],
      products: [rice],
    });

    expect(topResult("rice", hits)).toBe(productValue(7));
    expect(topResult("PO-SPX-000012", exactOrder)).toBe(
      documentValue(order.number)
    );
    expect(topResult("rice", [])).toBeNull();
  });
});

describe("LOWEST_RESULT_SCORE", () => {
  it("is See all's score, the lowest result's", () => {
    expect(resultScore(SEE_ALL_PRODUCTS, "rice", hits)).toBe(
      LOWEST_RESULT_SCORE
    );
  });
});

describe("keepsWhileLoading", () => {
  it("keeps the last search's rows that still match, and See all", () => {
    const riceRow = {
      label: "Jasmine rice 5 kg GR-0001",
      value: productValue(7),
    };

    expect(keepsWhileLoading(riceRow, "rice 5")).toBe(true);
    expect(keepsWhileLoading(riceRow, "gr-00")).toBe(true);
    expect(keepsWhileLoading(riceRow, "kettle")).toBe(false);
    expect(
      keepsWhileLoading(
        { label: "See all results", value: SEE_ALL_PRODUCTS },
        "kettle"
      )
    ).toBe(true);
  });
});
