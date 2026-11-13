import { describe, expect, it } from "vitest";

import { parseDocumentQuery } from "@/lib/document-query";

describe("parseDocumentQuery", () => {
  it("reads a whole document number", () => {
    expect(parseDocumentQuery("PO-SPX-000012")).toEqual({
      branch: "SPX",
      documentLike: true,
      prefix: "PO",
      serial: "12",
    });
  });

  it("forgives case, spaces, missing parts and leading zeros", () => {
    expect(parseDocumentQuery("po spx 12")).toMatchObject({
      branch: "SPX",
      prefix: "PO",
      serial: "12",
    });
    expect(parseDocumentQuery("spx-42")).toMatchObject({
      branch: "SPX",
      prefix: null,
      serial: "42",
    });
    expect(parseDocumentQuery("trf 7")).toMatchObject({
      branch: null,
      prefix: "TRF",
      serial: "7",
    });
    expect(parseDocumentQuery("000042")).toMatchObject({
      branch: null,
      documentLike: true,
      prefix: null,
      serial: "42",
    });
    expect(parseDocumentQuery("000")?.serial).toBe("0");
  });

  it("ignores words with no serial number, and odd shapes", () => {
    expect(parseDocumentQuery("rice")).toBeNull();
    expect(parseDocumentQuery("PO-SPX")).toBeNull();
    expect(parseDocumentQuery("12 rice")).toBeNull();
    expect(parseDocumentQuery("jasmine rice 5")).toBeNull();
    expect(parseDocumentQuery("")).toBeNull();
  });

  it("leaves a barcode to the product search", () => {
    expect(parseDocumentQuery("5012345678900")).toBeNull();
    expect(parseDocumentQuery("1234567")?.documentLike).toBe(false);
  });
});
