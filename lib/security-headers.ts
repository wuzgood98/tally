/**
 * HTTP security headers. Used by next.config.ts to send them, and by the
 * /security page to list them, so the page always matches what is sent.
 *
 * Plain module with no "@/" imports: next.config.ts loads it directly.
 */

export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
  /** Plain-English reason, shown on the /security page. */
  readonly why: string;
}

interface HeaderOptions {
  /** React needs `eval` in development for debugging; never in production. */
  readonly isDev: boolean;
  /** HSTS and upgrade-insecure-requests only make sense over HTTPS. */
  readonly isHttps: boolean;
}

const TWO_YEARS_IN_SECONDS = 63_072_000;

/**
 * A CSP without nonces, as the Next.js CSP guide recommends for sites that
 * should stay statically rendered. `'unsafe-inline'` scripts are needed for
 * Next.js's inline bootstrapping and the theme script; everything must still
 * come from this origin, and nothing third-party is allowed.
 */
const contentSecurityPolicy = ({ isDev, isHttps }: HeaderOptions): string =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

export const securityHeaders = (options: HeaderOptions): SecurityHeader[] => [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy(options),
    why: "Only scripts, styles, images and fonts from this site can load, and no other site can frame it.",
  },
  ...(options.isHttps
    ? [
        {
          key: "Strict-Transport-Security",
          value: `max-age=${TWO_YEARS_IN_SECONDS}; includeSubDomains`,
          why: "Browsers that have visited once will only ever connect over HTTPS.",
        },
      ]
    : []),
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
    why: "Stops browsers guessing file types, which blocks a class of script-injection tricks.",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
    why: "Other sites you click through to see only our domain, never the page you were on.",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
    why: "Older browsers also refuse to show the site inside another page (clickjacking).",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    why: "The site can't ask for your camera, microphone, location or payment APIs, and opts out of ad-topic tracking.",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
    why: "Pages from other sites can't keep a handle on this window after opening it.",
  },
];
