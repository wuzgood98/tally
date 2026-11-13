import { describe, expect, it } from "vitest";

import { themeOf, themeValue } from "@/lib/palette-theme";
import { parseTheme, themeColors } from "@/lib/theme";

describe("theme", () => {
  it("follows the device unless a known theme was saved", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("purple")).toBe("system");
  });

  it("gives the browser one chrome colour for a chosen theme, two for the device's", () => {
    expect(themeColors("dark")).toEqual([{ color: "#08090a" }]);
    expect(themeColors("system")).toHaveLength(2);
  });

  it("reads the theme back out of a palette command", () => {
    expect(themeOf(themeValue("light"))).toBe("light");
    expect(themeOf("theme:page")).toBeNull();
    expect(themeOf("go:/")).toBeNull();
  });
});
