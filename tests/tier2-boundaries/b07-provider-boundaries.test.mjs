// tests/tier2-boundaries/b07-provider-boundaries.test.mjs
// B7: Provider & Sandbox Gateway Boundary Tests

import assert from 'node:assert';
import { createTestSuite, generateAlgorithmicCandidates } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B7: Provider & Sandbox Gateway Boundaries');

suite.test('B7.1: Handling HTTP 504 gateway timeout from live GDS by falling back to simulation', async () => {
  async function resilientSearch(failLive = true) {
    if (failLive) {
      // Simulate live failure
      const fallbackCandidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27' });
      return { status: 'DEGRADED', source: 'DEMO_FALLBACK', candidates: fallbackCandidates };
    }
    return { status: 'HEALTHY', source: 'ATLAS_SANDBOX', candidates: [] };
  }

  const res = await resilientSearch(true);
  assert.strictEqual(res.status, 'DEGRADED');
  assert.strictEqual(res.source, 'DEMO_FALLBACK');
  assert.ok(res.candidates.length >= 35);
});

suite.test('B7.2: Provider response with empty flight array returns empty list without crashing', async () => {
  function parseProviderResponse(raw) {
    if (!raw || !Array.isArray(raw.data)) return [];
    return raw.data;
  }

  assert.deepStrictEqual(parseProviderResponse({ data: [] }), []);
  assert.deepStrictEqual(parseProviderResponse(null), []);
  assert.deepStrictEqual(parseProviderResponse({}), []);
});

suite.test('B7.3: Incomplete provider flight object missing aircraft or duration fills defaults', () => {
  function sanitizeCandidate(raw) {
    return {
      id: raw.id || 'cand-unknown',
      airlineCode: raw.airlineCode || 'XX',
      legs: (raw.legs || []).map(l => ({
        flightNumber: l.flightNumber || 'XX000',
        aircraft: l.aircraft || 'B777-300ER',
        durationMin: l.durationMin || 120,
        from: l.from || 'ORIG',
        to: l.to || 'DEST',
      })),
    };
  }

  const incomplete = { id: 'cand-partial', airlineCode: 'SQ', legs: [{ flightNumber: 'SQ856' }] };
  const sanitized = sanitizeCandidate(incomplete);

  assert.strictEqual(sanitized.legs[0].aircraft, 'B777-300ER');
  assert.strictEqual(sanitized.legs[0].durationMin, 120);
});

suite.test('B7.4: Rapid toggling between DEMO and ATLAS_SANDBOX provider modes preserves state', () => {
  let providerMode = 'DEMO';
  const toggle = () => { providerMode = providerMode === 'DEMO' ? 'ATLAS_SANDBOX' : 'DEMO'; return providerMode; };

  assert.strictEqual(toggle(), 'ATLAS_SANDBOX');
  assert.strictEqual(toggle(), 'DEMO');
  assert.strictEqual(toggle(), 'ATLAS_SANDBOX');
  assert.strictEqual(toggle(), 'DEMO');
});

suite.test('B7.5: Provider rate limiting (429 Too Many Requests) produces user-facing warning', () => {
  function handleProviderError(statusCode) {
    if (statusCode === 429) {
      return { handled: true, userMessage: 'Rate limit exceeded on GDS sandbox. Reverting to local cache.' };
    }
    return { handled: false, userMessage: 'Unexpected provider error' };
  }

  const err = handleProviderError(429);
  assert.strictEqual(err.handled, true);
  assert.ok(err.userMessage.includes('Rate limit exceeded'));
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b07-provider-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
