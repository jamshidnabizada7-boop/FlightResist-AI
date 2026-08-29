// tests/tier1-features/f10-decision-funnel-optimizer.test.mjs
// F10: Dynamic Decision Funnel & Optimizer Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, generateAlgorithmicCandidates, applyConstraintFunnel, rankRecoveryOptions } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F10: Dynamic Decision Funnel & Optimizer');

suite.test('F10.1: Decision funnel sequentially evaluates 4 independent constraint stages', () => {
  const sinNrt = CURATED_PRESETS[0];
  const candidates = generateAlgorithmicCandidates({
    origin: 'SIN',
    destination: 'NRT',
    travelDateIso: '2026-08-27',
    isCanonicalDemo: true,
  });

  const res = applyConstraintFunnel(candidates, sinNrt);

  assert.strictEqual(res.totalCandidates, 42);
  assert.strictEqual(res.funnel.length, 4);
  assert.strictEqual(res.funnel[0].reason, 'misses_deadline');
  assert.strictEqual(res.funnel[1].reason, 'over_budget');
  assert.strictEqual(res.funnel[2].reason, 'unsafe_connection');
  assert.strictEqual(res.funnel[3].reason, 'baggage_incompatible');

  assert.strictEqual(res.prunedSummary.over_budget, 12);
  assert.strictEqual(res.prunedSummary.unsafe_connection, 18);
  assert.strictEqual(res.prunedSummary.baggage_incompatible, 9);
  assert.strictEqual(res.survivors.length, 3);
});

suite.test('F10.2: Multi-criteria scoring strictly evaluates R = .35Arr + .25Conn + .20Price + .10Bag + .10Risk', () => {
  const sinNrt = CURATED_PRESETS[0];
  const candidates = generateAlgorithmicCandidates({
    origin: 'SIN',
    destination: 'NRT',
    travelDateIso: '2026-08-27',
    isCanonicalDemo: true,
  });

  const { survivors } = applyConstraintFunnel(candidates, sinNrt);
  const options = rankRecoveryOptions(survivors, sinNrt);

  assert.strictEqual(options.length, 3);
  options.forEach(opt => {
    const s = opt.scores;
    const expectedR = Number((0.35 * s.arrival + 0.25 * s.connection + 0.20 * s.price + 0.10 * s.baggage + 0.10 * s.risk).toFixed(1));
    assert.strictEqual(opt.recoveryScore, expectedR, `Recovery score formula mismatch for ${opt.label}`);
    assert.strictEqual(opt.residualRisk, Math.max(5, Math.round(100 - expectedR)));
  });
});

suite.test('F10.3: Assigns distinct statuses: RECOMMENDED, SECONDARY, ALTERNATIVE in sorted order', () => {
  const sinNrt = CURATED_PRESETS[0];
  const candidates = generateAlgorithmicCandidates({
    origin: 'SIN',
    destination: 'NRT',
    travelDateIso: '2026-08-27',
    isCanonicalDemo: true,
  });

  const { survivors } = applyConstraintFunnel(candidates, sinNrt);
  const options = rankRecoveryOptions(survivors, sinNrt);

  assert.strictEqual(options[0].status, 'RECOMMENDED');
  assert.strictEqual(options[1].status, 'SECONDARY');
  assert.strictEqual(options[2].status, 'ALTERNATIVE');

  assert.ok(options[0].recoveryScore >= options[1].recoveryScore);
  assert.ok(options[1].recoveryScore >= options[2].recoveryScore);
});

suite.test('F10.4: Why Engine facts payload populates whyRecommended, whyRejected, tradeoffs, and verdict', () => {
  const lhrJfk = CURATED_PRESETS[1];
  const candidates = generateAlgorithmicCandidates({ origin: 'LHR', destination: 'JFK', travelDateIso: '2026-08-27' });
  const { survivors } = applyConstraintFunnel(candidates, lhrJfk);
  const options = rankRecoveryOptions(survivors, lhrJfk);

  options.forEach(opt => {
    assert.ok(opt.why, `Option ${opt.label} must have why payload`);
    assert.ok(Array.isArray(opt.why.tradeoffs));
    assert.ok(Array.isArray(opt.why.preservedJourneyElements));
    assert.ok(Array.isArray(opt.why.remainingRisks));
    assert.ok(opt.why.verdict && opt.why.verdict.length > 0);
  });
});

suite.test('F10.5: Funnel stages accurately record removed candidate IDs for full auditability', () => {
  const sfoHnd = CURATED_PRESETS[2];
  const candidates = generateAlgorithmicCandidates({ origin: 'SFO', destination: 'HND', travelDateIso: '2026-08-27' });
  const res = applyConstraintFunnel(candidates, sfoHnd);

  let totalRemoved = 0;
  res.funnel.forEach(stage => {
    assert.strictEqual(stage.removed, stage.removedIds.length, `Stage ${stage.reason} removed count must equal removedIds length`);
    totalRemoved += stage.removed;
  });

  assert.strictEqual(totalRemoved + res.survivors.length, res.totalCandidates);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f10-decision-funnel-optimizer.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
