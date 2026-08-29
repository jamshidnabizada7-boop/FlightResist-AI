#!/usr/bin/env node
/**
 * tests/challenger-live-middleware.mjs
 * Live integration test verifying actual Next.js middleware behavior on port 3001.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3001';

async function runLiveMiddlewareTests() {
  console.log(`\nRunning live Next.js middleware verification against ${BASE}...\n`);
  let failures = 0;
  let checks = 0;

  function assert(cond, name, detail) {
    checks++;
    if (cond) {
      console.log(`[PASS] ${name}${detail ? ` -> ${detail}` : ''}`);
    } else {
      failures++;
      console.error(`[FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  // 1. Unauthenticated request to /api/trip/current
  try {
    const res = await fetch(`${BASE}/api/trip/current`, { redirect: 'manual' });
    assert(res.status === 200, 'Unauthenticated /api/trip/current returns HTTP 200 (not 307 redirect)', `status=${res.status}`);
    const setCookie = res.headers.get('set-cookie');
    assert(setCookie && setCookie.includes('fr-session='), 'Response sets fr-session cookie', setCookie);
    assert(setCookie && setCookie.includes('HttpOnly'), 'fr-session is HttpOnly', setCookie);
    assert(setCookie && /samesite=lax/i.test(setCookie), 'fr-session is SameSite=Lax', setCookie);
  } catch (err) {
    assert(false, 'Live test /api/trip/current', err.message);
  }

  // 2. Unauthenticated request to /api/mcp
  try {
    const res = await fetch(`${BASE}/api/mcp`, { redirect: 'manual' });
    assert(res.status === 200 || res.status === 405, 'Unauthenticated /api/mcp allowed through without login redirect', `status=${res.status}`);
  } catch (err) {
    assert(false, 'Live test /api/mcp', err.message);
  }

  // 3. Unauthenticated request to /login
  try {
    const res = await fetch(`${BASE}/login`, { redirect: 'manual' });
    assert(res.status === 200, 'Unauthenticated /login returns HTTP 200', `status=${res.status}`);
  } catch (err) {
    assert(false, 'Live test /login', err.message);
  }

  // 4. Unauthenticated request to protected root '/' or '/cockpit'
  try {
    const res = await fetch(`${BASE}/cockpit`, { redirect: 'manual' });
    const location = res.headers.get('location');
    assert(res.status === 307 || res.status === 302, 'Unauthenticated /cockpit returns 307/302 redirect', `status=${res.status}`);
    assert(location && location.includes('/login'), 'Redirect target is /login', location);
  } catch (err) {
    assert(false, 'Live test /cockpit', err.message);
  }

  // 5. Existing cookie is preserved (no re-minting in response)
  try {
    const customSession = 'custom-challenger-session-99';
    const res = await fetch(`${BASE}/api/trip/current`, {
      headers: { cookie: `fr-session=${customSession}` },
      redirect: 'manual',
    });
    assert(res.status === 200, 'Request with existing cookie succeeds', `status=${res.status}`);
    const setCookie = res.headers.get('set-cookie');
    assert(!setCookie || !setCookie.includes('fr-session='), 'Existing session is preserved (no Set-Cookie header emitted)', setCookie || 'none');
  } catch (err) {
    assert(false, 'Live test existing cookie preservation', err.message);
  }

  // 6. False positive route check (e.g. /apis)
  try {
    const res = await fetch(`${BASE}/apis`, { redirect: 'manual' });
    assert(res.status === 307 || res.status === 302, 'Non-API prefix /apis is intercepted by auth guard', `status=${res.status}`);
    const location = res.headers.get('location');
    assert(location && location.includes('/login'), 'Redirects /apis to /login', location);
  } catch (err) {
    assert(false, 'Live test /apis', err.message);
  }

  console.log(`\nLIVE SERVER CHECKS: ${checks} | PASSED: ${checks - failures} | FAILED: ${failures}`);
  if (failures > 0) {
    process.exit(1);
  }
}

runLiveMiddlewareTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
