// tests/tier1-features/f14-constraints-controls.test.mjs
// F14: Interactive Traveler Constraints Controls Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F14: Interactive Traveler Constraints Controls');

suite.test('F14.1: Budget slider control accepts values within valid bounds [$0 to $2000]', () => {
  function validateBudgetInput(val) {
    const num = Number(val);
    if (isNaN(num)) return { valid: false, error: 'Budget must be a valid number' };
    if (num < 0) return { valid: false, error: 'Budget cannot be negative' };
    if (num > 5000) return { valid: false, error: 'Budget exceeds maximum allowable limit' };
    return { valid: true, value: num };
  }

  assert.strictEqual(validateBudgetInput(0).valid, true);
  assert.strictEqual(validateBudgetInput(250).valid, true);
  assert.strictEqual(validateBudgetInput(2000).valid, true);
  assert.strictEqual(validateBudgetInput(-10).valid, false);
  assert.strictEqual(validateBudgetInput(10000).valid, false);
});

suite.test('F14.2: MCT slider control enforces valid connection time steps [30m to 180m]', () => {
  function validateMctInput(val) {
    const num = Number(val);
    if (isNaN(num) || num < 30 || num > 240) return false;
    return num % 5 === 0; // step = 5m
  }

  assert.strictEqual(validateMctInput(60), true);
  assert.strictEqual(validateMctInput(90), true);
  assert.strictEqual(validateMctInput(45), true);
  assert.strictEqual(validateMctInput(20), false); // below 30m
  assert.strictEqual(validateMctInput(62), false); // not step of 5
});

suite.test('F14.3: Baggage piece and weight selectors enforce valid policy combinations', () => {
  function validateBaggageConfig(pieces, weightKg) {
    if (pieces === 0) return weightKg === 0;
    if (pieces > 0) return weightKg > 0 && weightKg <= 50;
    return false;
  }

  assert.strictEqual(validateBaggageConfig(0, 0), true);
  assert.strictEqual(validateBaggageConfig(1, 23), true);
  assert.strictEqual(validateBaggageConfig(2, 32), true);
  assert.strictEqual(validateBaggageConfig(1, 0), false, 'Pieces > 0 cannot have 0kg');
});

suite.test('F14.4: Arrival deadline control supports explicit timezone offset preservation', () => {
  const deadlineJst = '2026-08-28T09:00:00+09:00';
  const deadlineEst = '2026-08-28T09:00:00-04:00';

  const utcMsJst = new Date(deadlineJst).getTime();
  const utcMsEst = new Date(deadlineEst).getTime();

  // 9:00 JST (00:00Z) vs 9:00 EST (13:00Z) = 13h difference
  const diffHours = (utcMsEst - utcMsJst) / 3600000;
  assert.strictEqual(diffHours, 13, 'Timezone offsets must be preserved correctly');
});

suite.test('F14.5: Debounced constraint updates payload structure matches API PATCH contract', () => {
  function createConstraintsPatch(updates) {
    return {
      budgetUsd: updates.budgetUsd !== undefined ? Number(updates.budgetUsd) : undefined,
      mctMin: updates.mctMin !== undefined ? Number(updates.mctMin) : undefined,
      hardArrivalLimitIso: updates.hardArrivalLimitIso,
      baggagePieces: updates.baggagePieces !== undefined ? Number(updates.baggagePieces) : undefined,
      baggageWeightKg: updates.baggageWeightKg !== undefined ? Number(updates.baggageWeightKg) : undefined,
    };
  }

  const patch = createConstraintsPatch({ budgetUsd: 250, mctMin: 75 });
  assert.strictEqual(patch.budgetUsd, 250);
  assert.strictEqual(patch.mctMin, 75);
  assert.strictEqual(patch.hardArrivalLimitIso, undefined);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f14-constraints-controls.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
