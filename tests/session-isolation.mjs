#!/usr/bin/env node
/**
 * tests/session-isolation.mjs — verifies cookie-based multi-session isolation
 * (Task 21 core architectural change).
 *
 * Scenarios covered:
 *   1. Two cookie-bearing clients (A, B) hold fully independent trip states.
 *   2. Concurrent pipelines: A and B can both be AWAITING_APPROVAL at once —
 *      impossible with the old global singleton session.
 *   3. A's execution/reset does not leak into B's session (and vice versa).
 *   4. Cookie-less clients keep sharing the legacy default session (backward
 *      compatibility for curl / smoke tests / MCP).
 *   5. Middleware cookie issuance: a cookie-less first request gets a
 *      Set-Cookie on the RESPONSE only — the request itself still resolves to
 *      the shared default session (stateless-client compatibility). The
 *      minted cookie isolates the browser from its NEXT request onward.
 *   6. SSE isolation: B's stream receives none of A's agent events.
 *
 * Usage: node tests/session-isolation.mjs [baseUrl]
 * Exits non-zero if any assertion fails. Run with ATLAS_MODE unset (demo).
 */

const BASE = process.argv[2] ?? 'http://localhost:3001';

const failures = [];
function check(label, condition, detail) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? ` → ${String(detail).slice(0, 120)}` : ''}`);
  if (!ok) failures.push(label);
}

const api = (path) => `${BASE}${path}`;

/** Minimal cookie-jar fetch wrapper. */
function client(sessionId) {
  const headers = sessionId ? { cookie: `fr-session=${sessionId}` } : {};
  return {
    sessionId,
    get: (path) => fetch(api(path), { headers: { ...headers } }),
    post: (path, body) =>
      fetch(api(path), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      }),
  };
}

async function waitFor(predicate, timeoutMs = 60000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await predicate();
    if (r !== null && r !== undefined) return r;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

const tripState = async (c) => (await (await c.get('/api/trip/current')).json()).state;

async function main() {
  console.log(`--- Session isolation against ${BASE} ---\n`);

  const A = client('test-user-a');
  const B = client('test-user-b');
  const ANON = client(null); // cookie-less → shared default session

  // --- 0. Clean slate for all three sessions -------------------------------
  for (const [name, c] of [['A', A], ['B', B], ['default', ANON]]) {
    const r = await c.post('/api/session/reset').then((x) => x.json());
    check(`reset ${name} → NORMAL`, r.state === 'NORMAL', r.state);
  }

  // --- 1. Baseline isolation ------------------------------------------------
  check('A starts NORMAL', (await tripState(A)) === 'NORMAL');
  check('B starts NORMAL', (await tripState(B)) === 'NORMAL');
  check('default starts NORMAL', (await tripState(ANON)) === 'NORMAL');

  // --- 2. A triggers a disruption; B + default must stay NORMAL -------------
  const trig = await A.post('/api/disrupt/trigger', { scenario: 'cancellation' }).then((r) => r.json());
  check('A trigger accepted', trig.status === 'DISRUPTION_TRIGGERED' || trig.state === 'ANALYZING', trig.state ?? trig.status);

  check('B still NORMAL while A analyzes', (await tripState(B)) === 'NORMAL', await tripState(B));
  check('default still NORMAL while A analyzes', (await tripState(ANON)) === 'NORMAL', await tripState(ANON));

  console.log('  ... waiting for A analysis ...');
  const aDone = await waitFor(async () => {
    const t = await A.get('/api/trip/current').then((r) => r.json());
    return ['AWAITING_APPROVAL', 'FAILED', 'RECOVERED'].includes(t.state) ? t : null;
  });
  check('A reached AWAITING_APPROVAL', aDone.state === 'AWAITING_APPROVAL', aDone.state);
  if (aDone.state !== 'AWAITING_APPROVAL') {
    console.log('  A analysis failed — aborting (isolation already proven above).');
    process.exit(1);
  }

  // --- 3. Concurrent pipelines: B triggers while A is at the approval gate ---
  const trigB = await B.post('/api/disrupt/trigger', { scenario: 'delay', delay_minutes: 90 }).then((r) => r.json());
  check('B trigger accepted while A awaits approval (concurrent users)', trigB.status === 'DISRUPTION_TRIGGERED', trigB.status);

  console.log('  ... waiting for B analysis ...');
  const bDone = await waitFor(async () => {
    const t = await B.get('/api/trip/current').then((r) => r.json());
    return ['AWAITING_APPROVAL', 'FAILED', 'RECOVERED'].includes(t.state) ? t : null;
  });
  check('B reached AWAITING_APPROVAL', bDone.state === 'AWAITING_APPROVAL', bDone.state);
  check('A still AWAITING_APPROVAL after B analysis', (await tripState(A)) === 'AWAITING_APPROVAL', await tripState(A));
  check('default untouched by both pipelines', (await tripState(ANON)) === 'NORMAL', await tripState(ANON));

  // --- 4. A confirms; B must not see A's execution --------------------------
  const aOpts = await A.get('/api/recovery/options').then((r) => r.json());
  const aRecommended = aOpts.options?.find((o) => o.status === 'RECOMMENDED') ?? aOpts.options?.[0];
  check('A sees its own recovery options', Boolean(aRecommended), aRecommended?.id);

  // Ledger baselines (the ledger is durable across resets BY DESIGN, so assert
  // deltas rather than absolute counts — keeps the test rerunnable).
  const aLedgerBefore = (await A.get('/api/trip/current').then((r) => r.json())).ledger.length;
  const bLedgerBefore = (await B.get('/api/trip/current').then((r) => r.json())).ledger.length;
  const defLedgerBefore = (await ANON.get('/api/trip/current').then((r) => r.json())).ledger.length;

  const aExec = await A.post('/api/recovery/confirm', { proposal_id: aRecommended.id }).then((r) => r.json());
  check('A execution RECOVERED', aExec.state === 'RECOVERED', `${aExec.state} ${aExec.error ?? ''}`);

  const bAfterAExec = await B.get('/api/trip/current').then((r) => r.json());
  check('B still AWAITING_APPROVAL after A executed', bAfterAExec.state === 'AWAITING_APPROVAL', bAfterAExec.state);

  const aLedger = aExec.state === 'RECOVERED' ? (await A.get('/api/trip/current').then((r) => r.json())).ledger : [];
  check('A ledger grew by exactly its own execution', aLedger.length === aLedgerBefore + 1, `${aLedgerBefore} → ${aLedger.length}`);
  check('B ledger unchanged by A execution (no leakage)', bAfterAExec.ledger.length === bLedgerBefore, `${bLedgerBefore} → ${bAfterAExec.ledger.length}`);
  const defLedger = (await ANON.get('/api/trip/current').then((r) => r.json())).ledger;
  check('default ledger unchanged by A execution', defLedger.length === defLedgerBefore, `${defLedgerBefore} → ${defLedger.length}`);

  // --- 5. Reset scoping: resetting A leaves B untouched ----------------------
  const aReset = await A.post('/api/session/reset').then((r) => r.json());
  check('A reset → NORMAL', aReset.state === 'NORMAL', aReset.state);
  check('B still AWAITING_APPROVAL after A reset', (await tripState(B)) === 'AWAITING_APPROVAL', await tripState(B));

  // B confirms on its own session
  const bOpts = await B.get('/api/recovery/options').then((r) => r.json());
  const bRecommended = bOpts.options?.find((o) => o.status === 'RECOMMENDED') ?? bOpts.options?.[0];
  const bExec = await B.post('/api/recovery/confirm', { proposal_id: bRecommended.id }).then((r) => r.json());
  check('B execution RECOVERED', bExec.state === 'RECOVERED', `${bExec.state} ${bExec.error ?? ''}`);
  check('default still NORMAL at the end', (await tripState(ANON)) === 'NORMAL', await tripState(ANON));

  // --- 6. Middleware: cookie issued AND visible to the same request ---------
  const C = client(null);
  const cTrigRes = await C.post('/api/disrupt/trigger', { scenario: 'cancellation' });
  const cTrigBody = await cTrigRes.json();
  check('cookie-less trigger accepted (not rate-limited)', cTrigRes.status === 200, `${cTrigRes.status} ${cTrigBody.error ?? ''}`);
  const setCookies = cTrigRes.headers.getSetCookie?.() ?? [];
  const cCookie = setCookies
    .find((c) => c.startsWith('fr-session='))
    ?.match(/fr-session=([^;]+)/)?.[1];
  check('cookie-less request gets a fresh fr-session cookie', Boolean(cCookie), setCookies.join(' | '));

  // The cookie-less trigger itself resolved to the SHARED default session —
  // exactly the legacy single-session behavior curl / smoke tests / MCP rely on.
  const defAfterAnon = await tripState(ANON);
  check('cookie-less trigger landed on shared default session (stateless fallback)', ['DISRUPTION_DETECTED', 'ANALYZING', 'AWAITING_APPROVAL', 'RECOVERED'].includes(defAfterAnon), defAfterAnon);

  // The minted cookie starts a PRISTINE session for the browser — it does NOT
  // inherit the cookie-less request's activity (isolation starts next request).
  const C2 = client(cCookie); // browser adopting the minted cookie
  const cState = await tripState(C2);
  check('minted-cookie session is pristine NORMAL (browser isolated from next request)', cState === 'NORMAL', cState);

  // Wait for the DEFAULT session's pipeline (the cookie-less trigger) to
  // settle so live agent traffic is quiet, and for the per-IP rate-limit
  // windows (3 triggers / 5 resets per minute) to clear before the SSE phase.
  await waitFor(async () => {
    const t = await ANON.get('/api/trip/current').then((r) => r.json());
    return ['AWAITING_APPROVAL', 'FAILED', 'RECOVERED'].includes(t.state) ? t : null;
  });
  console.log('  ... cooling down 70s for rate-limit windows ...');
  await new Promise((r) => setTimeout(r, 70_000));

  // --- 7. SSE isolation: a fresh session's stream gets none of C's events ----
  const D = client('test-user-d'); // never used before → pristine, empty trace
  const dEvents = [];
  const controller = new AbortController();
  const sse = fetch(`${api('/api/recovery/stream')}`, {
    headers: { cookie: 'fr-session=test-user-d', accept: 'text/event-stream' },
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (line.startsWith('event: agent')) dEvents.push(line);
        }
      }
    } catch { /* aborted */ }
  }).catch(() => { /* aborted */ });

  await new Promise((r) => setTimeout(r, 500)); // let D's stream connect + replay
  const before = dEvents.length;
  // Re-arm C and generate a fresh run of live agent events on C's session.
  await C2.post('/api/session/reset');
  const cTrig2 = await C2.post('/api/disrupt/trigger', { scenario: 'delay', delay_minutes: 45 }).then((r) => r.json());
  check('C re-trigger accepted for SSE phase', cTrig2.status === 'DISRUPTION_TRIGGERED', `${cTrig2.status} ${cTrig2.error ?? ''}`);
  await new Promise((r) => setTimeout(r, 5000)); // C emits plenty of live agent events in 5s
  controller.abort();
  await sse;
  check('SSE isolation: D received zero live agent events from C', dEvents.length === before, `agent events received: ${dEvents.length - before}`);

  // --- 8. Cleanup (best effort — per-IP rate limits may 429) ------------------
  for (const [name, c] of [['A', A], ['B', B], ['C', C2], ['D', D], ['default', ANON]]) {
    const r = await c.post('/api/session/reset').catch(() => null);
    if (r && r.status !== 200) console.log(`  (cleanup reset ${name}: HTTP ${r.status} — rate limited, ignored)`);
  }
  console.log('  (all test sessions reset — best effort)');

  console.log(`\n--- ${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILURE(S)`} ---`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nFATAL: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
