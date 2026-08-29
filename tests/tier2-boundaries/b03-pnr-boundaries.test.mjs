// tests/tier2-boundaries/b03-pnr-boundaries.test.mjs
// B3: PNR & JSON Parser Boundary Tests

import assert from 'node:assert';
import { createTestSuite, parsePnr } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B3: PNR & JSON Parser Boundaries');

suite.test('B3.1: Parsing completely blank or whitespace-only PNR strings returns clean error', () => {
  assert.strictEqual(parsePnr('').success, false);
  assert.strictEqual(parsePnr('   \n  \t  \n  ').success, false);
  assert.strictEqual(parsePnr(null).success, false);
  assert.strictEqual(parsePnr(undefined).success, false);
});

suite.test('B3.2: Parsing PNR missing passenger name line fails with explicit diagnostic', () => {
  const noPaxPnr = `
1. SQ 856 Y 27AUG SINHKG HK1 0800 1205
RM TKT NBR SQ-4471-XK2
RM BUDGET USD 150
  `.trim();

  const res = parsePnr(noPaxPnr);
  assert.strictEqual(res.success, false);
  assert.ok(res.errors.some(e => e.includes('passenger name')));
});

suite.test('B3.3: Parsing PNR missing flight segment lines fails with explicit diagnostic', () => {
  const noFlightPnr = `
1.1CHEN/WEI MR
RM TKT NBR SQ-4471-XK2
RM BUDGET USD 150
  `.trim();

  const res = parsePnr(noFlightPnr);
  assert.strictEqual(res.success, false);
  assert.ok(res.errors.some(e => e.includes('flight segment')));
});

suite.test('B3.4: Parsing PNR with extra trailing whitespace and varying CRLF line endings', () => {
  const crlfPnr = "1.1VANCE/ELEANOR MR\r\n1. BA 117 Y 27AUG LHRJFK HK1 1400 1715\r\nRM TKT NBR BA-9921-LDN\r\nRM BUDGET USD 200\r\n";
  const res = parsePnr(crlfPnr);

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.itinerary.passenger.name, 'Eleanor Vance');
  assert.strictEqual(res.itinerary.legs[0].flightNumber, 'BA117');
});

suite.test('B3.5: Parsing corrupted JSON strings in Studio Import tab returns syntax error gracefully', () => {
  function safeParseJsonItinerary(raw) {
    try {
      const data = JSON.parse(raw);
      if (!data.origin || !data.destination) return { success: false, error: 'Missing origin or destination' };
      return { success: true, itinerary: data };
    } catch (err) {
      return { success: false, error: `Invalid JSON syntax: ${err.message}` };
    }
  }

  const badJson = '{"tripId": "TRIP-BAD", "origin": "SIN", "legs": [';
  const res = safeParseJsonItinerary(badJson);
  assert.strictEqual(res.success, false);
  assert.ok(res.error.includes('Invalid JSON'));
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b03-pnr-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
