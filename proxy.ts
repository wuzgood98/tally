import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * An optimistic check only: no session cookie means straight to sign-in,
 * without rendering anything. Every page and action still checks the
 * session for real (lib/session.ts). The sales API (`/api/v1`) is for POS
 * tills, which authenticate with a till key instead of a session.
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
    "/((?!login|api/auth|api/v1|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt).*)",
  ],
};
