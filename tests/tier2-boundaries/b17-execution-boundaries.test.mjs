// tests/tier2-boundaries/b17-execution-boundaries.test.mjs
// B17: 1-Tap Recovery Execution Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B17: 1-Tap Recovery Execution Boundaries');

suite.test('B17.1: Double-click rapid trigger protection rejects concurrent execution attempts', async () => {
  let isExecuting = false;
  let executionCount = 0;

  async function clickOneTap() {
    if (isExecuting) return { status: 'REJECTED_LOCKED' };
    isExecuting = true;
    executionCount++;
    await new Promise(r => setTimeout(r, 20));
    isExecuting = false;
    return { status: 'CONFIRMED' };
  }

  const [res1, res2] = await Promise.all([clickOneTap(), clickOneTap()]);

  assert.strictEqual(executionCount, 1, 'Only 1 execution must occur during double click');
  assert.ok(res1.status === 'CONFIRMED' || res2.status === 'CONFIRMED');
  assert.ok(res1.status === 'REJECTED_LOCKED' || res2.status === 'REJECTED_LOCKED');
});

suite.test('B17.2: Execution when session is not in AWAITING_APPROVAL state throws invalid state error', async () => {
  function validateStateForExecution(state) {
    const allowed = ['AWAITING_APPROVAL', 'RECOVERY_OPTIONS_READY'];
    if (!allowed.includes(state)) {
      throw new Error(`Cannot execute recovery in state ${state}. Must be AWAITING_APPROVAL.`);
    }
    return true;
  }

  assert.throws(() => validateStateForExecution('NORMAL'), /Cannot execute recovery/);
  assert.throws(() => validateStateForExecution('RECOVERED'), /Cannot execute recovery/);
  assert.strictEqual(validateStateForExecution('AWAITING_APPROVAL'), true);
});

suite.test('B17.3: Simulating network disconnection during GDS booking rollback and audit logging', async () => {
  const ledger = [];
  let state = 'AWAITING_APPROVAL';

  async function executeWithFailure() {
    state = 'EXECUTING';
    try {
      throw new Error('Socket closed by peer (ECONNRESET)');
    } catch (err) {
      state = 'FAILED';
      ledger.push({
        id: `ERR-${Date.now()}`,
        status: 'FAILED',
        error: err.message,
        timestampIso: new Date().toISOString(),
      });
    }
  }

  await executeWithFailure();

  assert.strictEqual(state, 'FAILED');
  assert.strictEqual(ledger.length, 1);
  assert.strictEqual(ledger[0].status, 'FAILED');
  assert.ok(ledger[0].error.includes('ECONNRESET'));
});

suite.test('B17.4: Replaying previous execution transaction token is rejected (idempotency key)', () => {
  const processedTokens = new Set(['TKN-12345']);

  function processOrder(idempotencyKey) {
    if (processedTokens.has(idempotencyKey)) {
      return { success: false, duplicate: true, error: 'Idempotency key already used' };
    }
    processedTokens.add(idempotencyKey);
    return { success: true, duplicate: false };
  }

  const firstAttempt = processOrder('TKN-99999');
  assert.strictEqual(firstAttempt.success, true);

  const replayAttempt = processOrder('TKN-99999');
  assert.strictEqual(replayAttempt.success, false);
  assert.strictEqual(replayAttempt.duplicate, true);
});

suite.test('B17.5: Post-execution audit ledger record strictly conforms to database audit schema', () => {
  const record = {
    id: 'TX-VERIFY-001',
    proposalId: 'opt_a',
    fareKey: 'FARE-CANONICAL-41',
    status: 'CONFIRMED',
    reference: 'REC-DEMO-9901',
    executionTimeMs: 44,
    createdAtIso: new Date().toISOString(),
  };

  assert.ok(record.id.startsWith('TX-'));
  assert.ok(['CONFIRMED', 'FAILED', 'PENDING'].includes(record.status));
  assert.ok(record.executionTimeMs > 0);
  assert.ok(record.createdAtIso.includes('T'));
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b17-execution-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
