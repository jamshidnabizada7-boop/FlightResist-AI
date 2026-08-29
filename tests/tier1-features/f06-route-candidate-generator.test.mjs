// tests/tier1-features/f06-route-candidate-generator.test.mjs
// F6: Algorithmic Route & Candidate Generator Tests

import assert from 'node:assert';
import { createTestSuite, generateAlgorithmicCandidates } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F6: Algorithmic Route & Candidate Generator');

suite.test('F6.1: Generates 35-45 candidates for non-SIN-NRT arbitrary city pairs (LHR -> JFK)', () => {
  const candidates = generateAlgorithmicCandidates({
    origin: 'LHR',
    destination: 'JFK',
    travelDateIso: '2026-08-27',
    baseFareUsd: 900,
    budgetCeilingUsd: 200,
    mctMin: 90,
  });

  assert.ok(candidates.length >= 35 && candidates.length <= 45, `Expected 35-45 candidates (got ${candidates.length})`);
  
  candidates.forEach(c => {
    assert.ok(c.id, 'Candidate ID required');
    assert.ok(c.fareKey, 'Fare key required');
    assert.ok(c.depIso && c.arrIso, 'Timestamps required');
    assert.ok(c.legs.length >= 1, 'At least 1 leg required');
  });
});

suite.test('F6.2: Synthesizes both direct and single-hub connecting topologies', () => {
  const candidates = generateAlgorithmicCandidates({
    origin: 'SFO',
    destination: 'HND',
    travelDateIso: '2026-08-27',
    baseFareUsd: 1100,
    budgetCeilingUsd: 300,
  });

  const direct = candidates.filter(c => c.stops === 0);
  const oneStop = candidates.filter(c => c.stops === 1);

  assert.ok(direct.length >= 4, `Should have >=4 direct flights (got ${direct.length})`);
  assert.ok(oneStop.length >= 25, `Should have >=25 connecting flights (got ${oneStop.length})`);

  oneStop.forEach(c => {
    assert.strictEqual(c.legs.length, 2);
    assert.strictEqual(c.layovers.length, 1);
    assert.ok(c.minConnectionMin > 0);
  });
});

suite.test('F6.3: Candidate pool distributes across all 4 decision funnel categories', () => {
  const candidates = generateAlgorithmicCandidates({
    origin: 'SYD',
    destination: 'LAX',
    travelDateIso: '2026-08-27',
    budgetCeilingUsd: 250,
    mctMin: 75,
  });

  const classes = candidates.map(c => c.fixtureClass);
  assert.ok(classes.includes('over_budget'), 'Must include over_budget candidates');
  assert.ok(classes.includes('unsafe_connection'), 'Must include unsafe_connection candidates');
  assert.ok(classes.includes('baggage_incompatible'), 'Must include baggage_incompatible candidates');
  assert.ok(classes.includes('finalist'), 'Must include finalist candidates');
});

suite.test('F6.4: Deterministic canonical fixture for SIN -> NRT matches 42 candidates', () => {
  const candidates = generateAlgorithmicCandidates({
    origin: 'SIN',
    destination: 'NRT',
    travelDateIso: '2026-08-27',
    isCanonicalDemo: true,
  });

  assert.strictEqual(candidates.length, 42, 'Canonical demo must produce exactly 42 candidates');
  
  const finalists = candidates.filter(c => c.fixtureClass === 'finalist');
  assert.strictEqual(finalists.length, 3, 'Must have exactly 3 finalists in canonical demo');
});

suite.test('F6.5: Layover calculations enforce positive chronological connection windows', () => {
  const candidates = generateAlgorithmicCandidates({
    origin: 'FRA',
    destination: 'SIN',
    travelDateIso: '2026-08-27',
  });

  const connecting = candidates.filter(c => c.stops === 1);
  connecting.forEach(c => {
    const leg1Arr = new Date(c.legs[0].arrIso).getTime();
    const leg2Dep = new Date(c.legs[1].depIso).getTime();
    assert.ok(leg2Dep > leg1Arr, 'Leg 2 departure must be strictly after Leg 1 arrival');
    const diffMin = Math.round((leg2Dep - leg1Arr) / 60000);
    assert.strictEqual(c.minConnectionMin, diffMin, 'minConnectionMin must match calculated interval');
  });
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f06-route-candidate-generator.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
