import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

/**
 * schema.org description of Tally for search engines. Plain JSON values only,
 * so it serialises exactly.
 */

/** Anything JSON.stringify can represent faithfully. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/** The app itself, on the one public page. */
export const appJsonLd = (): JsonObject => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  applicationCategory: "BusinessApplication",
  browserRequirements: "Requires JavaScript",
  description: SITE_DESCRIPTION,
  image: absoluteUrl("/opengraph-image"),
  inLanguage: "en-GH",
  name: SITE_NAME,
  operatingSystem: "Any",
  url: absoluteUrl("/login"),
});
