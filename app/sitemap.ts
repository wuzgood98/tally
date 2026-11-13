import type { MetadataRoute } from "next";

import { absoluteUrl, PUBLIC_PATH } from "@/lib/seo";

/** Only the sign-in page is public; every other page needs an account. */
const sitemap = (): MetadataRoute.Sitemap => [
  {
    changeFrequency: "monthly",
    // Generated at build time, so this is when the page last changed.
    lastModified: new Date(),
    priority: 1,
    url: absoluteUrl(PUBLIC_PATH),
  },
];

export default sitemap;
