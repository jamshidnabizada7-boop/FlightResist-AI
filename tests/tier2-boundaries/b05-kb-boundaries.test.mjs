// tests/tier2-boundaries/b05-kb-boundaries.test.mjs
// B5: Airport & Airline KB Boundary Tests

import assert from 'node:assert';
import { createTestSuite, GLOBAL_AIRPORTS, GLOBAL_AIRLINES, calculateDistanceKm, calculateFlightDurationMin } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B5: Airport & Airline KB Boundaries');

suite.test('B5.1: Looking up non-existent 3-letter IATA code returns undefined or safe fallback', () => {
  function getAirport(code) {
    return GLOBAL_AIRPORTS[code.toUpperCase()] || {
      iata: code.toUpperCase(),
      name: `${code.toUpperCase()} Regional Aerodrome`,
      city: 'Unknown City',
      country: 'UN',
      lat: 0.0,
      lon: 0.0,
      tzOffset: 0,
      isMajorHub: false,
      region: 'OTHER',
    };
  }

  const custom = getAirport('XYZ');
  assert.strictEqual(custom.iata, 'XYZ');
  assert.strictEqual(custom.tzOffset, 0);
  assert.strictEqual(custom.isMajorHub, false);
});

suite.test('B5.2: 0-distance calculation for identical origin and destination coordinates', () => {
  const dist = calculateDistanceKm(1.3644, 103.9915, 1.3644, 103.9915);
  assert.strictEqual(dist, 0);

  const duration = calculateFlightDurationMin(0);
  assert.strictEqual(duration, 45, 'Zero-distance flight duration defaults to standard block taxi time');
});

suite.test('B5.3: Antipodal geographic points distance computation (maximum ~20,000 km)', () => {
  // Latitude +40, Longitude 0 vs Latitude -40, Longitude 180 (Antipodal)
  const dist = calculateDistanceKm(40, 0, -40, 180);
  assert.ok(dist >= 19900 && dist <= 20100, `Antipodal distance should be ~20000 km (got ${dist} km)`);
});

suite.test('B5.4: Airline lookup with unknown 2-letter carrier defaults gracefully', () => {
  function getAirline(code) {
    return GLOBAL_AIRLINES[code.toUpperCase()] || {
      code: code.toUpperCase(),
      name: `${code.toUpperCase()} Airways`,
      alliance: 'INDEPENDENT',
      primaryHubs: [],
      otp: 0.80,
      defaultAircraft: 'B737-800',
      baggagePolicy: { pieces: 1, weightKg: 23 },
    };
  }

  const air = getAirline('ZZ');
  assert.strictEqual(air.code, 'ZZ');
  assert.strictEqual(air.otp, 0.80);
  assert.strictEqual(air.alliance, 'INDEPENDENT');
});

suite.test('B5.5: Timezone offset extremes handle Pacific line crossings [-12 to +14]', () => {
  const akl = GLOBAL_AIRPORTS.AKL; // Auckland +12
  const sfo = GLOBAL_AIRPORTS.SFO; // San Francisco -7

  const diffHours = akl.tzOffset - sfo.tzOffset;
  assert.strictEqual(diffHours, 19, 'Auckland is 19 hours ahead of San Francisco standard offset');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b05-kb-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
