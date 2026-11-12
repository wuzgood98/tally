import { describe, expect, it } from "vitest";

import { formatCedis, parseCedis, pesewasToInput } from "@/lib/money";

describe("parseCedis", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    ["1,234.50", 123_450],
    ["GH₵ 8.00", 800],
    ["  0.99 ", 99],
  ])("reads %j as %i pesewas", (input, pesewas) => {
    expect(parseCedis(input)).toBe(pesewas);
  });

  it.each(["", "abc", "1.234", "-5", "12,34", "1e3", "12."])(
    "rejects %j",
    (input) => {
      expect(parseCedis(input)).toBeNull();
    }
  );
});

describe("formatting", () => {
  it("formats pesewas as cedis", () => {
    expect(formatCedis(123_456)).toBe("GH₵1,234.56");
  });

  it("prefills inputs without symbols", () => {
    expect(pesewasToInput(1250)).toBe("12.50");
  });
});
