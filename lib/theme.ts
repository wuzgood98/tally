export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "tally-theme";

export const THEME_LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "Match this device",
};

export const isTheme = (value: string): value is Theme =>
  THEMES.some((theme) => theme === value);

/** The saved choice; anything missing or unexpected follows the device. */
export const parseTheme = (value: string | undefined): Theme =>
  value !== undefined && isTheme(value) ? value : "system";

/** Colours for the browser's own chrome, as in `lib/brand.ts`. */
const CHROME = { dark: "#08090a", light: "#e9ebef" } as const;

export interface ThemeColor {
  readonly color: string;
  readonly media?: string;
}

export const themeColors = (theme: Theme): ThemeColor[] =>
  theme === "system"
    ? [
        { color: CHROME.light, media: "(prefers-color-scheme: light)" },
        { color: CHROME.dark, media: "(prefers-color-scheme: dark)" },
      ]
    : [{ color: CHROME[theme] }];
