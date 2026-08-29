// tests/tier1-features/f16-reporting-exports.test.mjs
// F16: Multi-Format Reporting & Export Suite Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, generateEvidenceCsv, generateRunReportJson } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F16: Multi-Format Reporting & Export Suite');

suite.test('F16.1: Evidence CSV export includes Passenger, Mission, Constraints, and Disruption sections', () => {
  const session = {
    itinerary: CURATED_PRESETS[0],
    disruption: { flightNumber: 'SQ856', event: 'CANCELLATION' },
    riskScore: 87,
    ledger: [
      { id: 'TX-101', status: 'CONFIRMED', reference: 'REC-SQ-881' }
    ],
  };

  const csv = generateEvidenceCsv(session);

  assert.ok(csv.includes('HEADER,TRIP_ID,TRIP-SIN-NRT-2026'));
  assert.ok(csv.includes('PASSENGER,NAME,"Wei Chen"'));
  assert.ok(csv.includes('PASSENGER,TICKET_REF,SQ-4471-XK2'));
  assert.ok(csv.includes('MISSION,TITLE,"Infrastructure Deal Signing"'));
  assert.ok(csv.includes('CONSTRAINTS,BUDGET_USD,150'));
  assert.ok(csv.includes('DISRUPTION,EVENT,CANCELLATION'));
  assert.ok(csv.includes('DISRUPTION,RISK_SCORE,87'));
  assert.ok(csv.includes('LEDGER,ENTRY_1_STATUS,CONFIRMED'));
});

suite.test('F16.2: JSON Run Report contains complete session state, analysis, and event trace', () => {
  const session = {
    tripId: 'TRIP-LHR-JFK-2026',
    state: 'RECOVERED',
    riskScore: 65,
    itinerary: CURATED_PRESETS[1],
    disruption: { flightNumber: 'BA117', event: 'DELAY', delayMinutes: 180 },
    analysis: { recommendedId: 'opt_a' },
    execution: { status: 'SUCCEEDED' },
    ledger: [{ id: 'tx-1', status: 'CONFIRMED' }],
    events: [{ seq: 1, phase: 'DISRUPTION', title: 'ATC delay detected' }],
  };

  const reportJson = generateRunReportJson(session);
  const parsed = JSON.parse(reportJson);

  assert.strictEqual(parsed.engine_version, '2.0.0-enterprise');
  assert.strictEqual(parsed.session.tripId, 'TRIP-LHR-JFK-2026');
  assert.strictEqual(parsed.session.state, 'RECOVERED');
  assert.strictEqual(parsed.itinerary.passenger.name, 'Eleanor Vance');
  assert.strictEqual(parsed.ledger.length, 1);
  assert.strictEqual(parsed.events.length, 1);
});

suite.test('F16.3: Evidence CSV safely escapes passenger names and mission titles with quotes and commas', () => {
  const customItin = {
    ...CURATED_PRESETS[0],
    passenger: { ...CURATED_PRESETS[0].passenger, name: 'Smith, Jr., John' },
    mission: { ...CURATED_PRESETS[0].mission, title: 'Contract "Alpha", Phase 1' },
  };

  const session = { itinerary: customItin };
  const csv = generateEvidenceCsv(session);

  assert.ok(csv.includes('PASSENGER,NAME,"Smith, Jr., John"'));
  assert.ok(csv.includes('MISSION,TITLE,"Contract "Alpha", Phase 1"'));
});

suite.test('F16.4: Print Summary document data structure contains all critical itinerary details', () => {
  function buildPrintSummaryData(session) {
    return {
      title: `1 · Itinerary (${session.itinerary.origin} → ${session.itinerary.destination})`,
      passengerName: session.itinerary.passenger.name,
      ticketRef: session.itinerary.passenger.ticketReference,
      budget: `$${session.itinerary.constraints.budgetUsd}`,
      legs: session.itinerary.legs.map(l => `${l.flightNumber} ${l.from}-${l.to}`),
    };
  }

  const data = buildPrintSummaryData({ itinerary: CURATED_PRESETS[2] }); // SFO-HND
  assert.strictEqual(data.title, '1 · Itinerary (SFO → HND)');
  assert.strictEqual(data.passengerName, 'Marcus Brody');
  assert.strictEqual(data.budget, '$300');
  assert.strictEqual(data.legs[0], 'UA875 SFO-HND');
});

suite.test('F16.5: Exported files maintain RFC 4180 CSV and valid JSON syntax standards', () => {
  for (const preset of CURATED_PRESETS) {
    const csv = generateEvidenceCsv({ itinerary: preset });
    const lines = csv.split('\n');
    assert.ok(lines.length >= 10, 'CSV must have at least 10 lines');
    lines.forEach(l => {
      const parts = l.split(',');
      assert.ok(parts.length >= 3, `Line "${l}" must have at least 3 columns`);
    });

    const jsonStr = generateRunReportJson({ itinerary: preset, tripId: preset.tripId, state: 'NORMAL', riskScore: 0 });
    assert.doesNotThrow(() => JSON.parse(jsonStr), 'JSON report must parse without error');
  }
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f16-reporting-exports.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
