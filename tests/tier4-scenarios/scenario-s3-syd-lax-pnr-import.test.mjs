// tests/tier4-scenarios/scenario-s3-syd-lax-pnr-import.test.mjs
// Scenario S3: Sydney to Los Angeles (SYD → LAX) PNR Import, Disruption, & Evidence Export

import assert from 'node:assert';
import {
  createTestSuite,
  formatPnr,
  parsePnr,
  CURATED_PRESETS,
  calculateTripImpactGraph,
  generateAlgorithmicCandidates,
  applyConstraintFunnel,
  rankRecoveryOptions,
  generateEvidenceCsv,
  generateRunReportJson,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Scenario S3: SYD → LAX PNR Import & Evidence Export');

suite.test('S3.1: Format and import raw GDS PNR for Kylie Harrison (QF11 SYD → LAX)', () => {
  const original = CURATED_PRESETS.find(p => p.tripId === 'TRIP-SYD-LAX-2026');
  const pnrText = formatPnr(original);

  const parsed = parsePnr(pnrText);
  assert.ok(parsed.success);
  assert.strictEqual(parsed.itinerary.origin, 'SYD');
  assert.strictEqual(parsed.itinerary.destination, 'LAX');
  assert.strictEqual(parsed.itinerary.passenger.name, 'Kylie Harrison');
  assert.strictEqual(parsed.itinerary.legs[0].flightNumber, 'QF11');
});

suite.test('S3.2: Simulate 5-hour transpacific weather diversion / delay on QF11', () => {
  const itin = CURATED_PRESETS[3];
  const disruption = {
    flightNumber: 'QF11',
    event: 'DELAY',
    delayMinutes: 300,
    reason: 'Severe Pacific jetstream turbulence diversion to Honolulu',
  };

  const graph = calculateTripImpactGraph(itin, disruption);
  assert.ok(impactSeverityValid(graph.severity));
  assert.ok(graph.riskScore >= 20);
});

function impactSeverityValid(s) {
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(s);
}

suite.test('S3.3: Live constraint recalculation and proposal generation', () => {
  const itin = CURATED_PRESETS[3];
  const candidates = generateAlgorithmicCandidates({
    origin: 'SYD',
    destination: 'LAX',
    travelDateIso: '2026-08-27',
    baseFareUsd: 1300,
    budgetCeilingUsd: itin.constraints.budgetUsd,
    mctMin: itin.constraints.mctMin,
  });

  const res = applyConstraintFunnel(candidates, itin);
  assert.ok(res.survivors.length > 0);

  const ranked = rankRecoveryOptions(res.survivors, itin);
  assert.ok(ranked.length <= 3);
});

suite.test('S3.4: Complete evidence archive generation (Evidence CSV & JSON report)', () => {
  const session = {
    tripId: 'TRIP-SYD-LAX-2026',
    state: 'RECOVERED',
    riskScore: 38,
    itinerary: CURATED_PRESETS[3],
    disruption: { flightNumber: 'QF11', event: 'DELAY', delayMinutes: 300 },
    ledger: [{ id: 'TX-SYD-01', status: 'CONFIRMED', reference: 'QF-REC-1109' }],
  };

  const csv = generateEvidenceCsv(session);
  assert.ok(csv.includes('HEADER,TRIP_ID,TRIP-SYD-LAX-2026'));
  assert.ok(csv.includes('PASSENGER,NAME,"Kylie Harrison"'));

  const json = generateRunReportJson(session);
  assert.doesNotThrow(() => JSON.parse(json));
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('scenario-s3-syd-lax-pnr-import.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
