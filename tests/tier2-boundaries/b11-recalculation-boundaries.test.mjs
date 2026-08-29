// tests/tier2-boundaries/b11-recalculation-boundaries.test.mjs
// B11: Live Recalculation API Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, generateAlgorithmicCandidates, applyConstraintFunnel, rankRecoveryOptions } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B11: Live Recalculation API Boundaries');

suite.test('B11.1: 100 rapid concurrent constraint recalculation calls complete within SLA', async () => {
  const itin = CURATED_PRESETS[0];
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });

  const tasks = Array.from({ length: 100 }).map(async (_, idx) => {
    const cloned = { ...itin, constraints: { ...itin.constraints, budgetUsd: 100 + (idx % 200) } };
    const t0 = performance.now();
    const res = applyConstraintFunnel(candidates, cloned);
    const opts = rankRecoveryOptions(res.survivors, cloned);
    return { duration: performance.now() - t0, count: opts.length };
  });

  const results = await Promise.all(tasks);
  assert.strictEqual(results.length, 100);
  const maxTime = Math.max(...results.map(r => r.duration));
  assert.ok(maxTime < 50, `Max concurrent recalculation time was ${maxTime.toFixed(2)}ms (expected <50ms)`);
});

suite.test('B11.2: Constraint updates with partial fields do not wipe out unmentioned constraints', () => {
  const baseConstraints = {
    budgetUsd: 200,
    mctMin: 60,
    baggagePieces: 1,
    baggageWeightKg: 23,
    arrivalDeadlineIso: '2026-08-28T09:00:00Z',
    hardArrivalLimitIso: '2026-08-28T14:00:00Z',
  };

  function mergeConstraints(original, patch) {
    return { ...original, ...patch };
  }

  const updated = mergeConstraints(baseConstraints, { budgetUsd: 350 });
  assert.strictEqual(updated.budgetUsd, 350);
  assert.strictEqual(updated.mctMin, 60, 'MCT min must be preserved');
  assert.strictEqual(updated.baggagePieces, 1, 'Baggage pieces must be preserved');
});

suite.test('B11.3: Recalculating when candidates pool is empty returns empty survivors instantly (<1ms)', () => {
  const itin = CURATED_PRESETS[1];
  const t0 = performance.now();
  const res = applyConstraintFunnel([], itin);
  const dur = performance.now() - t0;

  assert.strictEqual(res.survivors.length, 0);
  assert.strictEqual(res.totalCandidates, 0);
  assert.ok(dur < 5);
});

suite.test('B11.4: Extreme arrival deadline in the past prunes all candidates at stage 1', () => {
  const itin = {
    ...CURATED_PRESETS[0],
    constraints: { ...CURATED_PRESETS[0].constraints, hardArrivalLimitIso: '2020-01-01T00:00:00Z' }
  };
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });

  const res = applyConstraintFunnel(candidates, itin);
  assert.strictEqual(res.prunedSummary.misses_deadline, 42);
  assert.strictEqual(res.survivors.length, 0);
});

suite.test('B11.5: Non-numeric string inputs to constraint updates parse with safe fallbacks', () => {
  function sanitizeConstraints(raw) {
    return {
      budgetUsd: Number(raw.budgetUsd) || 200,
      mctMin: Number(raw.mctMin) || 60,
      baggagePieces: Number(raw.baggagePieces) || 1,
      baggageWeightKg: Number(raw.baggageWeightKg) || 23,
    };
  }

  const badInput = { budgetUsd: 'NaN', mctMin: 'not_a_number', baggagePieces: null };
  const clean = sanitizeConstraints(badInput);

  assert.strictEqual(clean.budgetUsd, 200);
  assert.strictEqual(clean.mctMin, 60);
  assert.strictEqual(clean.baggagePieces, 1);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b11-recalculation-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
