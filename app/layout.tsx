import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import "@ui-sdk/core/web.css";
import "./globals.css";
import { ROOT_METADATA } from "@/lib/seo";
import { parseTheme, THEME_COOKIE, themeColors } from "@/lib/theme";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

// A staff tool: shareable, but only the sign-in page is indexable.
export const metadata: Metadata = ROOT_METADATA;

const savedTheme = async (): Promise<Theme> => {
  const jar = await cookies();

  return parseTheme(jar.get(THEME_COOKIE)?.value);
};

export const generateViewport = async (): Promise<Viewport> => {
  const theme = await savedTheme();

  return {
    colorScheme: theme === "system" ? "light dark" : theme,
    themeColor: themeColors(theme),
  };
};

// The theme is set on the server, so the first paint is already right.
const RootLayout = async ({ children }: LayoutProps<"/">) => {
  const theme = await savedTheme();

  return (
    <html
      className={cn(geistSans.variable, geistMono.variable)}
      data-theme={theme === "system" ? undefined : theme}
      lang="en-GH"
    >
      <body className="min-h-svh">{children}</body>
    </html>
  );
};

export default RootLayout;
