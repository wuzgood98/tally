import type { MetadataRoute } from "next";

import { absoluteUrl, PUBLIC_PATH, PUBLIC_PATHS } from "@/lib/seo";

/** Only the sign-in, Terms and Privacy pages are public. */
const sitemap = (): MetadataRoute.Sitemap =>
  PUBLIC_PATHS.map((path) => ({
    changeFrequency: "monthly",
    // Generated at build time, so this is when the page last changed.
    lastModified: new Date(),
    priority: path === PUBLIC_PATH ? 1 : 0.3,
    url: absoluteUrl(path),
  }));

export default sitemap;
