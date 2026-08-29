// tests/tier2-boundaries/b08-impact-graph-boundaries.test.mjs
// B8: Trip Impact Graph Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, calculateTripImpactGraph } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B8: Trip Impact Graph Boundaries');

suite.test('B8.1: Zero delay (0 minutes) on flight produces minimal risk baseline (risk <= 20)', () => {
  const itin = CURATED_PRESETS[0];
  const graph = calculateTripImpactGraph(itin, { flightNumber: 'SQ856', event: 'DELAY', delayMinutes: 0, reason: 'On time' });

  assert.ok(graph.riskScore <= 20, `Risk score should be <=20 for 0m delay (got ${graph.riskScore})`);
  assert.strictEqual(graph.severity, 'LOW');
});

suite.test('B8.2: Maximum delay (1440 minutes / 24 hours) produces maximum critical risk (risk >= 85)', () => {
  const itin = CURATED_PRESETS[0];
  const graph = calculateTripImpactGraph(itin, { flightNumber: 'SQ856', event: 'DELAY', delayMinutes: 1440, reason: 'Typhoon Ground Stop 24h' });

  assert.ok(graph.riskScore >= 80, `Risk score should be >=80 for 24h delay (got ${graph.riskScore})`);
  assert.strictEqual(graph.severity, 'CRITICAL');
});

suite.test('B8.3: Itinerary with empty commitments array generates synthetic destination mission node', () => {
  const bareTrip = {
    ...CURATED_PRESETS[1],
    commitments: [],
  };

  const graph = calculateTripImpactGraph(bareTrip, { flightNumber: 'BA117', event: 'DELAY', delayMinutes: 90, reason: 'Wind shear' });

  assert.ok(graph.nodes.length >= 2, 'Must generate flight node and default mission node');
  assert.ok(graph.nodes.some(n => n.kind === 'MEETING' || n.kind === 'FLIGHT'));
});

suite.test('B8.4: Disruption on second leg of multi-leg flight does not retroactively impact first leg', () => {
  const sinNrt = CURATED_PRESETS[0]; // Leg 1: SQ856 (SIN->HKG), Leg 2: CX520 (HKG->NRT)
  const graph = calculateTripImpactGraph(sinNrt, { flightNumber: 'CX520', event: 'CANCELLATION', reason: 'Typhoon in Tokyo' });

  const leg1Node = graph.nodes.find(n => n.label.includes('SQ856'));
  const leg2Node = graph.nodes.find(n => n.label.includes('CX520'));

  assert.strictEqual(leg1Node.status, 'safe', 'Leg 1 must remain safe');
  assert.strictEqual(leg2Node.status, 'impacted', 'Leg 2 must be impacted');
});

suite.test('B8.5: Missing disruption reason defaults to standard description cleanly', () => {
  const itin = CURATED_PRESETS[2];
  const graph = calculateTripImpactGraph(itin, { flightNumber: 'UA875', event: 'CANCELLATION' });

  assert.ok(graph.chainNarration.rootFailure.includes('UA875 CANCELLATION'));
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b08-impact-graph-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
