// tests/tier1-features/f02-presets-catalog.test.mjs
// F2: Curated Business Presets Catalog Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, GLOBAL_AIRPORTS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F2: Curated Business Presets Catalog');

suite.test('F2.1: Preset catalog contains all 6 required global enterprise routes', () => {
  const expectedRoutes = [
    { origin: 'SIN', destination: 'NRT' },
    { origin: 'LHR', destination: 'JFK' },
    { origin: 'SFO', destination: 'HND' },
    { origin: 'SYD', destination: 'LAX' },
    { origin: 'DXB', destination: 'CDG' },
    { origin: 'FRA', destination: 'SIN' },
  ];

  assert.strictEqual(CURATED_PRESETS.length, 6, 'Must contain exactly 6 curated business presets');

  expectedRoutes.forEach(route => {
    const found = CURATED_PRESETS.find(p => p.origin === route.origin && p.destination === route.destination);
    assert.ok(found, `Preset ${route.origin} -> ${route.destination} must exist in catalog`);
  });
});

suite.test('F2.2: Preset SIN-NRT (Singapore to Tokyo Narita) matches canonical fixture', () => {
  const preset = CURATED_PRESETS.find(p => p.tripId === 'TRIP-SIN-NRT-2026');
  assert.ok(preset);
  assert.strictEqual(preset.passenger.name, 'Wei Chen');
  assert.strictEqual(preset.constraints.budgetUsd, 150);
  assert.strictEqual(preset.constraints.mctMin, 60);
  assert.strictEqual(preset.legs.length, 2);
  assert.strictEqual(preset.legs[0].flightNumber, 'SQ856');
  assert.strictEqual(preset.legs[1].flightNumber, 'CX520');
});

suite.test('F2.3: Preset LHR-JFK (London to New York) has direct BA flight and Wall St mission', () => {
  const preset = CURATED_PRESETS.find(p => p.tripId === 'TRIP-LHR-JFK-2026');
  assert.ok(preset);
  assert.strictEqual(preset.passenger.name, 'Eleanor Vance');
  assert.strictEqual(preset.legs.length, 1);
  assert.strictEqual(preset.legs[0].flightNumber, 'BA117');
  assert.strictEqual(preset.legs[0].from, 'LHR');
  assert.strictEqual(preset.legs[0].to, 'JFK');
  assert.strictEqual(preset.mission.dealValue, 180000000);
});

suite.test('F2.4: Preset SFO-HND (San Francisco to Tokyo Haneda) has UA875 and AI summit', () => {
  const preset = CURATED_PRESETS.find(p => p.tripId === 'TRIP-SFO-HND-2026');
  assert.ok(preset);
  assert.strictEqual(preset.passenger.name, 'Marcus Brody');
  assert.strictEqual(preset.legs[0].flightNumber, 'UA875');
  assert.strictEqual(preset.constraints.budgetUsd, 300);
  assert.strictEqual(preset.mission.importance, 'CRITICAL');
});

suite.test('F2.5: Preset SYD-LAX (Sydney to Los Angeles) has QF11 nonstop and Clean Energy mission', () => {
  const preset = CURATED_PRESETS.find(p => p.tripId === 'TRIP-SYD-LAX-2026');
  assert.ok(preset);
  assert.strictEqual(preset.passenger.name, 'Kylie Harrison');
  assert.strictEqual(preset.legs[0].flightNumber, 'QF11');
  assert.strictEqual(preset.legs[0].aircraft, 'A380-800');
  assert.strictEqual(preset.constraints.baggagePieces, 2);
});

suite.test('F2.6: Presets DXB-CDG and FRA-SIN have valid IATA airports and positive durations', () => {
  const dxb = CURATED_PRESETS.find(p => p.tripId === 'TRIP-DXB-CDG-2026');
  const fra = CURATED_PRESETS.find(p => p.tripId === 'TRIP-FRA-SIN-2026');
  
  assert.ok(GLOBAL_AIRPORTS[dxb.origin] && GLOBAL_AIRPORTS[dxb.destination]);
  assert.ok(GLOBAL_AIRPORTS[fra.origin] && GLOBAL_AIRPORTS[fra.destination]);
  
  assert.ok(dxb.legs[0].durationMin > 300, 'DXB-CDG flight duration > 5h');
  assert.ok(fra.legs[0].durationMin > 600, 'FRA-SIN flight duration > 10h');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f02-presets-catalog.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
