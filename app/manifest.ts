import type { MetadataRoute } from "next";

import { BRAND_COLORS } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

/** Installable on a till or a storeroom tablet, opening straight to work. */
const manifest = (): MetadataRoute.Manifest => ({
  // The splash stays dark; the title bar matches the default light theme.
  background_color: BRAND_COLORS.night,
  categories: ["business", "productivity"],
  description: SITE_DESCRIPTION,
  display: "standalone",
  icons: [
    {
      purpose: "any",
      sizes: "192x192",
      src: "/icons/icon-192.png",
      type: "image/png",
    },
    {
      purpose: "any",
      sizes: "512x512",
      src: "/icons/icon-512.png",
      type: "image/png",
    },
    {
      purpose: "maskable",
      sizes: "512x512",
      src: "/icons/maskable-512.png",
      type: "image/png",
    },
  ],
  id: "/",
  lang: "en-GH",
  name: SITE_NAME,
  short_name: SITE_NAME,
  shortcuts: [
    { name: "Till", short_name: "Till", url: "/till" },
    { name: "Low stock", short_name: "Low stock", url: "/low-stock" },
    { name: "Receive goods", short_name: "Receive", url: "/receipts/new" },
  ],
  start_url: "/",
  theme_color: BRAND_COLORS.day,
});

export default manifest;
