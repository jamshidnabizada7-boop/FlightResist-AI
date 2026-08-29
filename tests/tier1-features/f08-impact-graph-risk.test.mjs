// tests/tier1-features/f08-impact-graph-risk.test.mjs
// F8: Dynamic Weighted Trip Impact Graph Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, calculateTripImpactGraph } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F8: Dynamic Weighted Trip Impact Graph');

suite.test('F8.1: Dynamically extracts nodes from arbitrary custom itinerary legs and commitments', () => {
  const sinNrt = CURATED_PRESETS[0]; // 2 legs, 3 commitments
  const graph = calculateTripImpactGraph(sinNrt, { flightNumber: 'SQ856', event: 'CANCELLATION', reason: 'Typhoon' });

  assert.ok(graph.nodes.length >= 5, `Expected >=5 nodes (got ${graph.nodes.length})`);
  const flightNodes = graph.nodes.filter(n => n.kind === 'FLIGHT');
  const cmNodes = graph.nodes.filter(n => ['MEETING', 'HOTEL', 'TRANSFER'].includes(n.kind));

  assert.strictEqual(flightNodes.length, 2, 'Should have 2 flight nodes');
  assert.strictEqual(cmNodes.length, 3, 'Should have 3 commitment nodes');
});

suite.test('F8.2: Dynamic buffer compression correctly elevates downstream commitment risk', () => {
  const lhrJfk = CURATED_PRESETS[1];
  // 4h delay on BA117 arriving at 17:15 -> new arrival 21:15
  const graph = calculateTripImpactGraph(lhrJfk, { flightNumber: 'BA117', event: 'DELAY', delayMinutes: 240, reason: 'ATC Slot Hold' });

  assert.ok(graph.riskScore >= 30, `Risk score should be elevated for 4h delay (got ${graph.riskScore})`);
  assert.ok(['MEDIUM', 'HIGH', 'CRITICAL'].includes(graph.severity));
});

suite.test('F8.3: Critical meeting with deal value heavily weights overall trip risk', () => {
  const sfoHnd = CURATED_PRESETS[2]; // $10M deal keynote
  const cancelGraph = calculateTripImpactGraph(sfoHnd, { flightNumber: 'UA875', event: 'CANCELLATION', reason: 'Engine Maintenance' });

  assert.ok(cancelGraph.riskScore >= 75, `Cancellation on critical deal trip must produce risk >=75 (got ${cancelGraph.riskScore})`);
  assert.strictEqual(cancelGraph.severity, 'CRITICAL');
});

suite.test('F8.4: Node weights strictly sum to 1.0 (normalized)', () => {
  for (const preset of CURATED_PRESETS) {
    const graph = calculateTripImpactGraph(preset, { flightNumber: preset.legs[0].flightNumber, event: 'DELAY', delayMinutes: 60, reason: 'Late inbound' });
    const sumWeight = graph.nodes.reduce((s, n) => s + n.weight, 0);
    assert.ok(Math.abs(sumWeight - 1.0) < 0.001, `Node weights must sum to 1.0 (got ${sumWeight})`);
  }
});

suite.test('F8.5: Causal chain narration contains rootFailure, cascade, and primaryConsequence', () => {
  const dxbCdg = CURATED_PRESETS[4];
  const graph = calculateTripImpactGraph(dxbCdg, { flightNumber: 'EK73', event: 'CANCELLATION', reason: 'Hydraulic System Fault' });

  assert.ok(graph.chainNarration, 'Chain narration must be populated');
  assert.ok(graph.chainNarration.rootFailure.includes('EK73 CANCELLATION'));
  assert.ok(Array.isArray(graph.chainNarration.cascade));
  assert.ok(graph.chainNarration.primaryConsequence.length > 0);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f08-impact-graph-risk.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
