// tests/tier2-boundaries/b10-optimizer-boundaries.test.mjs
// B10: Decision Funnel & Multi-Criteria Optimizer Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, generateAlgorithmicCandidates, applyConstraintFunnel, rankRecoveryOptions } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B10: Decision Funnel & Optimizer Boundaries');

suite.test('B10.1: $0 budget ceiling prunes all positive-fare candidates cleanly', () => {
  const itin = { ...CURATED_PRESETS[0], constraints: { ...CURATED_PRESETS[0].constraints, budgetUsd: -100 } };
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });

  const res = applyConstraintFunnel(candidates, itin);
  assert.strictEqual(res.survivors.length, 0, 'No candidate should survive negative budget ceiling');
  assert.strictEqual(res.prunedSummary.over_budget, 42);

  const options = rankRecoveryOptions(res.survivors, itin);
  assert.strictEqual(options.length, 0);
});

suite.test('B10.2: Infinite budget ($1,000,000) allows all within-budget candidates through stage 2', () => {
  const itin = { ...CURATED_PRESETS[0], constraints: { ...CURATED_PRESETS[0].constraints, budgetUsd: 1000000 } };
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });

  const res = applyConstraintFunnel(candidates, itin);
  assert.strictEqual(res.prunedSummary.over_budget, 0, '0 candidates should be pruned for over_budget with $1M budget');
});

suite.test('B10.3: Tie-breaker deterministic sorting when candidates have identical recovery scores', () => {
  const itin = CURATED_PRESETS[1];
  const survivors = [
    { id: 'cand-A', fareDiffUsd: 50, arrIso: '2026-08-27T18:00:00-04:00', depIso: '2026-08-27T14:00:00+01:00', stops: 0, minConnectionMin: null, baggagePieces: 2, baggageWeightKg: 32, otp: 0.85 },
    { id: 'cand-B', fareDiffUsd: 50, arrIso: '2026-08-27T18:00:00-04:00', depIso: '2026-08-27T14:00:00+01:00', stops: 0, minConnectionMin: null, baggagePieces: 2, baggageWeightKg: 32, otp: 0.85 },
  ];

  const ranked = rankRecoveryOptions(survivors, itin);
  assert.strictEqual(ranked.length, 2);
  assert.strictEqual(ranked[0].id, 'opt_a');
  assert.strictEqual(ranked[1].id, 'opt_b');
  assert.strictEqual(ranked[0].recoveryScore, ranked[1].recoveryScore);
});

suite.test('B10.4: Empty candidate survivors array returns empty ranked recovery options without crashing', () => {
  const options = rankRecoveryOptions([], CURATED_PRESETS[0]);
  assert.deepStrictEqual(options, []);
  assert.strictEqual(options.length, 0);
});

suite.test('B10.5: Maximum 3 proposals (Option A, B, C) returned even when 20+ candidates survive', () => {
  const itin = {
    ...CURATED_PRESETS[1],
    constraints: { budgetUsd: 5000, mctMin: 30, baggagePieces: 0, baggageWeightKg: 0, arrivalDeadlineIso: '2026-08-30T12:00:00Z', hardArrivalLimitIso: '2026-08-30T12:00:00Z' }
  };
  const candidates = generateAlgorithmicCandidates({ origin: 'LHR', destination: 'JFK', travelDateIso: '2026-08-27', budgetCeilingUsd: 5000, mctMin: 30 });
  const res = applyConstraintFunnel(candidates, itin);

  assert.ok(res.survivors.length > 5, `Expected >5 survivors (got ${res.survivors.length})`);
  const ranked = rankRecoveryOptions(res.survivors, itin);
  assert.strictEqual(ranked.length, 3, 'Optimizer must cap output at top 3 proposals (A, B, C)');
  assert.strictEqual(ranked[0].label, 'A');
  assert.strictEqual(ranked[1].label, 'B');
  assert.strictEqual(ranked[2].label, 'C');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b10-optimizer-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
