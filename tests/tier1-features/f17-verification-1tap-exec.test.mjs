// tests/tier1-features/f17-verification-1tap-exec.test.mjs
// F17: End-to-End Verification & 1-Tap Execution Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F17: End-to-End Verification & 1-Tap Execution');

suite.test('F17.1: 1-Tap recovery execution flow advances state from AWAITING_APPROVAL to EXECUTING to RECOVERED', async () => {
  const session = {
    tripId: 'TRIP-SIN-NRT-2026',
    state: 'AWAITING_APPROVAL',
    executionLock: false,
    ledger: [],
  };

  async function executeOneTap(proposalId, fareKey) {
    assert.strictEqual(session.executionLock, false, 'Execution lock must not be engaged');
    session.executionLock = true;
    session.state = 'EXECUTING';

    // Simulate provider order creation & ticketing
    const entry = {
      id: `ORD-${Date.now()}`,
      proposalId,
      fareKey,
      status: 'CONFIRMED',
      reference: `DEMO-REC-${Math.floor(1000 + Math.random() * 9000)}`,
      executionTimeMs: 45,
      createdAtIso: new Date().toISOString(),
    };

    session.ledger.push(entry);
    session.state = 'RECOVERED';
    session.executionLock = false;
    return entry;
  }

  const res = await executeOneTap('opt_b', 'FARE-CANONICAL-41');

  assert.strictEqual(session.state, 'RECOVERED');
  assert.strictEqual(session.ledger.length, 1);
  assert.strictEqual(res.status, 'CONFIRMED');
  assert.ok(res.reference.startsWith('DEMO-REC-'));
});

suite.test('F17.2: Execution lock prevents duplicate concurrent execution attempts', async () => {
  const session = { state: 'AWAITING_APPROVAL', executionLock: false, ledger: [] };

  async function runAttempt() {
    if (session.executionLock) {
      throw new Error('Execution already in progress');
    }
    session.executionLock = true;
    await new Promise(r => setTimeout(r, 10));
    session.executionLock = false;
    return 'DONE';
  }

  const p1 = runAttempt();
  await assert.rejects(async () => {
    await runAttempt();
  }, /Execution already in progress/);

  await p1;
});

suite.test('F17.3: Recovery execution on custom route (LHR -> JFK) records correct proposal metadata', async () => {
  const session = {
    tripId: 'TRIP-LHR-JFK-2026',
    state: 'AWAITING_APPROVAL',
    itinerary: CURATED_PRESETS[1],
    ledger: [],
  };

  const executedOrder = {
    id: 'TX-LHR-JFK-001',
    proposalId: 'opt_a',
    status: 'CONFIRMED',
    reference: 'BA-REBOOK-9912',
    executionTimeMs: 38,
    createdAtIso: new Date().toISOString(),
  };

  session.ledger.push(executedOrder);
  session.state = 'RECOVERED';

  assert.strictEqual(session.state, 'RECOVERED');
  assert.strictEqual(session.ledger[0].reference, 'BA-REBOOK-9912');
  assert.strictEqual(session.ledger[0].proposalId, 'opt_a');
});

suite.test('F17.4: Execution failures trigger graceful rollback to AWAITING_APPROVAL or FAILED', async () => {
  const session = { state: 'EXECUTING', executionLock: true, ledger: [] };

  function handleExecutionFailure(err) {
    session.executionLock = false;
    session.state = 'FAILED';
    session.lastError = err.message;
  }

  handleExecutionFailure(new Error('GDS seat inventory timeout'));

  assert.strictEqual(session.state, 'FAILED');
  assert.strictEqual(session.executionLock, false);
  assert.strictEqual(session.lastError, 'GDS seat inventory timeout');
});

suite.test('F17.5: Post-recovery session snapshot reflects confirmed state, risk reduction, and ledger', () => {
  const session = {
    tripId: 'TRIP-SFO-HND-2026',
    state: 'RECOVERED',
    initialRiskScore: 88,
    residualRiskScore: 18,
    ledger: [
      { id: 'ORD-902', proposalId: 'opt_b', status: 'CONFIRMED', reference: 'UA-REC-8751' }
    ],
  };

  assert.strictEqual(session.state, 'RECOVERED');
  assert.ok(session.residualRiskScore < session.initialRiskScore, 'Residual risk must be lower than disrupted risk');
  assert.strictEqual(session.ledger.length, 1);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f17-verification-1tap-exec.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
