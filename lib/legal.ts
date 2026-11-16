import type { PublicPath } from "@/lib/seo";

/**
 * The Terms and Privacy pages (`/terms`, `/privacy`). Their text is a
 * starting point written for whoever deploys Tally, not legal advice: a
 * company should have it reviewed before relying on it (see the README).
 */

/** Placeholder on a reserved domain: replace before relying on it. */
export const PRIVACY_EMAIL = "privacy@tally.example";

/** Change these whenever the page's text changes. */
export const TERMS_UPDATED = "2026-11-15";
export const PRIVACY_UPDATED = "2026-11-16";

export const TERMS_PATH = "/terms" satisfies PublicPath;
export const PRIVACY_PATH = "/privacy" satisfies PublicPath;
