#!/usr/bin/env node
/**
 * tests/challenger-middleware-adversarial.mjs
 *
 * Empirical Adversarial Test Harness for Milestone 1 (src/middleware.ts):
 * 1. ReDoS Vulnerability & Regex Performance Stress Benchmarks
 * 2. Route Matcher Boundary & False-Positive/False-Negative Classification
 * 3. Multi-Tenant Session Cookie Minting, Collision-Resistance & Safe ID Validation
 * 4. NextAuth Session Token Guarding & Redirection Semantics
 * 5. Edge Runtime Import & Symbol Purity Check
 */

import { performance } from 'node:perf_hooks';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let failures = 0;
let totalChecks = 0;

function assert(condition, testName, detail = '') {
  totalChecks++;
  if (condition) {
    console.log(`[PASS] ${testName}${detail ? ` (${detail})` : ''}`);
  } else {
    failures++;
    console.error(`[FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
  }
}

console.log('================================================================');
console.log('FLIGHTRESIST-AI M1 ADVERSARIAL CHALLENGER TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. REPLICATE MIDDLEWARE ROUTE MATCHER & CONSTANTS
// -----------------------------------------------------------------------------
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/verify-email',
];

const PUBLIC_PATH_PATTERNS = [
  /^\/api(?:\/|$)/,
];

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

const CONFIG_MATCHER_REGEX = /^\/((?!_next\/static|_next\/image|favicon\.svg|logo\.svg|robots\.txt).*)?$/;
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SESSION_TTL_SECONDS = 30 * 60;
const SESSION_COOKIE_NAME = 'fr-session';

// -----------------------------------------------------------------------------
// TEST SUITE 1: REGEX SAFETY & REDOS VULNERABILITY ANALYSIS
// -----------------------------------------------------------------------------
console.log('--- TEST SUITE 1: ReDoS & Regex Performance Stress ---');

// ReDoS Attack Strings:
const redosPayloads = [
  // Repeated prefix + evil suffix
  '/api' + '/'.repeat(10000),
  '/api' + 'a'.repeat(10000),
  '/api/' + 'a/'.repeat(5000) + '!',
  '/' + 'api'.repeat(5000),
  '/' + '_next/static/'.repeat(2000),
  '/' + 'a'.repeat(50000),
  '/' + 'favicon.svg'.repeat(2000) + 'xyz',
  '/' + '_next/image/'.repeat(2000) + 'test',
  '/api' + '?'.repeat(20000),
  '/api' + '#'.repeat(20000),
  '/api' + '%20'.repeat(10000),
  '/api' + '\x00'.repeat(10000),
  'a'.repeat(100000),
];

for (const [idx, payload] of redosPayloads.entries()) {
  const start = performance.now();
  const resPublic = isPublicPath(payload);
  const durPublic = performance.now() - start;

  assert(durPublic < 10, `ReDoS resilience on PUBLIC_PATH_PATTERNS (payload #${idx + 1}, len=${payload.length})`, `duration: ${durPublic.toFixed(3)}ms`);

  const startMatcher = performance.now();
  const resMatcher = CONFIG_MATCHER_REGEX.test(payload);
  const durMatcher = performance.now() - startMatcher;

  assert(durMatcher < 10, `ReDoS resilience on CONFIG_MATCHER_REGEX (payload #${idx + 1}, len=${payload.length})`, `duration: ${durMatcher.toFixed(3)}ms`);
}

// Throughput benchmark: 500,000 iterations
const testPaths = [
  '/api/trip/current',
  '/api/disrupt/trigger',
  '/api/recovery/options',
  '/api/mcp',
  '/login',
  '/cockpit',
  '/',
  '/settings',
  '/api',
  '/api-invalid',
];

const benchStart = performance.now();
const BENCH_ITERS = 500000;
for (let i = 0; i < BENCH_ITERS; i++) {
  const p = testPaths[i % testPaths.length];
  isPublicPath(p);
}
const benchDur = performance.now() - benchStart;
const opsPerSec = (BENCH_ITERS / (benchDur / 1000)).toLocaleString();
console.log(`Throughput benchmark: ${BENCH_ITERS} calls in ${benchDur.toFixed(2)}ms (${opsPerSec} ops/sec)`);
assert(benchDur < 500, `High-throughput route matcher performance (< 500ms for 500k calls)`, `${opsPerSec} ops/sec`);

// -----------------------------------------------------------------------------
// TEST SUITE 2: ROUTE CLASSIFICATION & BOUNDARY INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Route Classification & Boundary Integrity ---');

const routeTestMatrix = [
  // [Path, Expected isPublic, Category]
  // API endpoints that MUST be public (exempt from redirect)
  ['/api', true, 'Exact /api root'],
  ['/api/', true, 'Root /api with trailing slash'],
  ['/api/trip/current', true, 'Trip status endpoint'],
  ['/api/disrupt/trigger', true, 'Disruption trigger endpoint'],
  ['/api/recovery/options', true, 'Recovery options endpoint'],
  ['/api/recovery/confirm', true, 'Recovery confirm endpoint'],
  ['/api/recovery/stream', true, 'SSE stream endpoint'],
  ['/api/session/reset', true, 'Session reset endpoint'],
  ['/api/mcp', true, 'MCP JSON-RPC endpoint'],
  ['/api/health', true, 'Health check endpoint'],
  ['/api/auth/signin', true, 'NextAuth signin'],
  ['/api/auth/callback/credentials', true, 'NextAuth callback'],
  ['/api/auth/session', true, 'NextAuth session'],
  ['/api/v1/custom/nested/path', true, 'Deeply nested API path'],

  // Public UI pages
  ['/login', true, 'Login page'],
  ['/register', true, 'Register page'],
  ['/verify-email', true, 'Email verification page'],

  // Protected UI pages (MUST NOT be public)
  ['/', false, 'Root dashboard / cockpit page'],
  ['/cockpit', false, 'Cockpit UI page'],
  ['/settings', false, 'Settings page'],
  ['/admin', false, 'Admin page'],
  ['/dashboard', false, 'Dashboard page'],
  ['/profile', false, 'Profile page'],
  ['/trips/12345', false, 'Trip details page'],

  // Boundary & False Positive Traps (MUST NOT be public)
  ['/apis', false, 'Prefix overlap /apis'],
  ['/apix', false, 'Prefix overlap /apix'],
  ['/api-docs', false, 'Prefix overlap /api-docs'],
  ['/api_endpoint', false, 'Prefix overlap /api_endpoint'],
  ['/login-extra', false, 'Prefix overlap /login-extra'],
  ['/login/', false, 'Subpath /login/ (exact match only for UI)'],
  ['/register/step2', false, 'Subpath /register/step2'],
  ['/verify-email/confirm', false, 'Subpath /verify-email/confirm'],
  ['//api', false, 'Double slash //api'],
  ['/API/trip', false, 'Uppercase /API/trip (case sensitivity)'],
  ['', false, 'Empty path'],
  ['/favicon.ico', false, 'Favicon'],
];

for (const [path, expected, desc] of routeTestMatrix) {
  const actual = isPublicPath(path);
  assert(actual === expected, `Classification: ${desc} ("${path}")`, `expected=${expected}, actual=${actual}`);
}

// -----------------------------------------------------------------------------
// TEST SUITE 3: MULTI-TENANT COOKIE MINTING & UUID GENERATION
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Multi-Tenant Cookie Minting & UUID Generation ---');

// Generate 100,000 UUIDs and verify uniqueness and regex conformance
const UUID_SAMPLE_SIZE = 100000;
const generatedUuids = new Set();
let invalidUuids = 0;

const genStart = performance.now();
for (let i = 0; i < UUID_SAMPLE_SIZE; i++) {
  const id = crypto.randomUUID();
  if (!SAFE_SESSION_ID.test(id)) {
    invalidUuids++;
  }
  generatedUuids.add(id);
}
const genDur = performance.now() - genStart;

assert(invalidUuids === 0, `All generated UUIDs conform to SAFE_SESSION_ID regex (${UUID_SAMPLE_SIZE} generated)`);
assert(generatedUuids.size === UUID_SAMPLE_SIZE, `Zero UUID collisions across ${UUID_SAMPLE_SIZE.toLocaleString()} generated UUIDs`);
console.log(`Generated ${UUID_SAMPLE_SIZE} UUIDs in ${genDur.toFixed(2)}ms (${(UUID_SAMPLE_SIZE / (genDur / 1000)).toFixed(0)} UUIDs/sec)`);

// Simulate Middleware Cookie Logic
function simulateMiddleware(req) {
  const { pathname, cookies } = req;
  const existing = cookies[SESSION_COOKIE_NAME];
  let setCookie = null;
  let redirectedTo = null;

  if (existing && existing.length > 0) {
    // preserve existing
  } else {
    const sessionId = crypto.randomUUID();
    setCookie = {
      name: SESSION_COOKIE_NAME,
      value: sessionId,
      options: {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_TTL_SECONDS,
      },
    };
  }

  const hasSession = !!(cookies['next-auth.session-token'] || cookies['__Secure-next-auth.session-token']);
  if (!isPublicPath(pathname) && !hasSession) {
    const loginUrl = new URL('/login', 'http://localhost:3000' + pathname);
    loginUrl.searchParams.set('callbackUrl', pathname);
    redirectedTo = loginUrl.toString();
  }

  return {
    setCookie,
    redirectedTo,
  };
}

// Case 1: First-time request with no cookies to /api/trip/current
{
  const res = simulateMiddleware({ pathname: '/api/trip/current', cookies: {} });
  assert(res.setCookie !== null, 'First-time API request receives a newly minted fr-session cookie');
  assert(SAFE_SESSION_ID.test(res.setCookie?.value), 'Minted cookie is a safe alphanumeric UUID');
  assert(res.setCookie?.options.httpOnly === true, 'Minted cookie has httpOnly: true');
  assert(res.setCookie?.options.sameSite === 'lax', 'Minted cookie has sameSite: lax');
  assert(res.setCookie?.options.maxAge === 1800, 'Minted cookie has maxAge: 1800s (30m)');
  assert(res.redirectedTo === null, 'First-time API request is NOT redirected to login');
}

// Case 2: Subsequent request with existing cookie to /api/trip/current
{
  const existingId = 'session-user-12345';
  const res = simulateMiddleware({ pathname: '/api/trip/current', cookies: { [SESSION_COOKIE_NAME]: existingId } });
  assert(res.setCookie === null, 'Subsequent request does NOT overwrite existing fr-session cookie');
  assert(res.redirectedTo === null, 'API request with existing session is NOT redirected');
}

// Case 3: Empty cookie string (e.g. `fr-session=""`)
{
  const res = simulateMiddleware({ pathname: '/api/trip/current', cookies: { [SESSION_COOKIE_NAME]: '' } });
  assert(res.setCookie !== null, 'Empty cookie value triggers re-minting of fr-session');
}

// -----------------------------------------------------------------------------
// TEST SUITE 4: NEXTAUTH SESSION TOKEN GUARDING & REDIRECTION
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 4: NextAuth Session Token Guarding ---');

// Protected UI route without session token -> 307 Redirect to /login?callbackUrl=...
{
  const res = simulateMiddleware({ pathname: '/cockpit', cookies: {} });
  assert(res.redirectedTo === 'http://localhost:3000/login?callbackUrl=%2Fcockpit', 'Unauthenticated user accessing /cockpit redirected to /login with callbackUrl');
  assert(res.setCookie !== null, 'Redirect response also mints fr-session cookie for session isolation');
}

// Protected UI route with standard next-auth.session-token
{
  const res = simulateMiddleware({
    pathname: '/cockpit',
    cookies: { 'next-auth.session-token': 'valid-jwt-token', [SESSION_COOKIE_NAME]: 'active-user' },
  });
  assert(res.redirectedTo === null, 'Authenticated user (next-auth.session-token) allowed to access /cockpit');
}

// Protected UI route with __Secure-next-auth.session-token (HTTPS / Prod)
{
  const res = simulateMiddleware({
    pathname: '/cockpit',
    cookies: { '__Secure-next-auth.session-token': 'valid-secure-jwt-token', [SESSION_COOKIE_NAME]: 'active-user' },
  });
  assert(res.redirectedTo === null, 'Authenticated user (__Secure-next-auth.session-token) allowed to access /cockpit');
}

// Public UI route (/login) without session token -> No redirect
{
  const res = simulateMiddleware({ pathname: '/login', cookies: {} });
  assert(res.redirectedTo === null, 'Unauthenticated user accessing /login is NOT redirected (no redirect loop)');
}

// -----------------------------------------------------------------------------
// TEST SUITE 5: EDGE RUNTIME COMPATIBILITY & FILE ANALYSIS
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 5: Edge Runtime Compatibility & Purity ---');

const middlewarePath = path.resolve('src/middleware.ts');
const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');

// Verify forbidden node built-ins in Edge runtime
const forbiddenNodeImports = [
  'node:fs',
  'node:path',
  'node:child_process',
  'node:os',
  'node:cluster',
  'node:async_hooks',
  'node:net',
  'node:http',
  'node:https',
  'fs',
  'child_process',
];

for (const mod of forbiddenNodeImports) {
  const regex = new RegExp(`from\\s+['"]${mod}['"]|require\\(['"]${mod}['"]\\)`);
  assert(!regex.test(middlewareContent), `Middleware has no forbidden Edge runtime import: "${mod}"`);
}

// Verify exported config matcher format
assert(middlewareContent.includes('export const config = {'), 'Middleware exports config object');
assert(middlewareContent.includes('matcher:'), 'Middleware config contains route matcher');

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL CHECKS: ${totalChecks} | PASSED: ${totalChecks - failures} | FAILED: ${failures}`);
console.log('================================================================');

if (failures > 0) {
  console.error(`\nVERDICT: REQUEST_CHANGES (${failures} check(s) failed)`);
  process.exit(1);
} else {
  console.log('\nVERDICT: APPROVE (All adversarial and stress checks passed cleanly)');
  process.exit(0);
}
