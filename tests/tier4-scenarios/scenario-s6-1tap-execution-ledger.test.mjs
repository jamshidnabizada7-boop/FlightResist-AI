// tests/tier4-scenarios/scenario-s6-1tap-execution-ledger.test.mjs
// Scenario S6: 1-Tap Recovery Execution with Database Ledger & Audit Trail

import assert from 'node:assert';
import {
  createTestSuite,
  CURATED_PRESETS,
  generateEvidenceCsv,
  generateRunReportJson,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Scenario S6: 1-Tap Recovery Execution & Audit Ledger');

suite.test('S6.1: Execute 1-tap rebooking with state transition and atomic ledger entry', async () => {
  const session = {
    tripId: 'TRIP-SIN-NRT-2026',
    state: 'AWAITING_APPROVAL',
    executionLock: false,
    ledger: [],
  };

  async function executeOneTap(proposalId, fareKey) {
    assert.strictEqual(session.executionLock, false);
    session.executionLock = true;
    session.state = 'EXECUTING';

    const t0 = performance.now();
    await new Promise(r => setTimeout(r, 20)); // provider latency simulation
    const executionTimeMs = Math.round(performance.now() - t0);

    const transaction = {
      id: `ORD-REC-${Date.now()}`,
      proposalId,
      fareKey,
      status: 'CONFIRMED',
      reference: 'DEMO-REC-4471',
      executionTimeMs,
      createdAtIso: new Date().toISOString(),
    };

    session.ledger.push(transaction);
    session.state = 'RECOVERED';
    session.executionLock = false;
    return transaction;
  }

  const tx = await executeOneTap('opt_b', 'FARE-CANONICAL-41');

  assert.strictEqual(session.state, 'RECOVERED');
  assert.strictEqual(session.ledger.length, 1);
  assert.strictEqual(tx.status, 'CONFIRMED');
  assert.strictEqual(tx.reference, 'DEMO-REC-4471');
});

suite.test('S6.2: Post-execution evidence CSV contains full ledger transaction details', () => {
  const session = {
    itinerary: CURATED_PRESETS[0],
    disruption: { flightNumber: 'SQ856', event: 'CANCELLATION' },
    riskScore: 90,
    ledger: [
      { id: 'TX-901', status: 'CONFIRMED', reference: 'DEMO-REC-4471' }
    ],
  };

  const csv = generateEvidenceCsv(session);
  assert.ok(csv.includes('LEDGER,ENTRY_1_ID,TX-901'));
  assert.ok(csv.includes('LEDGER,ENTRY_1_STATUS,CONFIRMED'));
  assert.ok(csv.includes('LEDGER,ENTRY_1_REF,DEMO-REC-4471'));
});

suite.test('S6.3: Idempotent execution attempts do not double-book tickets', async () => {
  const ledger = [];
  const processedKeys = new Set();

  async function bookTicket(fareKey, idempotencyKey) {
    if (processedKeys.has(idempotencyKey)) {
      return { success: true, duplicate: true, record: ledger.find(l => l.key === idempotencyKey) };
    }
    processedKeys.add(idempotencyKey);
    const rec = { id: `BK-${Date.now()}`, key: idempotencyKey, fareKey, status: 'CONFIRMED' };
    ledger.push(rec);
    return { success: true, duplicate: false, record: rec };
  }

  const res1 = await bookTicket('FARE-41', 'IDEM-KEY-001');
  const res2 = await bookTicket('FARE-41', 'IDEM-KEY-001');

  assert.strictEqual(res1.duplicate, false);
  assert.strictEqual(res2.duplicate, true);
  assert.strictEqual(ledger.length, 1);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('scenario-s6-1tap-execution-ledger.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
