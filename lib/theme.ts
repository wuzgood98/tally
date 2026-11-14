export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

/** Used until someone picks a theme. */
export const DEFAULT_THEME = "light" satisfies Theme;

/** Where next-themes keeps the choice in this browser. */
export const THEME_STORAGE_KEY = "tally-theme";

export const THEME_LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "Match this device",
};

export const isTheme = (value: string): value is Theme =>
  THEMES.some((theme) => theme === value);

/** The saved choice; anything missing or unexpected is the default. */
export const parseTheme = (value: string | undefined): Theme =>
  value !== undefined && isTheme(value) ? value : DEFAULT_THEME;

/** Colours for the browser's own chrome, as in `lib/brand.ts`. */
export const THEME_CHROME = { dark: "#08090a", light: "#e9ebef" } as const;

export interface ThemeColor {
  readonly color: string;
  readonly media?: string;
}

export const themeColors = (theme: Theme): ThemeColor[] =>
  theme === "system"
    ? [
        { color: THEME_CHROME.light, media: "(prefers-color-scheme: light)" },
        { color: THEME_CHROME.dark, media: "(prefers-color-scheme: dark)" },
      ]
    : [{ color: THEME_CHROME[theme] }];
