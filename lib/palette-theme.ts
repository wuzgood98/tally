import { isTheme } from "@/lib/theme";
import type { Theme } from "@/lib/theme";

export const THEME_PAGE = "theme";

const THEME_PREFIX = "theme:";

export const themeValue = (theme: Theme): string => `${THEME_PREFIX}${theme}`;

/** The theme a command picks, or null when it isn't a theme command. */
export const themeOf = (value: string): Theme | null => {
  if (!value.startsWith(THEME_PREFIX)) {
    return null;
  }

  const rest = value.slice(THEME_PREFIX.length);

  return isTheme(rest) ? rest : null;
};
