// tests/tier4-scenarios/scenario-s8-fra-sin-multi-leg-misconnect.test.mjs
// Scenario S8: Frankfurt to Singapore (FRA → SIN) Multi-Leg Inbound Misconnect

import assert from 'node:assert';
import {
  createTestSuite,
  CURATED_PRESETS,
  calculateTripImpactGraph,
  generateAlgorithmicCandidates,
  applyConstraintFunnel,
  rankRecoveryOptions,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Scenario S8: FRA → SIN Multi-Leg Misconnect Recovery');

suite.test('S8.1: Load FRA-SIN preset (Dr. Hans Richter, Biomedical Supply Chain Accord, €95M)', () => {
  const itin = CURATED_PRESETS.find(p => p.tripId === 'TRIP-FRA-SIN-2026');
  assert.ok(itin);
  assert.strictEqual(itin.passenger.name, 'Dr. Hans Richter');
  assert.strictEqual(itin.mission.importance, 'HIGH');
  assert.strictEqual(itin.legs[0].flightNumber, 'LH778');
});

suite.test('S8.2: Simulate 180m delay on feeder flight creating guaranteed misconnect at hub', () => {
  const itin = CURATED_PRESETS[5];
  const disruption = {
    flightNumber: 'LH778',
    event: 'MISCONNECT',
    delayMinutes: 180,
    reason: 'Inbound feeder aircraft delay from Munich',
  };

  const graph = calculateTripImpactGraph(itin, disruption);
  assert.ok(graph.riskScore >= 40);
});

suite.test('S8.3: Filter and rank alternative intercontinental routes to Singapore Changi', () => {
  const itin = CURATED_PRESETS[5];
  const candidates = generateAlgorithmicCandidates({
    origin: 'FRA',
    destination: 'SIN',
    travelDateIso: '2026-08-27',
    baseFareUsd: 1400,
    budgetCeilingUsd: itin.constraints.budgetUsd,
    mctMin: itin.constraints.mctMin,
  });

  const res = applyConstraintFunnel(candidates, itin);
  assert.ok(res.survivors.length > 0);

  const ranked = rankRecoveryOptions(res.survivors, itin);
  assert.strictEqual(ranked[0].status, 'RECOMMENDED');
  assert.ok(ranked[0].scores.arrival > 0);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('scenario-s8-fra-sin-multi-leg-misconnect.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
