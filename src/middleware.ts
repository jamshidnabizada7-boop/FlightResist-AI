/**
 * FlightResist AI — session cookie issuance (multi-user isolation) + auth guard.
 *
 * Every inbound request without a `fr-session` cookie gets a fresh opaque
 * session ID set on the RESPONSE only. Browsers adopt the cookie from the
 * first response and are isolated from their next request onward (the app is
 * a single-page client: the '/' page load sets the cookie before any API call
 * fires).
 *
 * The cookie is deliberately NOT injected into the current request: stateless
 * cookie-less clients (curl, the smoke tests, the MCP JSON-RPC endpoint) never
 * send cookies back, so injecting a per-request minted ID would give them a
 * BRAND-NEW session on every call and lose all state between requests.
 * Without injection they resolve to the shared default session — exactly the
 * legacy single-session behavior.
 *
 * Note: the session ID is an isolation primitive, NOT authentication.
 *
 * Authentication guard: protected UI paths require a valid next-auth session
 * token cookie. Public paths (login, register, verify-email) and API routes
 * (/api/*) are exempt from HTML login redirects so API clients, test suites,
 * and MCP tools can interact directly with JSON endpoints.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from '@/lib/flightresist/session-constants';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/verify-email',
];

const PUBLIC_PATH_PATTERNS = [
  /^\/api(?:\/|$)/,
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function hasSessionToken(request: NextRequest): boolean {
  return !!(
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- fr-session cookie minting (applies to all matched routes) ---
  const existing = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let response: NextResponse;

  if (existing && existing.length > 0) {
    response = NextResponse.next();
  } else {
    const sessionId = crypto.randomUUID();
    response = NextResponse.next();
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
    });
  }

  // --- Auth guard: redirect unauthenticated users to /login for protected paths ---
  if (!isPublicPath(pathname) && !hasSessionToken(request)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.svg|logo\\.svg|robots\\.txt).*)'],
};
