import { describe, expect, it } from "vitest";

import {
  barRuns,
  ean13Modules,
  gtinCheckDigit,
  isValidGtin,
} from "@/lib/barcode";

describe("GTIN barcodes", () => {
  it("computes check digits for known codes", () => {
    expect(gtinCheckDigit("400638133393")).toBe(1);
    expect(gtinCheckDigit("590123412345")).toBe(7);
    // UPC-A and EAN-8
    expect(gtinCheckDigit("03600029145")).toBe(2);
    expect(gtinCheckDigit("9638507")).toBe(4);
  });

  it("accepts valid codes of every length", () => {
    for (const code of [
      "4006381333931",
      "036000291452",
      "96385074",
      "10036000291459",
    ]) {
      expect(isValidGtin(code)).toBe(true);
    }
  });

  it("rejects mistyped, short and non-numeric codes", () => {
    for (const code of ["4006381333932", "4006381333", "40063813339A1", ""]) {
      expect(isValidGtin(code)).toBe(false);
    }
  });
});

describe("EAN-13 bars", () => {
  it("encodes a known code module for module", () => {
    // 4006381333931: first digit 4 gives parity LGLLGG.
    expect(ean13Modules("4006381333931")).toBe(
      [
        "101",
        // 0 L
        "0001101",
        // 0 G
        "0100111",
        // 6 L
        "0101111",
        // 3 L
        "0111101",
        // 8 G
        "0001001",
        // 1 G
        "0110011",
        "01010",
        // 3 R
        "1000010",
        // 3 R
        "1000010",
        // 3 R
        "1000010",
        // 9 R
        "1110100",
        // 3 R
        "1000010",
        // 1 R
        "1100110",
        "101",
      ].join("")
    );
  });

  it("is always 95 modules between guards", () => {
    const modules = ean13Modules("6031000129471");

    expect(modules).toHaveLength(95);
    expect(modules.startsWith("101")).toBe(true);
    expect(modules.endsWith("101")).toBe(true);
    expect(modules.slice(45, 50)).toBe("01010");
  });

  it("refuses codes that aren't valid EAN-13", () => {
    expect(() => ean13Modules("6031000129470")).toThrow("Not a valid");
    expect(() => ean13Modules("96385074")).toThrow("Not a valid");
  });

  it("merges adjacent modules into bars", () => {
    expect(barRuns("1101110")).toEqual([
      { width: 2, x: 0 },
      { width: 3, x: 3 },
    ]);
  });
});
