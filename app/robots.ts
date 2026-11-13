import type { MetadataRoute } from "next";

import { absoluteUrl, PUBLIC_PATH, SITE_URL } from "@/lib/seo";

const robots = (): MetadataRoute.Robots => ({
  host: SITE_URL.origin,
  rules: {
    // The sign-in page, and the social card so link previews can fetch it.
    allow: [PUBLIC_PATH, "/opengraph-image"],
    // Everything else is a staff screen behind the sign-in.
    disallow: "/",
    userAgent: "*",
  },
  sitemap: absoluteUrl("/sitemap.xml"),
});

export default robots;
