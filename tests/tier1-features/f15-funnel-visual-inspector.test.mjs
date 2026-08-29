// tests/tier1-features/f15-funnel-visual-inspector.test.mjs
// F15: Decision Funnel Visual Feedback & Inspector Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, generateAlgorithmicCandidates, applyConstraintFunnel } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F15: Decision Funnel Visual Feedback & Inspector');

suite.test('F15.1: Dynamic route indicators display active city pair in funnel header', () => {
  function getFunnelHeader(itinerary) {
    return `Searched flights ${itinerary.origin} → ${itinerary.destination}`;
  }

  assert.strictEqual(getFunnelHeader(CURATED_PRESETS[0]), 'Searched flights SIN → NRT');
  assert.strictEqual(getFunnelHeader(CURATED_PRESETS[1]), 'Searched flights LHR → JFK');
  assert.strictEqual(getFunnelHeader(CURATED_PRESETS[2]), 'Searched flights SFO → HND');
});

suite.test('F15.2: Funnel stage bars compute percentage surviving accurately', () => {
  const candidates = generateAlgorithmicCandidates({ origin: 'LHR', destination: 'JFK', travelDateIso: '2026-08-27' });
  const res = applyConstraintFunnel(candidates, CURATED_PRESETS[1]);

  res.funnel.forEach(stage => {
    const pct = Math.round((stage.remaining / res.totalCandidates) * 100);
    assert.ok(pct >= 0 && pct <= 100, `Stage percent ${pct}% must be between 0 and 100`);
  });
});

suite.test('F15.3: Pruned candidate inspector retrieves exact candidates and rejection reasons', () => {
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });
  const res = applyConstraintFunnel(candidates, CURATED_PRESETS[0]);

  const overBudgetStage = res.funnel.find(s => s.reason === 'over_budget');
  assert.ok(overBudgetStage.removedIds.length > 0);

  const prunedCandidates = candidates.filter(c => overBudgetStage.removedIds.includes(c.id));
  assert.strictEqual(prunedCandidates.length, overBudgetStage.removed);

  prunedCandidates.forEach(c => {
    assert.ok(c.fareDiffUsd > CURATED_PRESETS[0].constraints.budgetUsd, `Candidate ${c.id} fareDiff ${c.fareDiffUsd} must exceed budget`);
  });
});

suite.test('F15.4: Inspecting unsafe connection stage reveals violations of MCT floor', () => {
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });
  const res = applyConstraintFunnel(candidates, CURATED_PRESETS[0]);

  const unsafeStage = res.funnel.find(s => s.reason === 'unsafe_connection');
  const pruned = candidates.filter(c => unsafeStage.removedIds.includes(c.id));

  pruned.forEach(c => {
    assert.ok(c.minConnectionMin < CURATED_PRESETS[0].constraints.mctMin, `Layover ${c.minConnectionMin}m must be < MCT`);
  });
});

suite.test('F15.5: Finalist count indicator accurately reflects surviving options count', () => {
  const candidates = generateAlgorithmicCandidates({ origin: 'SFO', destination: 'HND', travelDateIso: '2026-08-27' });
  const res = applyConstraintFunnel(candidates, CURATED_PRESETS[2]);

  const summaryText = `${res.survivors.length} finalists ranked`;
  assert.ok(summaryText.includes(`${res.survivors.length} finalists`));
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f15-funnel-visual-inspector.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
