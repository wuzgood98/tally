import { describe, expect, it } from "vitest";

import { splitForMiddleTruncation } from "@/lib/truncate";

describe("splitForMiddleTruncation", () => {
  it("keeps the last words, which tell sizes apart, out of the cut", () => {
    expect(splitForMiddleTruncation("Long grain perfumed rice 25 kg")).toEqual([
      "Long grain perfumed",
      " rice 25 kg",
    ]);
    expect(splitForMiddleTruncation("Rice cooker 2.8 L")).toEqual([
      "Rice",
      " cooker 2.8 L",
    ]);
  });

  it("always leaves a head to cut", () => {
    expect(splitForMiddleTruncation("Bleach 1 L")).toEqual(["Bleach", " 1 L"]);
    expect(splitForMiddleTruncation("Microwave-safe-container")).toEqual([
      "Microwave-safe-con",
      "tainer",
    ]);
    expect(splitForMiddleTruncation("Kettle")).toEqual(["", "Kettle"]);
  });

  it("puts the whole name back together", () => {
    const name = "Plastic bucket with lid 15 L";
    const [head, tail] = splitForMiddleTruncation(name);

    expect(`${head}${tail}`).toBe(name);
  });
});
