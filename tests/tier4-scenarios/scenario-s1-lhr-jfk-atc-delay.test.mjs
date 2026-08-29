// tests/tier4-scenarios/scenario-s1-lhr-jfk-atc-delay.test.mjs
// Scenario S1: London to New York (LHR → JFK) ATC Slot Delay & Recovery Workflow

import assert from 'node:assert';
import {
  createTestSuite,
  CURATED_PRESETS,
  calculateTripImpactGraph,
  generateAlgorithmicCandidates,
  applyConstraintFunnel,
  rankRecoveryOptions,
  generateEvidenceCsv,
  generateRunReportJson,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Scenario S1: LHR → JFK ATC Slot Delay & Recovery');

suite.test('S1.1: Load LHR-JFK preset (Eleanor Vance, Wall Street M&A deal, $180M deal value)', () => {
  const itin = CURATED_PRESETS.find(p => p.tripId === 'TRIP-LHR-JFK-2026');
  assert.ok(itin);
  assert.strictEqual(itin.passenger.name, 'Eleanor Vance');
  assert.strictEqual(itin.legs[0].flightNumber, 'BA117');
  assert.strictEqual(itin.mission.dealValue, 180000000);
});

suite.test('S1.2: Trigger 3.5h (210m) ATC ground delay on BA117 and evaluate Impact Graph', () => {
  const itin = CURATED_PRESETS[1];
  const disruption = {
    flightNumber: 'BA117',
    event: 'DELAY',
    delayMinutes: 210,
    reason: 'Heathrow European Air Traffic Control slot hold',
  };

  const impact = calculateTripImpactGraph(itin, disruption);
  assert.ok(impact.riskScore >= 25, `Expected elevated risk score (got ${impact.riskScore})`);
  assert.ok(['MEDIUM', 'HIGH', 'CRITICAL'].includes(impact.severity));

  const hotelNode = impact.nodes.find(n => n.kind === 'HOTEL');
  assert.ok(hotelNode, 'Hotel commitment must be present');
});

suite.test('S1.3: Run candidate generator & constraint funnel for LHR-JFK under corporate budget', () => {
  const itin = CURATED_PRESETS[1];
  const candidates = generateAlgorithmicCandidates({
    origin: 'LHR',
    destination: 'JFK',
    travelDateIso: '2026-08-27',
    baseFareUsd: 950,
    budgetCeilingUsd: itin.constraints.budgetUsd,
    mctMin: itin.constraints.mctMin,
  });

  const funnelRes = applyConstraintFunnel(candidates, itin);
  assert.ok(funnelRes.survivors.length >= 1, 'At least 1 candidate should survive constraint funnel');

  const ranked = rankRecoveryOptions(funnelRes.survivors, itin);
  assert.strictEqual(ranked[0].status, 'RECOMMENDED');
  assert.ok(ranked[0].recoveryScore >= 70);
});

suite.test('S1.4: Execute 1-tap recovery rebooking and generate evidence export bundle', () => {
  const itin = CURATED_PRESETS[1];
  const session = {
    tripId: itin.tripId,
    state: 'RECOVERED',
    riskScore: 32,
    itinerary: itin,
    disruption: { flightNumber: 'BA117', event: 'DELAY', delayMinutes: 210 },
    ledger: [
      { id: 'ORD-LHR-001', proposalId: 'opt_a', status: 'CONFIRMED', reference: 'BA-REC-9921', executionTimeMs: 41, createdAtIso: new Date().toISOString() }
    ],
  };

  const csv = generateEvidenceCsv(session);
  assert.ok(csv.includes('HEADER,TRIP_ID,TRIP-LHR-JFK-2026'));
  assert.ok(csv.includes('LEDGER,ENTRY_1_REF,BA-REC-9921'));

  const jsonReport = generateRunReportJson(session);
  assert.doesNotThrow(() => JSON.parse(jsonReport));
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('scenario-s1-lhr-jfk-atc-delay.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
