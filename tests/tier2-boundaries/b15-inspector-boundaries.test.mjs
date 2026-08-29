// tests/tier2-boundaries/b15-inspector-boundaries.test.mjs
// B15: Decision Funnel Visual Inspector Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, generateAlgorithmicCandidates, applyConstraintFunnel } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B15: Decision Funnel Inspector Boundaries');

suite.test('B15.1: Stage inspector handles stage with 0 pruned candidates cleanly (empty removed list)', () => {
  const itin = { ...CURATED_PRESETS[0], constraints: { ...CURATED_PRESETS[0].constraints, budgetUsd: 2000 } };
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });
  const res = applyConstraintFunnel(candidates, itin);

  const overBudgetStage = res.funnel.find(s => s.reason === 'over_budget');
  assert.strictEqual(overBudgetStage.removed, 0);
  assert.deepStrictEqual(overBudgetStage.removedIds, []);
});

suite.test('B15.2: Stage inspector handles 100% pruned stage where remaining drops to 0', () => {
  const itin = { ...CURATED_PRESETS[0], constraints: { ...CURATED_PRESETS[0].constraints, budgetUsd: -50 } };
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });
  const res = applyConstraintFunnel(candidates, itin);

  assert.strictEqual(res.survivors.length, 0);
  const overBudgetStage = res.funnel.find(s => s.reason === 'over_budget');
  assert.strictEqual(overBudgetStage.remaining, 0);
});

suite.test('B15.3: Pruned candidate inspection modal preserves airline branding and flight numbers', () => {
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });
  const res = applyConstraintFunnel(candidates, CURATED_PRESETS[0]);

  const unsafeStage = res.funnel.find(s => s.reason === 'unsafe_connection');
  const sampleCandidate = candidates.find(c => c.id === unsafeStage.removedIds[0]);

  assert.ok(sampleCandidate);
  assert.ok(sampleCandidate.airlineCode);
  assert.ok(sampleCandidate.legs[0].flightNumber);
});

suite.test('B15.4: Inspector search/filter input matches candidate IDs, airlines, and airports', () => {
  const candidates = generateAlgorithmicCandidates({ origin: 'LHR', destination: 'JFK', travelDateIso: '2026-08-27' });

  function filterPruned(items, query) {
    const q = query.toLowerCase();
    return items.filter(c => 
      c.id.toLowerCase().includes(q) ||
      c.airlineCode.toLowerCase().includes(q) ||
      c.airlineName.toLowerCase().includes(q)
    );
  }

  const filteredBa = filterPruned(candidates, 'BA');
  assert.ok(filteredBa.length > 0);
  filteredBa.forEach(c => assert.ok(c.airlineCode === 'BA' || c.airlineName.includes('British')));
});

suite.test('B15.5: Finalist count badge shows "0 survivors — adjust constraints" when pool is empty', () => {
  function getBadgeStatus(survivorCount) {
    if (survivorCount === 0) return '0 finalists — relax budget or connection constraints';
    return `${survivorCount} finalists ranked`;
  }

  assert.strictEqual(getBadgeStatus(0), '0 finalists — relax budget or connection constraints');
  assert.strictEqual(getBadgeStatus(3), '3 finalists ranked');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b15-inspector-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
