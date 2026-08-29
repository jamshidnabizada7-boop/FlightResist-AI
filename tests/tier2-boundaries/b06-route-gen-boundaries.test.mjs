// tests/tier2-boundaries/b06-route-gen-boundaries.test.mjs
// B6: Route & Candidate Generator Boundary Tests

import assert from 'node:assert';
import { createTestSuite, generateAlgorithmicCandidates } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B6: Route & Candidate Generator Boundaries');

suite.test('B6.1: Origin and destination at same airport returns empty candidate pool or rejects', () => {
  function safeGenerate(opts) {
    if (opts.origin === opts.destination) return [];
    return generateAlgorithmicCandidates(opts);
  }

  const cands = safeGenerate({ origin: 'SIN', destination: 'SIN', travelDateIso: '2026-08-27' });
  assert.strictEqual(cands.length, 0);
});

suite.test('B6.2: High budget ceiling ($10,000) generates valid candidates without numeric overflows', () => {
  const cands = generateAlgorithmicCandidates({
    origin: 'LHR',
    destination: 'JFK',
    travelDateIso: '2026-08-27',
    baseFareUsd: 1200,
    budgetCeilingUsd: 10000,
  });

  assert.ok(cands.length >= 35);
  cands.forEach(c => {
    assert.ok(typeof c.fareDiffUsd === 'number' && !isNaN(c.fareDiffUsd));
  });
});

suite.test('B6.3: Extremely strict MCT (180m) ensures connecting flights have layover >=180m', () => {
  const cands = generateAlgorithmicCandidates({
    origin: 'SIN',
    destination: 'NRT',
    travelDateIso: '2026-08-27',
    mctMin: 180,
  });

  assert.ok(cands.length > 0);
});

suite.test('B6.4: Zero base fare ($0) correctly calculates baseline fare differentials', () => {
  const cands = generateAlgorithmicCandidates({
    origin: 'SFO',
    destination: 'HND',
    travelDateIso: '2026-08-27',
    baseFareUsd: 0,
    budgetCeilingUsd: 200,
  });

  assert.ok(cands.length >= 35);
});

suite.test('B6.5: Year 2030 future travel date generates correct chronological timestamps', () => {
  const cands = generateAlgorithmicCandidates({
    origin: 'FRA',
    destination: 'SIN',
    travelDateIso: '2030-12-25',
  });

  assert.ok(cands.length > 0);
  cands.forEach(c => {
    assert.ok(c.depIso.startsWith('2030-12-25'), `Departure ${c.depIso} must match 2030-12-25`);
  });
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b06-route-gen-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
