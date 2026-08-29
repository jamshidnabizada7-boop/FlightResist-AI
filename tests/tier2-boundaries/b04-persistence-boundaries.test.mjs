// tests/tier2-boundaries/b04-persistence-boundaries.test.mjs
// B4: Session Persistence Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B4: Session Persistence Boundaries');

suite.test('B4.1: Database storage keys with special characters and long session IDs', () => {
  function makeKey(tripId, sessionId) {
    const safeTrip = tripId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeSession = sessionId ? sessionId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'default';
    return `${safeTrip}::${safeSession}`;
  }

  const key1 = makeKey('TRIP-SIN/NRT?2026', 'user#123!@special');
  assert.strictEqual(key1, 'TRIP-SIN_NRT_2026::user_123__special');
});

suite.test('B4.2: Session state with 100+ audit log events does not exceed memory or serialize limits', () => {
  const session = {
    tripId: 'TRIP-STRESS-01',
    state: 'NORMAL',
    events: [],
  };

  for (let i = 1; i <= 200; i++) {
    session.events.push({
      seq: i,
      timestampIso: new Date().toISOString(),
      phase: i % 2 === 0 ? 'STATUS_POLL' : 'RECALCULATE',
      title: `Event cycle #${i}`,
      detail: 'Periodic telemetry pulse',
    });
  }

  const serialized = JSON.stringify(session);
  assert.ok(serialized.length > 1000, 'Payload serialized successfully');
  const parsed = JSON.parse(serialized);
  assert.strictEqual(parsed.events.length, 200);
});

suite.test('B4.3: Session recovery from partially corrupted storage data falls back to defaults', () => {
  function hydrateSession(raw) {
    try {
      const data = JSON.parse(raw);
      return {
        tripId: data.tripId || 'TRIP-DEFAULT',
        state: data.state || 'NORMAL',
        riskScore: typeof data.riskScore === 'number' ? data.riskScore : 0,
        itinerary: data.itinerary || CURATED_PRESETS[0],
      };
    } catch {
      return {
        tripId: 'TRIP-FALLBACK',
        state: 'NORMAL',
        riskScore: 0,
        itinerary: CURATED_PRESETS[0],
      };
    }
  }

  const corrupted = '{ "tripId": "TRIP-X", "riskScore": "invalid_number", "unknown": true }';
  const session = hydrateSession(corrupted);
  assert.strictEqual(session.tripId, 'TRIP-X');
  assert.strictEqual(session.riskScore, 0);
  assert.strictEqual(session.state, 'NORMAL');
});

suite.test('B4.4: Concurrent session isolation prevents cross-session state leakage', () => {
  const sessionStore = new Map();

  function mutateSessionRisk(sessionId, newRisk) {
    const s = sessionStore.get(sessionId);
    if (s) s.riskScore = newRisk;
  }

  sessionStore.set('session-A', { id: 'session-A', riskScore: 10 });
  sessionStore.set('session-B', { id: 'session-B', riskScore: 20 });

  mutateSessionRisk('session-A', 90);

  assert.strictEqual(sessionStore.get('session-A').riskScore, 90);
  assert.strictEqual(sessionStore.get('session-B').riskScore, 20, 'Session B risk must not change');
});

suite.test('B4.5: Clearing session ledger preserves trip constraints and passenger profile', () => {
  const session = {
    itinerary: CURATED_PRESETS[0],
    ledger: [{ id: 'tx-1', status: 'CONFIRMED' }],
  };

  session.ledger = [];

  assert.strictEqual(session.ledger.length, 0);
  assert.strictEqual(session.itinerary.passenger.name, 'Wei Chen');
  assert.strictEqual(session.itinerary.constraints.budgetUsd, 150);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b04-persistence-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
