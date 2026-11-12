import { describe, expect, it } from "vitest";

import { gtinCheckDigit, isValidGtin } from "@/lib/barcode";

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
