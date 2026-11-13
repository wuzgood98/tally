import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@ui-sdk/core/web.css";
import "./globals.css";
import { ROOT_METADATA } from "@/lib/seo";
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

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { color: "#e9ebef", media: "(prefers-color-scheme: light)" },
    { color: "#08090a", media: "(prefers-color-scheme: dark)" },
  ],
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html className={cn(geistSans.variable, geistMono.variable)} lang="en-GH">
    <body className="min-h-svh">{children}</body>
  </html>
);

export default RootLayout;
