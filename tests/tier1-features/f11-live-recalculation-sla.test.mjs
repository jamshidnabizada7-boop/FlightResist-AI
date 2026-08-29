// tests/tier1-features/f11-live-recalculation-sla.test.mjs
// F11: Sub-50ms Live Recalculation API Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, generateAlgorithmicCandidates, applyConstraintFunnel, rankRecoveryOptions } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F11: Sub-50ms Live Recalculation API');

suite.test('F11.1: Live constraint recalculation executes under 50ms SLA on cached candidates', () => {
  const itin = CURATED_PRESETS[0];
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });

  const start = performance.now();
  const funnelRes = applyConstraintFunnel(candidates, itin);
  const options = rankRecoveryOptions(funnelRes.survivors, itin);
  const elapsedMs = performance.now() - start;

  assert.ok(elapsedMs < 50, `Recalculation elapsed time ${elapsedMs.toFixed(2)}ms exceeds 50ms SLA`);
  assert.ok(options.length > 0);
});

suite.test('F11.2: Dynamic budget slider adjustment immediately updates candidate pruning', () => {
  const itin = { ...CURATED_PRESETS[0], constraints: { ...CURATED_PRESETS[0].constraints } };
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });

  // Budget $50 -> tighter pruning
  itin.constraints.budgetUsd = 50;
  const tightRes = applyConstraintFunnel(candidates, itin);
  assert.ok(tightRes.prunedSummary.over_budget > 12, 'Pruning should increase with lower budget');

  // Budget $500 -> looser pruning
  itin.constraints.budgetUsd = 500;
  const looseRes = applyConstraintFunnel(candidates, itin);
  assert.ok(looseRes.prunedSummary.over_budget < 12, 'Pruning should decrease with higher budget');
});

suite.test('F11.3: Dynamic MCT slider adjustment alters unsafe_connection pruning', () => {
  const itin = { ...CURATED_PRESETS[1], constraints: { ...CURATED_PRESETS[1].constraints } };
  const candidates = generateAlgorithmicCandidates({ origin: 'LHR', destination: 'JFK', travelDateIso: '2026-08-27' });

  // MCT 30 min (very relaxed)
  itin.constraints.mctMin = 30;
  const relaxed = applyConstraintFunnel(candidates, itin);

  // MCT 120 min (very strict)
  itin.constraints.mctMin = 120;
  const strict = applyConstraintFunnel(candidates, itin);

  assert.ok(strict.prunedSummary.unsafe_connection >= relaxed.prunedSummary.unsafe_connection);
});

suite.test('F11.4: Dynamic Baggage policy adjustment filters incompatible baggage allowances', () => {
  const itin = { ...CURATED_PRESETS[2], constraints: { ...CURATED_PRESETS[2].constraints } };
  const candidates = generateAlgorithmicCandidates({ origin: 'SFO', destination: 'HND', travelDateIso: '2026-08-27' });

  // 0 bags required
  itin.constraints.baggagePieces = 0;
  itin.constraints.baggageWeightKg = 0;
  const zeroBagRes = applyConstraintFunnel(candidates, itin);
  assert.strictEqual(zeroBagRes.prunedSummary.baggage_incompatible, 0);

  // 2 bags 32kg required
  itin.constraints.baggagePieces = 2;
  itin.constraints.baggageWeightKg = 32;
  const heavyBagRes = applyConstraintFunnel(candidates, itin);
  assert.ok(heavyBagRes.prunedSummary.baggage_incompatible > 0);
});

suite.test('F11.5: 50 consecutive rapid recalculation events maintain sub-50ms average latency', () => {
  const itin = { ...CURATED_PRESETS[3], constraints: { ...CURATED_PRESETS[3].constraints } };
  const candidates = generateAlgorithmicCandidates({ origin: 'SYD', destination: 'LAX', travelDateIso: '2026-08-27' });

  const times = [];
  for (let i = 0; i < 50; i++) {
    itin.constraints.budgetUsd = 100 + (i * 10) % 300;
    const t0 = performance.now();
    const res = applyConstraintFunnel(candidates, itin);
    rankRecoveryOptions(res.survivors, itin);
    times.push(performance.now() - t0);
  }

  const avgMs = times.reduce((s, t) => s + t, 0) / times.length;
  const maxMs = Math.max(...times);

  assert.ok(avgMs < 10, `Average recalc latency was ${avgMs.toFixed(2)}ms (expected <10ms)`);
  assert.ok(maxMs < 50, `Max recalc latency was ${maxMs.toFixed(2)}ms (expected <50ms)`);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f11-live-recalculation-sla.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
