import type { Metadata } from "next";

const LOCAL_URL = "http://localhost:3000";

export const SITE_NAME = "Tally";
export const SITE_TAGLINE = "Stock control for multi-branch retailers";

export const SITE_DESCRIPTION =
  "Stock control for a retailer with several stores and a warehouse: receiving, transfers, counts, low-stock alerts, point-of-sale sales and reports, all on one movement ledger.";

/** Placeholder on a reserved domain: replace before relying on it. */
export const SECURITY_EMAIL = "security@tally.example";

type Env = Readonly<Record<string, string | undefined>>;

const asUrl = (value: string | undefined): URL | null =>
  value !== undefined && URL.canParse(value) ? new URL(value) : null;

/**
 * The canonical origin: `NEXT_PUBLIC_SITE_URL`, else `BETTER_AUTH_URL` (the
 * public URL sign-in already needs), else Vercel's production domain, else
 * localhost. A malformed value falls through rather than crashing every page.
 */
export const resolveSiteUrl = (env: Env): URL => {
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL;

  return (
    asUrl(env.NEXT_PUBLIC_SITE_URL) ??
    asUrl(env.BETTER_AUTH_URL) ??
    asUrl(
      vercel === undefined || vercel === "" ? undefined : `https://${vercel}`
    ) ??
    new URL(LOCAL_URL)
  );
};

export const SITE_URL = resolveSiteUrl(process.env);

export const absoluteUrl = (path: string): string =>
  new URL(path, SITE_URL).toString();

/**
 * The one page search engines may index: everything else is behind the
 * sign-in, and a staff tool's screens have no business in search results.
 */
export const PUBLIC_PATH = "/login";

const SHARED_OPEN_GRAPH = { locale: "en_GH", siteName: SITE_NAME } as const;

/** Site-wide defaults for the root layout: shareable, but not indexable. */
export const ROOT_METADATA: Metadata = {
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
  metadataBase: SITE_URL,
  openGraph: {
    ...SHARED_OPEN_GRAPH,
    description: SITE_DESCRIPTION,
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    type: "website",
    url: PUBLIC_PATH,
  },
  robots: { follow: false, index: false },
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  twitter: { card: "summary_large_image" },
};

/** The sign-in page: indexable, with its own canonical URL. */
export const PUBLIC_PAGE_METADATA: Metadata = {
  alternates: { canonical: PUBLIC_PATH },
  robots: { follow: true, index: true },
};
