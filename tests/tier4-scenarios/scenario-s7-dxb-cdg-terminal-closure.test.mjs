// tests/tier4-scenarios/scenario-s7-dxb-cdg-terminal-closure.test.mjs
// Scenario S7: Dubai to Paris (DXB → CDG) Terminal Closure & Multi-Hub Re-Routing

import assert from 'node:assert';
import {
  createTestSuite,
  CURATED_PRESETS,
  calculateTripImpactGraph,
  generateAlgorithmicCandidates,
  applyConstraintFunnel,
  rankRecoveryOptions,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Scenario S7: DXB → CDG Terminal Closure & Re-Routing');

suite.test('S7.1: Load DXB-CDG preset (Tariq Al-Mansoor, Paris Aviation Syndicate Signing, €450M deal)', () => {
  const itin = CURATED_PRESETS.find(p => p.tripId === 'TRIP-DXB-CDG-2026');
  assert.ok(itin);
  assert.strictEqual(itin.passenger.name, 'Tariq Al-Mansoor');
  assert.strictEqual(itin.mission.dealValue, 450000000);
  assert.strictEqual(itin.mission.dealCurrency, 'EUR');
  assert.strictEqual(itin.legs[0].cabin, 'First Class');
});

suite.test('S7.2: Sudden terminal closure at DXB impacts EK73 and elevates risk to CRITICAL', () => {
  const itin = CURATED_PRESETS[4];
  const disruption = {
    flightNumber: 'EK73',
    event: 'TERMINAL_CLOSURE',
    affectedHub: 'DXB',
    reason: 'Major infrastructure power substation fault at Terminal 3',
  };

  const graph = calculateTripImpactGraph(itin, disruption);
  assert.ok(graph.riskScore >= 70, `Terminal closure risk must be >=70 (got ${graph.riskScore})`);
  assert.strictEqual(graph.severity, 'CRITICAL');
});

suite.test('S7.3: Generate candidate flights avoiding affected terminal and connecting via DOH/IST/FRA', () => {
  const itin = CURATED_PRESETS[4];
  const candidates = generateAlgorithmicCandidates({
    origin: 'DXB',
    destination: 'CDG',
    travelDateIso: '2026-08-27',
    baseFareUsd: 1800,
    budgetCeilingUsd: itin.constraints.budgetUsd,
    mctMin: itin.constraints.mctMin,
  });

  const funnelRes = applyConstraintFunnel(candidates, itin);
  assert.ok(funnelRes.survivors.length > 0);

  const ranked = rankRecoveryOptions(funnelRes.survivors, itin);
  assert.strictEqual(ranked[0].status, 'RECOMMENDED');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('scenario-s7-dxb-cdg-terminal-closure.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
