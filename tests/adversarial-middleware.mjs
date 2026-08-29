#!/usr/bin/env node
/**
 * tests/adversarial-middleware.mjs
 * Comprehensive empirical challenger test suite for src/middleware.ts.
 *
 * Tests:
 *  - Category 1: API Route Matching (/api, /api/, /api/foo/bar, query params)
 *  - Category 2: Sibling prefix resistance (/api-doc, /apiv2, /apis, /api.json)
 *  - Category 3: Public UI paths (/login, /register, /verify-email)
 *  - Category 4: Protected UI paths (/, /cockpit, /admin, etc.)
 *  - Category 5: NextAuth session tokens (standard, secure, empty, absent)
 *  - Category 6: Session isolation cookie minting (fr-session issuance & preservation)
 *  - Category 7: Next.js matcher regex verification
 *  - Category 8: Live HTTP probe against running server (if reachable)
 */

import http from 'http';
import https from 'https';

const BASE_URL = process.argv[2] ?? 'http://localhost:3001';

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function assert(description, condition, details = '') {
  if (condition) {
    results.passed++;
    results.tests.push({ status: 'PASS', description, details });
    console.log(`PASS: ${description}${details ? ` (${details})` : ''}`);
  } else {
    results.failed++;
    results.tests.push({ status: 'FAIL', description, details });
    console.error(`FAIL: ${description}${details ? ` (${details})` : ''}`);
  }
}

// -------------------------------------------------------------
// Pure logic recreation matching src/middleware.ts exactly
// -------------------------------------------------------------
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

function hasSessionToken(cookieHeader) {
  if (!cookieHeader) return false;
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const parts = c.trim().split('=');
      return [parts[0], parts.slice(1).join('=')];
    })
  );
  return !!(
    (cookies['next-auth.session-token'] && cookies['next-auth.session-token'].length > 0) ||
    (cookies['__Secure-next-auth.session-token'] && cookies['__Secure-next-auth.session-token'].length > 0)
  );
}

function simulateMiddleware(pathname, cookieHeader = '') {
  const isPublic = isPublicPath(pathname);
  const authed = hasSessionToken(cookieHeader);
  const existingFrSession = cookieHeader.includes('fr-session=');

  let willRedirect = false;
  let redirectUrl = null;

  if (!isPublic && !authed) {
    willRedirect = true;
    redirectUrl = `/login?callbackUrl=${encodeURIComponent(pathname)}`;
  }

  return {
    isPublic,
    authed,
    willRedirect,
    redirectUrl,
    mintsFrSession: !existingFrSession
  };
}

console.log('=== RUNNING ADVERSARIAL ROUTE MATCHING TESTS ===\n');

// 1. API Route Matching
console.log('--- Category 1: API Route Matching ---');
assert('Exact /api matches public API', isPublicPath('/api') === true, '/api');
assert('Exact /api/ matches public API', isPublicPath('/api/') === true, '/api/');
assert('/api/trip/current matches public API', isPublicPath('/api/trip/current') === true);
assert('/api/disrupt/trigger matches public API', isPublicPath('/api/disrupt/trigger') === true);
assert('/api/recovery/confirm matches public API', isPublicPath('/api/recovery/confirm') === true);
assert('/api/recovery/options matches public API', isPublicPath('/api/recovery/options') === true);
assert('/api/recovery/stream matches public API', isPublicPath('/api/recovery/stream') === true);
assert('/api/mcp matches public API', isPublicPath('/api/mcp') === true);
assert('/api/health matches public API', isPublicPath('/api/health') === true);
assert('/api/auth/signin matches public API', isPublicPath('/api/auth/signin') === true);
assert('/api/auth/callback/credentials matches public API', isPublicPath('/api/auth/callback/credentials') === true);
assert('/api/session/reset matches public API', isPublicPath('/api/session/reset') === true);
assert('/api/deeply/nested/path/to/resource matches public API', isPublicPath('/api/deeply/nested/path/to/resource') === true);

// 2. Boundary / Sibling Prefix Resistance
console.log('\n--- Category 2: Boundary & Sibling Prefix Resistance ---');
assert('/api-doc is NOT public API', isPublicPath('/api-doc') === false);
assert('/api-docs is NOT public API', isPublicPath('/api-docs') === false);
assert('/api_v1 is NOT public API', isPublicPath('/api_v1') === false);
assert('/apiv2 is NOT public API', isPublicPath('/apiv2') === false);
assert('/api.json is NOT public API', isPublicPath('/api.json') === false);
assert('/apigateway is NOT public API', isPublicPath('/apigateway') === false);
assert('/apis is NOT public API', isPublicPath('/apis') === false);
assert('/apiary is NOT public API', isPublicPath('/apiary') === false);

// 3. Public UI Paths
console.log('\n--- Category 3: Public UI Paths ---');
assert('/login is public path', isPublicPath('/login') === true);
assert('/register is public path', isPublicPath('/register') === true);
assert('/verify-email is public path', isPublicPath('/verify-email') === true);

// 4. Protected UI Paths
console.log('\n--- Category 4: Protected UI Paths ---');
assert('/ (root) is protected', isPublicPath('/') === false);
assert('/cockpit is protected', isPublicPath('/cockpit') === false);
assert('/dashboard is protected', isPublicPath('/dashboard') === false);
assert('/settings is protected', isPublicPath('/settings') === false);
assert('/admin is protected', isPublicPath('/admin') === false);
assert('/profile is protected', isPublicPath('/profile') === false);
assert('/history is protected', isPublicPath('/history') === false);

// 5. Auth Guard Simulation
console.log('\n--- Category 5: NextAuth Guard Simulation ---');
const unauthedRoot = simulateMiddleware('/');
assert('Unauthenticated / triggers redirect', unauthedRoot.willRedirect === true && unauthedRoot.redirectUrl === '/login?callbackUrl=%2F');

const authedRoot = simulateMiddleware('/', 'next-auth.session-token=valid-jwt-token');
assert('Authenticated (next-auth.session-token) / allows access', authedRoot.willRedirect === false);

const secureAuthedRoot = simulateMiddleware('/', '__Secure-next-auth.session-token=valid-jwt-token');
assert('Authenticated (__Secure-next-auth.session-token) / allows access', secureAuthedRoot.willRedirect === false);

const emptyTokenRoot = simulateMiddleware('/', 'next-auth.session-token=');
assert('Empty session token does NOT grant access', emptyTokenRoot.willRedirect === true);

const unauthedCockpit = simulateMiddleware('/cockpit');
assert('Unauthenticated /cockpit redirects to /login?callbackUrl=%2Fcockpit', unauthedCockpit.willRedirect === true && unauthedCockpit.redirectUrl === '/login?callbackUrl=%2Fcockpit');

const authedCockpit = simulateMiddleware('/cockpit', 'next-auth.session-token=valid');
assert('Authenticated /cockpit allows access', authedCockpit.willRedirect === false);

const unauthedApi = simulateMiddleware('/api/trip/current');
assert('Unauthenticated /api/trip/current allows access without redirect', unauthedApi.willRedirect === false);

const unauthedMcp = simulateMiddleware('/api/mcp');
assert('Unauthenticated /api/mcp allows access without redirect', unauthedMcp.willRedirect === false);

// 6. Next.js Config Matcher Regex Verification
console.log('\n--- Category 6: Next.js Matcher Regex Verification ---');
const matcherPattern = new RegExp('^/((?!_next/static|_next/image|favicon\\.svg|logo\\.svg|robots\\.txt).*)');

assert('Matcher matches /', matcherPattern.test('/'));
assert('Matcher matches /login', matcherPattern.test('/login'));
assert('Matcher matches /cockpit', matcherPattern.test('/cockpit'));
assert('Matcher matches /api/trip/current', matcherPattern.test('/api/trip/current'));
assert('Matcher matches /api/mcp', matcherPattern.test('/api/mcp'));
assert('Matcher SKIPS /_next/static/chunks/main.js', matcherPattern.test('/_next/static/chunks/main.js') === false);
assert('Matcher SKIPS /_next/image?url=foo', matcherPattern.test('/_next/image?url=foo') === false);
assert('Matcher SKIPS /favicon.svg', matcherPattern.test('/favicon.svg') === false);
assert('Matcher SKIPS /logo.svg', matcherPattern.test('/logo.svg') === false);
assert('Matcher SKIPS /robots.txt', matcherPattern.test('/robots.txt') === false);

// 7. Live HTTP Probes
console.log('\n--- Category 7: Live HTTP Probes against ' + BASE_URL + ' ---');

async function runHttpProbes() {
  const httpTests = [
    {
      name: 'GET /api/health (unauthenticated)',
      path: '/api/health',
      headers: {},
      expectedStatus: [200],
      checkRedirect: false,
    },
    {
      name: 'GET /api/trip/current (unauthenticated)',
      path: '/api/trip/current',
      headers: {},
      expectedStatus: [200],
      checkRedirect: false,
    },
    {
      name: 'POST /api/mcp (unauthenticated)',
      path: '/api/mcp',
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      headers: { 'Content-Type': 'application/json' },
      expectedStatus: [200],
      checkRedirect: false,
    },
    {
      name: 'GET /login (unauthenticated)',
      path: '/login',
      headers: {},
      expectedStatus: [200],
      checkRedirect: false,
    },
    {
      name: 'GET /register (unauthenticated)',
      path: '/register',
      headers: {},
      expectedStatus: [200],
      checkRedirect: false,
    },
    {
      name: 'GET /verify-email (unauthenticated)',
      path: '/verify-email',
      headers: {},
      expectedStatus: [200],
      checkRedirect: false,
    },
    {
      name: 'GET / (unauthenticated) -> Redirects to /login',
      path: '/',
      headers: {},
      expectedStatus: [307, 302],
      checkRedirect: true,
      redirectLocationContains: '/login?callbackUrl=%2F'
    },
    {
      name: 'GET /cockpit (unauthenticated) -> Redirects to /login',
      path: '/cockpit',
      headers: {},
      expectedStatus: [307, 302],
      checkRedirect: true,
      redirectLocationContains: '/login?callbackUrl=%2Fcockpit'
    },
    {
      name: 'GET /api-fake (unauthenticated) -> Redirects to /login',
      path: '/api-fake',
      headers: {},
      expectedStatus: [307, 302],
      checkRedirect: true,
      redirectLocationContains: '/login?callbackUrl=%2Fapi-fake'
    },
    {
      name: 'GET / with mock next-auth.session-token -> Allowed (not redirected to /login)',
      path: '/',
      headers: { cookie: 'next-auth.session-token=test-mock-token' },
      expectedStatus: [200, 404], // allowed past middleware
      checkRedirect: false,
    },
    {
      name: 'Set-Cookie fr-session issued on first request',
      path: '/api/health',
      headers: {},
      checkSetCookie: 'fr-session'
    },
    {
      name: 'Existing fr-session is retained, not re-issued with new value',
      path: '/api/health',
      headers: { cookie: 'fr-session=12345-test-session' },
      checkRetainCookie: true
    }
  ];

  for (const t of httpTests) {
    try {
      const url = `${BASE_URL}${t.path}`;
      const res = await fetch(url, {
        method: t.method || 'GET',
        headers: t.headers || {},
        body: t.body,
        redirect: 'manual' // Do not follow redirects automatically
      });

      if (t.expectedStatus) {
        assert(
          `[HTTP] ${t.name} status in [${t.expectedStatus.join(',')}]`,
          t.expectedStatus.includes(res.status),
          `got ${res.status}`
        );
      }

      if (t.checkRedirect) {
        const location = res.headers.get('location') || '';
        assert(
          `[HTTP] ${t.name} redirect location contains '${t.redirectLocationContains}'`,
          location.includes(t.redirectLocationContains),
          `location: ${location}`
        );
      }

      if (t.checkSetCookie) {
        const setCookie = res.headers.get('set-cookie') || '';
        assert(
          `[HTTP] ${t.name} sets '${t.checkSetCookie}' cookie`,
          setCookie.includes(t.checkSetCookie),
          `set-cookie: ${setCookie}`
        );
      }

      if (t.checkRetainCookie) {
        const setCookie = res.headers.get('set-cookie') || '';
        assert(
          `[HTTP] ${t.name} does NOT re-issue fr-session if already sent`,
          !setCookie.includes('fr-session='),
          `set-cookie: ${setCookie}`
        );
      }
    } catch (err) {
      assert(`[HTTP] ${t.name} executed without error`, false, err.message);
    }
  }

  console.log('\n========================================');
  console.log(`TOTAL PASSED: ${results.passed}`);
  console.log(`TOTAL FAILED: ${results.failed}`);
  console.log('========================================');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runHttpProbes();
