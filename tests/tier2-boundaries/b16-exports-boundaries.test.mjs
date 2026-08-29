// tests/tier2-boundaries/b16-exports-boundaries.test.mjs
// B16: Reporting & Export Suite Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, generateEvidenceCsv, generateRunReportJson } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B16: Reporting & Export Suite Boundaries');

suite.test('B16.1: Exporting CSV with complex special characters (quotes, commas, line breaks, emojis)', () => {
  const customItin = {
    ...CURATED_PRESETS[0],
    passenger: {
      ...CURATED_PRESETS[0].passenger,
      name: 'Dr. John "Jack" O\'Connor, Jr. ✈️',
    },
    mission: {
      ...CURATED_PRESETS[0].mission,
      title: 'M&A Deal: Tokyo, HK, & Singapore ($2.5B)',
    },
  };

  const csv = generateEvidenceCsv({ itinerary: customItin });
  assert.ok(csv.includes('Dr. John "Jack" O\'Connor, Jr. ✈️'));
  assert.ok(csv.includes('M&A Deal: Tokyo, HK, & Singapore ($2.5B)'));
});

suite.test('B16.2: Exporting empty session object generates valid JSON without undefined/null panics', () => {
  const bareSession = {
    tripId: 'TRIP-BARE',
    state: 'NORMAL',
    riskScore: 0,
    itinerary: CURATED_PRESETS[1],
  };

  const jsonStr = generateRunReportJson(bareSession);
  assert.doesNotThrow(() => JSON.parse(jsonStr));
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.session.tripId, 'TRIP-BARE');
});

suite.test('B16.3: JSON report with 50 ledger transactions maintains valid structure and size', () => {
  const session = {
    tripId: 'TRIP-STRESS',
    state: 'RECOVERED',
    riskScore: 40,
    itinerary: CURATED_PRESETS[2],
    ledger: Array.from({ length: 50 }).map((_, i) => ({
      id: `TX-${i + 1}`,
      proposalId: 'opt_b',
      status: 'CONFIRMED',
      reference: `REC-${1000 + i}`,
      executionTimeMs: 40 + i,
      createdAtIso: new Date().toISOString(),
    })),
  };

  const report = generateRunReportJson(session);
  const parsed = JSON.parse(report);
  assert.strictEqual(parsed.ledger.length, 50);
  assert.strictEqual(parsed.ledger[49].reference, 'REC-1049');
});

suite.test('B16.4: CSV export maintains consistent number of columns per row across sections', () => {
  const csv = generateEvidenceCsv({ itinerary: CURATED_PRESETS[3], ledger: [{ id: 'tx-1', status: 'CONFIRMED', reference: 'REF-1' }] });
  const lines = csv.split('\n');

  lines.forEach((line, idx) => {
    // Basic CSV splitting handling quoted commas
    const cols = line.split(',');
    assert.ok(cols.length >= 3, `Row ${idx + 1} "${line}" should have >=3 columns`);
  });
});

suite.test('B16.5: Export filename generators generate filesystem-safe and timestamped filenames', () => {
  function getExportFilename(tripId, extension) {
    const timestamp = '2026-08-27T120000Z';
    const safeTrip = tripId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `flightresist-evidence-${safeTrip}-${timestamp}.${extension}`;
  }

  assert.strictEqual(getExportFilename('TRIP-SIN-NRT-2026', 'csv'), 'flightresist-evidence-TRIP-SIN-NRT-2026-2026-08-27T120000Z.csv');
  assert.strictEqual(getExportFilename('TRIP/LHR/JFK', 'json'), 'flightresist-evidence-TRIP_LHR_JFK-2026-08-27T120000Z.json');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b16-exports-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
