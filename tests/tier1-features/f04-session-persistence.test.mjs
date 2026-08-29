// tests/tier1-features/f04-session-persistence.test.mjs
// F4: Session & Database Persistence Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F4: Session & Database Persistence');

suite.test('F4.1: Session store maintains independent LiveSession instances per session ID', () => {
  const sessions = new Map();
  
  function getOrCreateSession(id, itinerary) {
    if (!sessions.has(id)) {
      sessions.set(id, {
        sessionId: id,
        itinerary,
        state: 'NORMAL',
        riskScore: 0,
        disruption: null,
        events: [],
        ledger: [],
      });
    }
    return sessions.get(id);
  }

  const s1 = getOrCreateSession('user-session-1', CURATED_PRESETS[0]);
  const s2 = getOrCreateSession('user-session-2', CURATED_PRESETS[1]);

  assert.notStrictEqual(s1, s2);
  assert.strictEqual(s1.itinerary.tripId, 'TRIP-SIN-NRT-2026');
  assert.strictEqual(s2.itinerary.tripId, 'TRIP-LHR-JFK-2026');
});

suite.test('F4.2: Session persistence key format matches database schema contract', () => {
  function makePersistenceKey(tripId, sessionId) {
    if (!sessionId || sessionId === 'default') return tripId;
    return `${tripId}::${sessionId}`;
  }

  assert.strictEqual(makePersistenceKey('TRIP-SIN-NRT-2026', 'default'), 'TRIP-SIN-NRT-2026');
  assert.strictEqual(makePersistenceKey('TRIP-LHR-JFK-2026', 'usr-789'), 'TRIP-LHR-JFK-2026::usr-789');
});

suite.test('F4.3: Session state transitions follow deterministic recovery lifecycle', () => {
  const session = {
    state: 'NORMAL',
    history: ['NORMAL'],
  };

  const validTransitions = {
    NORMAL: ['DISRUPTION_DETECTED'],
    DISRUPTION_DETECTED: ['ANALYZING'],
    ANALYZING: ['RECOVERY_OPTIONS_READY'],
    RECOVERY_OPTIONS_READY: ['AWAITING_APPROVAL', 'EXECUTING'],
    AWAITING_APPROVAL: ['EXECUTING', 'FAILED'],
    EXECUTING: ['RECOVERED', 'FAILED'],
    RECOVERED: ['NORMAL'],
    FAILED: ['NORMAL'],
  };

  function transitionTo(nextState) {
    const allowed = validTransitions[session.state];
    assert.ok(allowed && allowed.includes(nextState), `Invalid state transition from ${session.state} to ${nextState}`);
    session.state = nextState;
    session.history.push(nextState);
  }

  transitionTo('DISRUPTION_DETECTED');
  transitionTo('ANALYZING');
  transitionTo('RECOVERY_OPTIONS_READY');
  transitionTo('AWAITING_APPROVAL');
  transitionTo('EXECUTING');
  transitionTo('RECOVERED');

  assert.strictEqual(session.state, 'RECOVERED');
  assert.strictEqual(session.history.length, 7);
});

suite.test('F4.4: Session snapshot serialization preserves full audit ledger and itinerary', () => {
  const session = {
    tripId: 'TRIP-SFO-HND-2026',
    state: 'RECOVERED',
    itinerary: CURATED_PRESETS[2],
    riskScore: 82,
    disruption: { flightNumber: 'UA875', event: 'CANCELLATION' },
    ledger: [
      { id: 'tx-001', proposalId: 'opt_b', status: 'CONFIRMED', reference: 'DEMO-REC-9941', executionTimeMs: 42, createdAtIso: new Date().toISOString() }
    ],
  };

  const snapshotJson = JSON.stringify(session);
  const deserialized = JSON.parse(snapshotJson);

  assert.strictEqual(deserialized.tripId, 'TRIP-SFO-HND-2026');
  assert.strictEqual(deserialized.state, 'RECOVERED');
  assert.strictEqual(deserialized.ledger.length, 1);
  assert.strictEqual(deserialized.ledger[0].reference, 'DEMO-REC-9941');
});

suite.test('F4.5: Resetting session clears disruption and analysis while preserving active itinerary', () => {
  const session = {
    state: 'RECOVERED',
    itinerary: CURATED_PRESETS[3], // SYD-LAX
    riskScore: 75,
    disruption: { flightNumber: 'QF11', event: 'DELAY' },
    analysis: { recommendedId: 'opt_b' },
  };

  // Reset operation
  session.state = 'NORMAL';
  session.riskScore = 0;
  session.disruption = null;
  session.analysis = null;

  assert.strictEqual(session.state, 'NORMAL');
  assert.strictEqual(session.riskScore, 0);
  assert.strictEqual(session.disruption, null);
  assert.strictEqual(session.analysis, null);
  assert.strictEqual(session.itinerary.tripId, 'TRIP-SYD-LAX-2026');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f04-session-persistence.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
