import { describe, expect, it } from "vitest";

import { cedisCell, toCsv } from "@/lib/reports/csv";

describe("csv", () => {
  it("quotes cells with commas, quotes or line breaks", () => {
    expect(toCsv([["Rice, 5 kg", 'Kettle "1.7 L"', "Two\nlines"]])).toBe(
      '"Rice, 5 kg","Kettle ""1.7 L""","Two\nlines"\r\n'
    );
  });

  it("stops text being read as a spreadsheet formula", () => {
    expect(toCsv([["=SUM(A1)", "-5 promo", "@home"]])).toBe(
      "'=SUM(A1),'-5 promo,'@home\r\n"
    );
  });

  it("leaves numbers alone, negatives included, and blanks nulls", () => {
    expect(toCsv([["-12", "3.50", null]])).toBe("-12,3.50,\r\n");
  });

  it("writes pesewas as cedis with two decimals", () => {
    expect(cedisCell(123_456)).toBe("1234.56");
    expect(cedisCell(-50)).toBe("-0.50");
    expect(cedisCell(0)).toBe("0.00");
  });
});
