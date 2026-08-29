// tests/tier1-features/f05-airports-airlines-kb.test.mjs
// F5: Global Airport & Airline Knowledge Base Tests

import assert from 'node:assert';
import { createTestSuite, GLOBAL_AIRPORTS, GLOBAL_AIRLINES, calculateDistanceKm, calculateFlightDurationMin } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F5: Global Airport & Airline Knowledge Base');

suite.test('F5.1: Airport database includes major global intercontinental hubs across 6 regions', () => {
  const airports = Object.values(GLOBAL_AIRPORTS);
  assert.ok(airports.length >= 40, `Knowledge base should have >=40 airports (got ${airports.length})`);
  
  const regions = new Set(airports.map(a => a.region));
  assert.ok(regions.has('ASIA'), 'Must contain ASIA');
  assert.ok(regions.has('EUROPE'), 'Must contain EUROPE');
  assert.ok(regions.has('NAMER'), 'Must contain NAMER');
  assert.ok(regions.has('OCEANIA'), 'Must contain OCEANIA');
  assert.ok(regions.has('ME_AFRICA'), 'Must contain ME_AFRICA');
  assert.ok(regions.has('SAMER'), 'Must contain SAMER');
});

suite.test('F5.2: Airport database provides accurate geographical coordinates and UTC offsets', () => {
  const sin = GLOBAL_AIRPORTS.SIN;
  const lhr = GLOBAL_AIRPORTS.LHR;
  const jfk = GLOBAL_AIRPORTS.JFK;
  const hnd = GLOBAL_AIRPORTS.HND;

  assert.strictEqual(sin.tzOffset, 8);
  assert.strictEqual(lhr.tzOffset, 1);
  assert.strictEqual(jfk.tzOffset, -4);
  assert.strictEqual(hnd.tzOffset, 9);

  assert.ok(sin.lat > 1 && sin.lat < 2);
  assert.ok(lhr.lat > 50 && lhr.lat < 52);
  assert.ok(jfk.lat > 40 && jfk.lat < 41);
});

suite.test('F5.3: Airline database contains Star Alliance, oneworld, SkyTeam, and LCC carriers', () => {
  const airlines = Object.values(GLOBAL_AIRLINES);
  assert.ok(airlines.length >= 20, `Knowledge base should have >=20 airlines (got ${airlines.length})`);

  const alliances = new Set(airlines.map(a => a.alliance));
  assert.ok(alliances.has('STAR_ALLIANCE'));
  assert.ok(alliances.has('ONEWORLD'));
  assert.ok(alliances.has('SKYTEAM'));
  assert.ok(alliances.has('LCC'));

  airlines.forEach(air => {
    assert.ok(air.otp >= 0.65 && air.otp <= 1.0, `OTP for ${air.code} should be between 0.65 and 1.0`);
    assert.ok(air.defaultAircraft, `Default aircraft required for ${air.code}`);
    assert.ok(air.baggagePolicy, `Baggage policy required for ${air.code}`);
  });
});

suite.test('F5.4: Haversine distance calculator accurately computes great-circle distances', () => {
  // LHR (London) to JFK (New York): approx 5540 km
  const lhr = GLOBAL_AIRPORTS.LHR;
  const jfk = GLOBAL_AIRPORTS.JFK;
  const distLhrJfk = calculateDistanceKm(lhr.lat, lhr.lon, jfk.lat, jfk.lon);
  assert.ok(distLhrJfk >= 5400 && distLhrJfk <= 5700, `LHR-JFK distance should be ~5540km (got ${distLhrJfk}km)`);

  // SIN (Singapore) to NRT (Tokyo): approx 5350 km
  const sin = GLOBAL_AIRPORTS.SIN;
  const nrt = GLOBAL_AIRPORTS.NRT;
  const distSinNrt = calculateDistanceKm(sin.lat, sin.lon, nrt.lat, nrt.lon);
  assert.ok(distSinNrt >= 5200 && distSinNrt <= 5500, `SIN-NRT distance should be ~5350km (got ${distSinNrt}km)`);
});

suite.test('F5.5: Flight duration calculation accounts for block times and cruise velocity', () => {
  // 5540 km flight at 820 km/h + 45m block = 45 + 405m = ~450m (7.5h)
  const duration = calculateFlightDurationMin(5540);
  assert.ok(duration >= 420 && duration <= 480, `Duration for 5540km should be ~450m (got ${duration}m)`);

  const shortHop = calculateFlightDurationMin(350); // e.g. SIN-KUL
  assert.ok(shortHop >= 60 && shortHop <= 80, `Short hop duration should be ~70m (got ${shortHop}m)`);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f05-airports-airlines-kb.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
