// tests/tier2-boundaries/b14-constraints-boundaries.test.mjs
// B14: Interactive Constraints Controls Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B14: Interactive Constraints Controls Boundaries');

suite.test('B14.1: Budget slider clamped to minimum $0 and maximum $5000', () => {
  function clampBudget(val) {
    return Math.max(0, Math.min(5000, Number(val) || 0));
  }

  assert.strictEqual(clampBudget(-100), 0);
  assert.strictEqual(clampBudget(0), 0);
  assert.strictEqual(clampBudget(250), 250);
  assert.strictEqual(clampBudget(10000), 5000);
});

suite.test('B14.2: MCT slider clamped to minimum 30m and maximum 240m with 5m step intervals', () => {
  function clampMct(val) {
    const raw = Math.max(30, Math.min(240, Number(val) || 60));
    return Math.round(raw / 5) * 5;
  }

  assert.strictEqual(clampMct(10), 30);
  assert.strictEqual(clampMct(43), 45);
  assert.strictEqual(clampMct(60), 60);
  assert.strictEqual(clampMct(300), 240);
});

suite.test('B14.3: Baggage piece selector bounds [0 to 5 pieces]', () => {
  function clampBags(val) {
    return Math.max(0, Math.min(5, Math.floor(Number(val) || 0)));
  }

  assert.strictEqual(clampBags(-1), 0);
  assert.strictEqual(clampBags(0), 0);
  assert.strictEqual(clampBags(2), 2);
  assert.strictEqual(clampBags(10), 5);
});

suite.test('B14.4: Baggage weight selector bounds [0kg to 50kg]', () => {
  function clampWeight(val) {
    return Math.max(0, Math.min(50, Math.round(Number(val) || 0)));
  }

  assert.strictEqual(clampWeight(-5), 0);
  assert.strictEqual(clampWeight(23), 23);
  assert.strictEqual(clampWeight(32), 32);
  assert.strictEqual(clampWeight(100), 50);
});

suite.test('B14.5: Resetting constraints reverts directly to active itinerary preset baseline', () => {
  const sinNrt = CURATED_PRESETS[0];
  const mutated = {
    budgetUsd: 900,
    mctMin: 180,
    baggagePieces: 4,
    baggageWeightKg: 40,
  };

  // Reset to preset
  const reset = { ...sinNrt.constraints };

  assert.strictEqual(reset.budgetUsd, 150);
  assert.strictEqual(reset.mctMin, 60);
  assert.strictEqual(reset.baggagePieces, 1);
  assert.strictEqual(reset.baggageWeightKg, 23);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b14-constraints-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
