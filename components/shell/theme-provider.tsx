"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { DEFAULT_THEME, THEME_CHROME, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * The server sends the default theme's theme-color. A chosen theme, or the
 * device's, can differ from it, so point the tag at the one in use.
 */
const ThemeColorSync = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") {
      return;
    }

    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )) {
      meta.content = THEME_CHROME[resolvedTheme];
    }
  }, [resolvedTheme]);

  return null;
};

/**
 * next-themes keeps the choice in localStorage and sets `data-theme` on
 * <html> from an inline script before the first paint. Colours snap rather
 * than fade while it changes.
 */
export const ThemeProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <NextThemesProvider
    attribute="data-theme"
    defaultTheme={DEFAULT_THEME}
    disableTransitionOnChange
    enableSystem
    storageKey={THEME_STORAGE_KEY}
  >
    <ThemeColorSync />
    {children}
  </NextThemesProvider>
);
