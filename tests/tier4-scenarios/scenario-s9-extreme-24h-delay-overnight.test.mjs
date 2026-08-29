// tests/tier4-scenarios/scenario-s9-extreme-24h-delay-overnight.test.mjs
// Scenario S9: Extreme 24-Hour Delay Overnight Rescheduling & Multi-Day Impact

import assert from 'node:assert';
import {
  createTestSuite,
  CURATED_PRESETS,
  calculateTripImpactGraph,
  generateAlgorithmicCandidates,
  applyConstraintFunnel,
  rankRecoveryOptions,
  generateRunReportJson,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Scenario S9: Extreme 24h Delay Overnight Rescheduling');

suite.test('S9.1: 24h (1440m) delay collapses all scheduled mission commitments', () => {
  const itin = CURATED_PRESETS[0];
  const disruption = {
    flightNumber: 'SQ856',
    event: 'DELAY',
    delayMinutes: 1440,
    reason: 'Severe volcanic ash cloud airspace closure',
  };

  const graph = calculateTripImpactGraph(itin, disruption);
  assert.ok(graph.riskScore >= 80, `24h delay risk must be >=80 (got ${graph.riskScore})`);
  assert.strictEqual(graph.severity, 'CRITICAL');
});

suite.test('S9.2: Constraint evaluation with relaxed multi-day arrival window discovers next-day alternatives', () => {
  const itin = {
    ...CURATED_PRESETS[0],
    constraints: {
      ...CURATED_PRESETS[0].constraints,
      hardArrivalLimitIso: '2026-08-29T23:59:00+09:00', // Extended by 24h
      budgetUsd: 500,
    }
  };

  const candidates = generateAlgorithmicCandidates({
    origin: 'SIN',
    destination: 'NRT',
    travelDateIso: '2026-08-27',
    baseFareUsd: 800,
    budgetCeilingUsd: 500,
    mctMin: 60,
  });

  const res = applyConstraintFunnel(candidates, itin);
  assert.ok(res.survivors.length > 0);

  const ranked = rankRecoveryOptions(res.survivors, itin);
  assert.ok(ranked.length > 0);
  assert.ok(ranked[0].residualRisk > 0);
});

suite.test('S9.3: Full multi-day incident report generation with complete audit ledger', () => {
  const session = {
    tripId: 'TRIP-SIN-NRT-2026',
    state: 'RECOVERED',
    riskScore: 92,
    itinerary: CURATED_PRESETS[0],
    disruption: { flightNumber: 'SQ856', event: 'DELAY', delayMinutes: 1440, reason: 'Volcanic ash' },
    ledger: [
      { id: 'TX-EMERGENCY-24H', proposalId: 'opt_a', status: 'CONFIRMED', reference: 'SQ-EMERG-24H' }
    ],
  };

  const reportJson = generateRunReportJson(session);
  const parsed = JSON.parse(reportJson);
  assert.strictEqual(parsed.disruption.delayMinutes, 1440);
  assert.strictEqual(parsed.ledger[0].reference, 'SQ-EMERG-24H');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('scenario-s9-extreme-24h-delay-overnight.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
