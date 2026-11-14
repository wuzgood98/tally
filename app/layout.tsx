import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@ui-sdk/core/web.css";
import "./globals.css";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { ROOT_METADATA } from "@/lib/seo";
import { DEFAULT_THEME, themeColors } from "@/lib/theme";
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

// The default theme's; ThemeProvider repoints it at the theme in use.
export const viewport: Viewport = {
  colorScheme: DEFAULT_THEME,
  themeColor: themeColors(DEFAULT_THEME),
};

// next-themes sets data-theme before hydration, hence suppressHydrationWarning.
const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html
    className={cn(geistSans.variable, geistMono.variable)}
    lang="en-GH"
    suppressHydrationWarning
  >
    <body className="min-h-svh">
      <ThemeProvider>{children}</ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
