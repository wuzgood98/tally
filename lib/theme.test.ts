import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { themeOf, themeValue } from "@/lib/palette-theme";
import { parseTheme, THEME_PALETTES, themeColors } from "@/lib/theme";

/** Which `globals.css` token each colour in a theme drawing stands for. */
const TOKENS = [
  ["accent", "accent"],
  ["canvas", "canvas"],
  ["faint", "ink-3"],
  ["ink", "ink"],
  ["line", "line"],
  ["page", "paper"],
  ["surface", "surface"],
] as const satisfies readonly (readonly [
  keyof (typeof THEME_PALETTES)["light"],
  string,
])[];

const CSS = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf-8"
);

/** The light tokens are the first `:root` block; Night shift is the `@variant dark` one. */
const tokenBlock = (theme: "light" | "dark"): string => {
  const marker = theme === "light" ? ":root {" : "@variant dark {";
  const start = CSS.indexOf(marker);

  return CSS.slice(start, CSS.indexOf("}", start));
};

const tokenValue = (block: string, token: string): string | undefined =>
  new RegExp(String.raw`--${token}:\s*([^;]+);`, "u").exec(block)?.[1]?.trim();

describe("theme", () => {
  it("uses the default theme unless a known theme was saved", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme("purple")).toBe("light");
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

  it("draws each theme choice in that theme's real tokens", () => {
    for (const theme of ["light", "dark"] as const) {
      const block = tokenBlock(theme);

      for (const [key, token] of TOKENS) {
        expect(THEME_PALETTES[theme][key], `${theme} ${key}`).toBe(
          tokenValue(block, token)
        );
      }
    }
  });
});
