import type { PublicPath } from "@/lib/seo";

/**
 * The Terms and Privacy pages (`/terms`, `/privacy`). Their text is a
 * starting point written for whoever deploys Tally, not legal advice: a
 * company should have it reviewed before relying on it (see the README).
 */

/** Where privacy requests go. A company deploying Tally sets its own. */
export const PRIVACY_EMAIL = "privacy@g14o.dev";

/** Where the sign-in page's Feedback link sends mail. */
export const FEEDBACK_EMAIL = "feedback@g14o.dev";

/** Change these whenever the page's text changes. */
export const TERMS_UPDATED = "2026-11-15";
export const PRIVACY_UPDATED = "2026-11-18";

export const TERMS_PATH = "/terms" satisfies PublicPath;
export const PRIVACY_PATH = "/privacy" satisfies PublicPath;
