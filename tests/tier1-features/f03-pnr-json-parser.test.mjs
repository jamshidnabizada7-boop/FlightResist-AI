// tests/tier1-features/f03-pnr-json-parser.test.mjs
// F3: PNR & JSON Bi-directional Import/Export Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, formatPnr, parsePnr } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F3: PNR & JSON Bi-directional Import/Export');

suite.test('F3.1: formatPnr produces standard Amadeus/Sabre GDS PNR output', () => {
  const sinNrt = CURATED_PRESETS[0];
  const pnrText = formatPnr(sinNrt);
  
  assert.ok(pnrText.includes('1.1CHEN/WEI MR'), 'Must include passenger line');
  assert.ok(pnrText.includes('SQ 856 Y 27AUG SINHKG HK1 0800 1205'), 'Must include Leg 1 segment line');
  assert.ok(pnrText.includes('CX 520 Y 27AUG HKGNRT HK1 1430 1945'), 'Must include Leg 2 segment line');
  assert.ok(pnrText.includes('RM TKT NBR SQ-4471-XK2'), 'Must include ticket number remark');
  assert.ok(pnrText.includes('RM BUDGET USD 150 MCT 60 BAG 1X23KG'), 'Must include constraint remarks');
});

suite.test('F3.2: parsePnr correctly parses formatted PNR back to structured Itinerary', () => {
  const original = CURATED_PRESETS[1]; // LHR-JFK
  const pnrText = formatPnr(original);
  const result = parsePnr(pnrText);
  
  assert.ok(result.success, 'PNR parsing must succeed');
  assert.ok(result.itinerary, 'Itinerary must be generated');
  assert.strictEqual(result.itinerary.origin, 'LHR');
  assert.strictEqual(result.itinerary.destination, 'JFK');
  assert.strictEqual(result.itinerary.passenger.name, 'Eleanor Vance');
  assert.strictEqual(result.itinerary.passenger.ticketReference, 'BA-9921-LDN');
  assert.strictEqual(result.itinerary.legs.length, 1);
  assert.strictEqual(result.itinerary.legs[0].flightNumber, 'BA117');
  assert.strictEqual(result.itinerary.constraints.budgetUsd, 200);
});

suite.test('F3.3: parsePnr handles multi-segment connecting itineraries seamlessly', () => {
  const original = CURATED_PRESETS[0]; // SIN-HKG-NRT
  const pnrText = formatPnr(original);
  const result = parsePnr(pnrText);
  
  assert.ok(result.success);
  assert.strictEqual(result.itinerary.legs.length, 2);
  assert.strictEqual(result.itinerary.legs[0].from, 'SIN');
  assert.strictEqual(result.itinerary.legs[0].to, 'HKG');
  assert.strictEqual(result.itinerary.legs[1].from, 'HKG');
  assert.strictEqual(result.itinerary.legs[1].to, 'NRT');
});

suite.test('F3.4: Round-trip JSON serialization and deserialization integrity', () => {
  for (const preset of CURATED_PRESETS) {
    const jsonStr = JSON.stringify(preset);
    const parsed = JSON.parse(jsonStr);
    assert.deepStrictEqual(parsed, preset, `JSON roundtrip failed for preset ${preset.tripId}`);
  }
});

suite.test('F3.5: parsePnr rejects invalid and malformed PNR inputs gracefully', () => {
  const emptyRes = parsePnr('');
  assert.strictEqual(emptyRes.success, false);
  assert.ok(emptyRes.errors.length > 0);

  const invalidRes = parsePnr('RANDOM JUNK TEXT THAT IS NOT A PNR');
  assert.strictEqual(invalidRes.success, false);
  assert.ok(invalidRes.errors.length > 0);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f03-pnr-json-parser.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
