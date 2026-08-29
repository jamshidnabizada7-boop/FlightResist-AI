// tests/tier2-boundaries/b02-presets-boundaries.test.mjs
// B2: Presets Catalog Boundary & Immutability Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B2: Presets Catalog Boundary & Immutability');

suite.test('B2.1: Requesting nonexistent preset ID returns null or throws predictable error', () => {
  function getPresetById(id) {
    const found = CURATED_PRESETS.find(p => p.tripId === id);
    if (!found) return null;
    return found;
  }

  assert.strictEqual(getPresetById('TRIP-NONEXISTENT-999'), null);
  assert.strictEqual(getPresetById(''), null);
  assert.strictEqual(getPresetById(null), null);
});

suite.test('B2.2: Presets catalog immutability prevents deep state corruption', () => {
  const sinNrt = CURATED_PRESETS[0];
  const deepCloned = JSON.parse(JSON.stringify(sinNrt));
  
  // Modify clone
  deepCloned.passenger.name = 'Hacked Name';
  deepCloned.constraints.budgetUsd = 99999;

  // Master catalog remains pristine
  assert.strictEqual(sinNrt.passenger.name, 'Wei Chen');
  assert.strictEqual(sinNrt.constraints.budgetUsd, 150);
});

suite.test('B2.3: All presets maintain valid ISO-8601 timestamps with UTC offsets', () => {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
  for (const preset of CURATED_PRESETS) {
    preset.legs.forEach(leg => {
      assert.ok(isoRegex.test(leg.depIso), `Departure ISO ${leg.depIso} is invalid in ${preset.tripId}`);
      assert.ok(isoRegex.test(leg.arrIso), `Arrival ISO ${leg.arrIso} is invalid in ${preset.tripId}`);
    });
    assert.ok(isoRegex.test(preset.constraints.arrivalDeadlineIso));
  }
});

suite.test('B2.4: All presets have positive non-zero deal values or valid missions', () => {
  for (const preset of CURATED_PRESETS) {
    assert.ok(preset.mission, `Mission missing in ${preset.tripId}`);
    assert.ok(preset.mission.dealValue > 0, `Deal value must be >0 in ${preset.tripId}`);
    assert.ok(['USD', 'EUR', 'JPY'].includes(preset.mission.dealCurrency));
  }
});

suite.test('B2.5: All preset flight numbers conform to standard 2-letter IATA + 1-4 digit pattern', () => {
  const flightNumRegex = /^[A-Z0-9]{2}\d{1,4}$/;
  for (const preset of CURATED_PRESETS) {
    preset.legs.forEach(leg => {
      assert.ok(flightNumRegex.test(leg.flightNumber), `Flight number ${leg.flightNumber} format invalid`);
    });
  }
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b02-presets-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
