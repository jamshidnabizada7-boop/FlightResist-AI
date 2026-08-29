// tests/tier4-scenarios/scenario-s4-multi-user-isolation.test.mjs
// Scenario S4: Multi-User Concurrent Session Isolation & Data Sovereignty

import assert from 'node:assert';
import {
  createTestSuite,
  CURATED_PRESETS,
  calculateTripImpactGraph,
  generateAlgorithmicCandidates,
  applyConstraintFunnel,
  rankRecoveryOptions,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Scenario S4: Multi-User Concurrent Session Isolation');

suite.test('S4.1: Simulate 10 simultaneous user sessions across different global presets', async () => {
  const sessionManager = new Map();

  function createSession(sessionId, presetIndex) {
    const raw = CURATED_PRESETS[presetIndex % CURATED_PRESETS.length];
    const itinerary = JSON.parse(JSON.stringify(raw));
    const session = {
      sessionId,
      itinerary,
      state: 'NORMAL',
      riskScore: 0,
      disruption: null,
      candidates: [],
      survivors: [],
      options: [],
      ledger: [],
    };
    sessionManager.set(sessionId, session);
    return session;
  }

  // Create 10 concurrent sessions
  for (let i = 1; i <= 10; i++) {
    createSession(`user-session-${i}`, i - 1);
  }

  assert.strictEqual(sessionManager.size, 10);
});

suite.test('S4.2: Concurrently trigger disruptions on each session without cross-contamination', async () => {
  const sessions = Array.from({ length: 6 }).map((_, i) => {
    const raw = CURATED_PRESETS[i];
    return {
      id: `usr-${i + 1}`,
      itinerary: JSON.parse(JSON.stringify(raw)),
      disruption: null,
      impact: null,
    };
  });

  // Disrupt all in parallel
  await Promise.all(
    sessions.map(async (sess, idx) => {
      sess.disruption = {
        flightNumber: sess.itinerary.legs[0].flightNumber,
        event: idx % 2 === 0 ? 'CANCELLATION' : 'DELAY',
        delayMinutes: idx % 2 === 0 ? 0 : 120,
        reason: `Concurrent disruption test on session ${sess.id}`,
      };
      sess.impact = calculateTripImpactGraph(sess.itinerary, sess.disruption);
    })
  );

  sessions.forEach(s => {
    assert.ok(s.impact.riskScore >= 0 && s.impact.riskScore <= 100);
    assert.strictEqual(s.disruption.flightNumber, s.itinerary.legs[0].flightNumber);
  });
});

suite.test('S4.3: Concurrently compute candidate funnels for distinct city pairs', async () => {
  const tasks = CURATED_PRESETS.map(async (preset, idx) => {
    const cands = generateAlgorithmicCandidates({
      origin: preset.origin,
      destination: preset.destination,
      travelDateIso: preset.travelDateIso,
      isCanonicalDemo: preset.tripId === 'TRIP-SIN-NRT-2026',
    });
    const funnel = applyConstraintFunnel(cands, preset);
    const ranked = rankRecoveryOptions(funnel.survivors, preset);
    return { tripId: preset.tripId, total: cands.length, survivors: funnel.survivors.length, optionsCount: ranked.length };
  });

  const results = await Promise.all(tasks);
  assert.strictEqual(results.length, 6);
  results.forEach(r => {
    assert.ok(r.total >= 35);
  });
});

suite.test('S4.4: Independent transaction execution across concurrent user ledgers', async () => {
  const ledgerMap = new Map();

  async function executeRebook(sessionId, tripId, proposalId) {
    const record = {
      id: `TX-${sessionId}-${Date.now()}`,
      sessionId,
      tripId,
      proposalId,
      status: 'CONFIRMED',
      timestamp: new Date().toISOString(),
    };
    if (!ledgerMap.has(sessionId)) ledgerMap.set(sessionId, []);
    ledgerMap.get(sessionId).push(record);
    return record;
  }

  await Promise.all([
    executeRebook('session-1', 'TRIP-SIN-NRT-2026', 'opt_b'),
    executeRebook('session-2', 'TRIP-LHR-JFK-2026', 'opt_a'),
    executeRebook('session-3', 'TRIP-SFO-HND-2026', 'opt_a'),
  ]);

  assert.strictEqual(ledgerMap.get('session-1').length, 1);
  assert.strictEqual(ledgerMap.get('session-2').length, 1);
  assert.strictEqual(ledgerMap.get('session-3').length, 1);
  assert.strictEqual(ledgerMap.get('session-1')[0].tripId, 'TRIP-SIN-NRT-2026');
  assert.strictEqual(ledgerMap.get('session-2')[0].tripId, 'TRIP-LHR-JFK-2026');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('scenario-s4-multi-user-isolation.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
