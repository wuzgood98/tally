import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  description:
    "Stock across every branch: receiving, adjustments, low-stock alerts and a full movement ledger.",
  // A staff tool: keep it out of search engines.
  robots: { follow: false, index: false },
  title: { default: "Tally", template: "%s · Tally" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { color: "#f5f3ee", media: "(prefers-color-scheme: light)" },
    { color: "#121411", media: "(prefers-color-scheme: dark)" },
  ],
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html className={cn(plexSans.variable, plexMono.variable)} lang="en-GH">
    <body className="min-h-svh">{children}</body>
  </html>
);

export default RootLayout;
