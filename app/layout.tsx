import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SkulletProvider } from "skullet/react";

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
// No maximumScale: it would block pinch-zoom on Android. Fields get 16px on
// touch screens instead (globals.css), so iOS doesn't zoom into them.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      {/* Loading skeletons share one measuring script; colours come from globals.css. */}
      <SkulletProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </SkulletProvider>
    </body>
  </html>
);

export default RootLayout;
