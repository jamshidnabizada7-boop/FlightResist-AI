#!/usr/bin/env node
/**
 * tests/adversarial-middleware-deep.mjs
 * Deep adversarial stress harness for Next.js middleware and route matching.
 */

const BASE_URL = process.argv[2] ?? 'http://localhost:3001';

const results = { passed: 0, failed: 0 };

function assert(desc, condition, detail = '') {
  if (condition) {
    results.passed++;
    console.log(`PASS: ${desc} ${detail ? `[${detail}]` : ''}`);
  } else {
    results.failed++;
    console.error(`FAIL: ${desc} ${detail ? `[${detail}]` : ''}`);
  }
}

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

// 1. Edge Case Variations on Path Matching
const edgePaths = [
  // API paths that MUST match
  { path: '/api', expected: true, desc: 'Root api' },
  { path: '/api/', expected: true, desc: 'Root api with slash' },
  { path: '/api/v1', expected: true, desc: 'API v1 subpath' },
  { path: '/api/v1/flights/search', expected: true, desc: 'Deep API path' },
  { path: '/api/auth/session', expected: true, desc: 'NextAuth session' },
  { path: '/api/auth/csrf', expected: true, desc: 'NextAuth CSRF' },
  { path: '/api/auth/signin/google', expected: true, desc: 'NextAuth oauth' },
  { path: '/api/mcp/stream', expected: true, desc: 'MCP stream' },
  { path: '/api/something.json', expected: true, desc: 'API route with extension in subpath' },

  // Non-API paths that MUST NOT match (Security boundary check)
  { path: '/api-v2', expected: false, desc: 'api-v2 hyphenated sibling' },
  { path: '/api-documentation', expected: false, desc: 'api-documentation' },
  { path: '/api_internal', expected: false, desc: 'api_internal underscore sibling' },
  { path: '/apis', expected: false, desc: 'apis plural' },
  { path: '/apis/v1', expected: false, desc: 'apis/v1 plural' },
  { path: '/apiv1', expected: false, desc: 'apiv1 alphanumeric' },
  { path: '/api123', expected: false, desc: 'api123 numeric' },
  { path: '/api.spec.ts', expected: false, desc: 'api.spec.ts file sibling' },
  { path: '/api.html', expected: false, desc: 'api.html' },
  { path: '/api.json', expected: false, desc: 'api.json' },

  // UI routes that MUST be protected
  { path: '/', expected: false, desc: 'Root home page' },
  { path: '/cockpit', expected: false, desc: 'Cockpit page' },
  { path: '/cockpit/subpage', expected: false, desc: 'Cockpit subpage' },
  { path: '/admin', expected: false, desc: 'Admin page' },
  { path: '/admin/users', expected: false, desc: 'Admin subpage' },
  { path: '/settings', expected: false, desc: 'Settings page' },
  { path: '/profile', expected: false, desc: 'Profile page' },
  { path: '/dashboard', expected: false, desc: 'Dashboard page' },

  // Public UI routes
  { path: '/login', expected: true, desc: 'Login page' },
  { path: '/register', expected: true, desc: 'Register page' },
  { path: '/verify-email', expected: true, desc: 'Verify email page' },
];

console.log('=== RUNNING DEEP PATH MATCHING MATRIX ===');
for (const tc of edgePaths) {
  const actual = isPublicPath(tc.path);
  assert(`isPublicPath("${tc.path}") == ${tc.expected} (${tc.desc})`, actual === tc.expected, `actual: ${actual}`);
}

// 2. Cookie Extraction & NextAuth Token Variations
console.log('\n=== TESTING NEXTAUTH COOKIE VARIATIONS ===');

function checkHasSessionToken(mockCookies) {
  return !!(
    mockCookies['next-auth.session-token']?.value ||
    mockCookies['__Secure-next-auth.session-token']?.value
  );
}

const cookieTestCases = [
  {
    name: 'No cookies at all',
    cookies: {},
    expected: false
  },
  {
    name: 'Only fr-session cookie',
    cookies: { 'fr-session': { value: '550e8400-e29b-41d4-a716-446655440000' } },
    expected: false
  },
  {
    name: 'next-auth.session-token present and non-empty',
    cookies: { 'next-auth.session-token': { value: 'eyJhbGciOiJIUzI1NiJ9.test' } },
    expected: true
  },
  {
    name: '__Secure-next-auth.session-token present and non-empty',
    cookies: { '__Secure-next-auth.session-token': { value: 'eyJhbGciOiJIUzI1NiJ9.test' } },
    expected: true
  },
  {
    name: 'next-auth.session-token is empty string',
    cookies: { 'next-auth.session-token': { value: '' } },
    expected: false
  },
  {
    name: '__Secure-next-auth.session-token is empty string',
    cookies: { '__Secure-next-auth.session-token': { value: '' } },
    expected: false
  },
  {
    name: 'Both fr-session and next-auth.session-token present',
    cookies: {
      'fr-session': { value: '550e8400-e29b-41d4-a716-446655440000' },
      'next-auth.session-token': { value: 'eyJhbGciOiJIUzI1NiJ9.test' }
    },
    expected: true
  },
  {
    name: 'Both next-auth and __Secure tokens present',
    cookies: {
      'next-auth.session-token': { value: 'token1' },
      '__Secure-next-auth.session-token': { value: 'token2' }
    },
    expected: true
  }
];

for (const tc of cookieTestCases) {
  const actual = checkHasSessionToken(tc.cookies);
  assert(`Cookie case: ${tc.name}`, actual === tc.expected, `got: ${actual}`);
}

// 3. Live Server Stress Testing with various HTTP headers and path variations
console.log('\n=== RUNNING LIVE HTTP HEADER AND QUERY TESTS ===');

async function testLive() {
  const liveCases = [
    {
      desc: 'GET / with query string (?tab=flight) redirects to /login?callbackUrl=%2F',
      url: `${BASE_URL}/?tab=flight`,
      headers: {},
      expectedRedirect: '/login?callbackUrl=%2F'
    },
    {
      desc: 'GET /cockpit with query string redirects to /login?callbackUrl=%2Fcockpit',
      url: `${BASE_URL}/cockpit?flight=AA100`,
      headers: {},
      expectedRedirect: '/login?callbackUrl=%2Fcockpit'
    },
    {
      desc: 'GET /api/trip/current?details=true returns 200 without redirect',
      url: `${BASE_URL}/api/trip/current?details=true`,
      headers: {},
      expectedStatus: 200
    },
    {
      desc: 'GET /api/health with custom Accept header returns 200',
      url: `${BASE_URL}/api/health`,
      headers: { 'Accept': 'application/json' },
      expectedStatus: 200
    },
    {
      desc: 'GET / with __Secure-next-auth.session-token does not redirect to /login',
      url: `${BASE_URL}/`,
      headers: { 'Cookie': '__Secure-next-auth.session-token=secure-token-123' },
      expectedStatus: 200
    }
  ];

  for (const tc of liveCases) {
    try {
      const res = await fetch(tc.url, {
        headers: tc.headers,
        redirect: 'manual'
      });

      if (tc.expectedRedirect) {
        const location = res.headers.get('location') || '';
        assert(`[Live] ${tc.desc}`, (res.status === 307 || res.status === 302) && location.includes(tc.expectedRedirect), `status: ${res.status}, loc: ${location}`);
      } else if (tc.expectedStatus) {
        assert(`[Live] ${tc.desc}`, res.status === tc.expectedStatus, `status: ${res.status}`);
      }
    } catch (err) {
      assert(`[Live] ${tc.desc}`, false, err.message);
    }
  }

  console.log('\n========================================');
  console.log(`DEEP TEST SUMMARY: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log('========================================');

  if (results.failed > 0) process.exit(1);
}

testLive();
