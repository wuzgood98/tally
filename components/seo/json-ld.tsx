import type { JsonObject } from "@/lib/structured-data";

const LESS_THAN = /</gu;

interface JsonLdProps {
  /** A schema.org object built from our own data. */
  readonly data: JsonObject;
}

/** Structured data for search engines. */
export const JsonLd = ({ data }: JsonLdProps) => (
  <script
    // Escaping "<" stops any value from closing the script tag early, as the
    // Next.js JSON-LD guide recommends. The payload is always our own data.
    // oxlint-disable-next-line react/no-danger
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(data).replaceAll(LESS_THAN, "\\u003c"),
    }}
    type="application/ld+json"
  />
);
