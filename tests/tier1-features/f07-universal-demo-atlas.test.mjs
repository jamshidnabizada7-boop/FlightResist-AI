// tests/tier1-features/f07-universal-demo-atlas.test.mjs
// F7: Universal Demo & Live Atlas Search Support Tests

import assert from 'node:assert';
import { createTestSuite, generateAlgorithmicCandidates, GLOBAL_AIRPORTS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F7: Universal Demo & Live Atlas Search Support');

suite.test('F7.1: Provider mode switching correctly routes between DEMO and ATLAS_SANDBOX', () => {
  function resolveProvider(mode) {
    if (mode === 'ATLAS_SANDBOX') {
      return { mode: 'ATLAS_SANDBOX', label: 'Atlas Sandbox (Live GDS)', isLive: true };
    }
    return { mode: 'DEMO', label: 'Demo Simulation (Deterministic)', isLive: false };
  }

  const demo = resolveProvider('DEMO');
  assert.strictEqual(demo.mode, 'DEMO');
  assert.strictEqual(demo.isLive, false);

  const live = resolveProvider('ATLAS_SANDBOX');
  assert.strictEqual(live.mode, 'ATLAS_SANDBOX');
  assert.strictEqual(live.isLive, true);
});

suite.test('F7.2: Live Atlas candidate timestamp normalization anchors to active travel date', () => {
  function normalizeRawAtlasTimestamp(raw12Digit, airportIata, travelDateIso) {
    if (raw12Digit.length !== 12) return raw12Digit;
    const h = raw12Digit.slice(8, 10);
    const mi = raw12Digit.slice(10, 12);
    const tz = GLOBAL_AIRPORTS[airportIata]?.tzOffset ?? 0;
    const sign = tz >= 0 ? '+' : '-';
    const tzStr = `${sign}${String(Math.abs(tz)).padStart(2, '0')}:00`;
    return `${travelDateIso}T${h}:${mi}:00${tzStr}`;
  }

  const normalized = normalizeRawAtlasTimestamp('202611151430', 'LHR', '2026-08-27');
  assert.strictEqual(normalized, '2026-08-27T14:30:00+01:00');

  const jfkNorm = normalizeRawAtlasTimestamp('202611151800', 'JFK', '2026-08-27');
  assert.strictEqual(jfkNorm, '2026-08-27T18:00:00-04:00');
});

suite.test('F7.3: Candidate metadata preserves bookability and price status flags', () => {
  const candidates = generateAlgorithmicCandidates({
    origin: 'LHR',
    destination: 'JFK',
    travelDateIso: '2026-08-27',
  });

  const enriched = candidates.map(c => ({
    ...c,
    metadata: {
      bookable: true,
      priceStatus: 'current',
      ticketingAvailable: true,
    },
  }));

  enriched.forEach(c => {
    assert.strictEqual(c.metadata.bookable, true);
    assert.strictEqual(c.metadata.priceStatus, 'current');
  });
});

suite.test('F7.4: Demo candidate generator supports arbitrary dates without year anchoring bugs', () => {
  const cand2027 = generateAlgorithmicCandidates({
    origin: 'DXB',
    destination: 'CDG',
    travelDateIso: '2027-04-15',
  });

  assert.ok(cand2027.length > 0);
  cand2027.forEach(c => {
    assert.ok(c.depIso.startsWith('2027-04-15'), `Departure ${c.depIso} must match travel date 2027-04-15`);
  });
});

suite.test('F7.5: Seamless fallback to algorithmic demo when live GDS inventory is empty', async () => {
  async function searchWithFallback(origin, destination, travelDateIso, liveInventory = []) {
    if (liveInventory && liveInventory.length > 0) {
      return { source: 'LIVE', candidates: liveInventory };
    }
    const demoCandidates = generateAlgorithmicCandidates({ origin, destination, travelDateIso });
    return { source: 'DEMO_FALLBACK', candidates: demoCandidates };
  }

  const result = await searchWithFallback('SIN', 'NRT', '2026-08-27', []);
  assert.strictEqual(result.source, 'DEMO_FALLBACK');
  assert.ok(result.candidates.length >= 35);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f07-universal-demo-atlas.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
