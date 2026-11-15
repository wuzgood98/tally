import { describe, expect, it } from "vitest";

import { pesewasToCashInput } from "@/lib/money";
import { changeDue, quickCash, readTender } from "@/lib/stock/quick-cash";

describe("quickCash", () => {
  it("offers the next round amounts above a big basket", () => {
    expect(quickCash(86_550)).toEqual([87_000, 88_000, 90_000]);
  });

  it("offers small notes for a small basket", () => {
    expect(quickCash(350)).toEqual([500, 1000, 2000]);
  });

  it("leaves out the total itself when it is already round", () => {
    expect(quickCash(4500)).toEqual([5000, 6000, 10_000]);
    expect(quickCash(20_000)).toEqual([]);
  });

  it("offers nothing for an empty basket", () => {
    expect(quickCash(0)).toEqual([]);
  });
});

describe("pesewasToCashInput", () => {
  it("writes whole cedis without decimals", () => {
    expect(pesewasToCashInput(87_000)).toBe("870");
  });

  it("keeps the pesewas when there are some", () => {
    expect(pesewasToCashInput(86_550)).toBe("865.50");
  });
});

describe("readTender", () => {
  it("is nothing until cash is typed", () => {
    expect(readTender("  ", 4200)).toEqual({ kind: "none" });
  });

  it("flags cash it can't read", () => {
    expect(readTender("50.555", 4200)).toEqual({ kind: "invalid" });
  });

  it("works out what's still owed", () => {
    expect(readTender("40", 4200)).toEqual({
      amount: 200,
      kind: "short",
      tendered: 4000,
    });
  });

  it("works out the change, zero for the exact amount", () => {
    expect(readTender("50", 4200)).toEqual({
      amount: 800,
      kind: "change",
      tendered: 5000,
    });
    expect(readTender("42", 4200)).toEqual({
      amount: 0,
      kind: "change",
      tendered: 4200,
    });
  });
});

describe("changeDue", () => {
  it("is the change when some is due", () => {
    expect(changeDue(readTender("50", 4200))).toBe(800);
  });

  it("is null when nothing is handed back", () => {
    expect(changeDue(readTender("42", 4200))).toBeNull();
    expect(changeDue(readTender("40", 4200))).toBeNull();
    expect(changeDue(readTender("", 4200))).toBeNull();
  });
});
