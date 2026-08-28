/**
 * FlightResist AI 2.0 — Session Identity
 *
 * Cookie-based session scoping for multiple concurrent users. The session ID
 * is an ISOLATION primitive, NOT authentication: each browser gets an opaque
 * `fr-session` cookie (issued by src/middleware.ts) and all live state —
 * in-memory session, SSE bus traffic, DB snapshot, agent trace, and execution
 * ledger — is keyed by it.
 *
 * Cookie-less clients (curl, the smoke tests, the MCP JSON-RPC caller) all
 * share DEFAULT_SESSION_ID, preserving the pre-multi-user single-session
 * behavior exactly.
 *
 * Ambient context: API routes resolve the session ID once per request and
 * establish it via withSessionContext(); every downstream call (pipeline,
 * store, providers, event emissions) then resolves to the right session
 * without threading the ID through dozens of function signatures.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import {
  DEFAULT_SESSION_ID,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from './session-constants';

export { DEFAULT_SESSION_ID, SESSION_COOKIE_NAME };

/** Session IDs are opaque tokens — reject anything that could corrupt map/DB keys. */
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;

function isSafeSessionId(value: string | undefined | null): value is string {
  return typeof value === 'string' && SAFE_SESSION_ID.test(value);
}

// ---------------------------------------------------------------------------
// AsyncLocalStorage — ambient per-request session context
// ---------------------------------------------------------------------------

const globalForSession = globalThis as unknown as {
  __flightresistSessionAls?: AsyncLocalStorage<string>;
};

function getAls(): AsyncLocalStorage<string> {
  if (!globalForSession.__flightresistSessionAls) {
    globalForSession.__flightresistSessionAls = new AsyncLocalStorage<string>();
  }
  return globalForSession.__flightresistSessionAls;
}

/**
 * Run `fn` with `sessionId` as the ambient session context. The context
 * propagates through the entire async call chain (awaits, timers,
 * fire-and-forget promises, provider callbacks), so nested store/bus calls
 * resolve to this session automatically.
 */
export function withSessionContext<T>(sessionId: string, fn: () => T): T {
  return getAls().run(sessionId, fn);
}

/** The ambient session ID for the current async execution, if one is active. */
export function ambientSessionId(): string | undefined {
  return getAls().getStore();
}

// ---------------------------------------------------------------------------
// Cookie extraction
// ---------------------------------------------------------------------------

/**
 * Synchronous extraction from a NextRequest (route handlers).
 * Falls back to the shared default session for cookie-less clients (curl,
 * smoke tests, MCP JSON-RPC) so stateless multi-request flows keep working.
 */
export function getSessionIdFromRequest(req?: NextRequest): string {
  const cookie = req?.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (isSafeSessionId(cookie)) return cookie;
  return DEFAULT_SESSION_ID;
}

/**
 * Cookie-first resolution with a next/headers fallback (covers Server
 * Components and plain Request-typed handlers). Falls back to the shared
 * default session — never invents a fresh ID here, because a cookie-less
 * HTTP client would then get a different session on every request and lose
 * all state between calls (middleware is the only place that mints IDs).
 */
export async function getSessionId(req?: NextRequest): Promise<string> {
  const fromReq = getSessionIdFromRequest(req);
  if (fromReq !== DEFAULT_SESSION_ID) return fromReq;
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (isSafeSessionId(cookie)) return cookie;
  } catch {
    // Called outside a request scope (scripts/tests) — default session.
  }
  return DEFAULT_SESSION_ID;
}

/** Stamp a session cookie onto an outgoing Response (manual Set-Cookie append). */
export function setSessionCookie(response: Response, sessionId: string): void {
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
  );
}
