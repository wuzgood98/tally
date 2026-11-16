import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * An optimistic check only: no session cookie means straight to sign-in,
 * without rendering anything. Every page and action still checks the
 * session for real (lib/session.ts). The sales API (`/api/v1`) is for POS
 * tills, which authenticate with a till key instead of a session. Ask
 * Tally (`/api/ask`) and the bell's poll (`/api/notifications`) check the
 * session themselves and answer a signed-out request with a 401, not a
 * sign-in page.
 */
export const proxy = (request: NextRequest) => {
  if (getSessionCookie(request) !== null) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;

  if (pathname !== "/") {
    login.searchParams.set("next", `${pathname}${search}`);
  }

  return NextResponse.redirect(login);
};

export const config = {
  matcher: [
    // Public: sign-in, Terms and Privacy, auth and till APIs, Ask Tally's and the bell's APIs (which
    // answer 401 themselves), and the files browsers and crawlers fetch without a
    // session (icons, manifest, robots, sitemap, the social card and
    // security.txt).
    "/((?!login|terms|privacy|api/auth|api/v1|api/ask|api/notifications|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icons/|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|\\.well-known/).*)",
  ],
};
