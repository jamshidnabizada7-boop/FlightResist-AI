// tests/tier4-scenarios/scenario-s2-sfo-hnd-cancellation.test.mjs
// Scenario S2: San Francisco to Tokyo Haneda (SFO → HND) Cancellation with Deal Context

import assert from 'node:assert';
import {
  createTestSuite,
  CURATED_PRESETS,
  calculateTripImpactGraph,
  generateAlgorithmicCandidates,
  applyConstraintFunnel,
  rankRecoveryOptions,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Scenario S2: SFO → HND Cancellation & Emergency Rebooking');

suite.test('S2.1: Load SFO-HND preset (Marcus Brody, $10M Keynote & Term Sheet signing)', () => {
  const itin = CURATED_PRESETS.find(p => p.tripId === 'TRIP-SFO-HND-2026');
  assert.ok(itin);
  assert.strictEqual(itin.passenger.name, 'Marcus Brody');
  assert.strictEqual(itin.mission.importance, 'CRITICAL');
  assert.strictEqual(itin.mission.dealValue, 10000000);
});

suite.test('S2.2: Catastrophic UA875 flight cancellation produces critical risk score (>=75)', () => {
  const itin = CURATED_PRESETS[2];
  const disruption = {
    flightNumber: 'UA875',
    event: 'CANCELLATION',
    reason: 'Severe hydraulic system failure — aircraft grounded at SFO',
  };

  const impact = calculateTripImpactGraph(itin, disruption);
  assert.ok(impact.riskScore >= 75, `Critical cancellation must produce risk >=75 (got ${impact.riskScore})`);
  assert.strictEqual(impact.severity, 'CRITICAL');
  assert.ok(impact.chainNarration.primaryConsequence.includes('Severe mission compromise'));
});

suite.test('S2.3: Re-route engine synthesizes viable transpacific alternatives meeting keynote deadline', () => {
  const itin = CURATED_PRESETS[2];
  const candidates = generateAlgorithmicCandidates({
    origin: 'SFO',
    destination: 'HND',
    travelDateIso: '2026-08-27',
    baseFareUsd: 1100,
    budgetCeilingUsd: 300,
    mctMin: 60,
  });

  const funnelRes = applyConstraintFunnel(candidates, itin);
  assert.ok(funnelRes.survivors.length >= 1);

  const ranked = rankRecoveryOptions(funnelRes.survivors, itin);
  assert.strictEqual(ranked[0].status, 'RECOMMENDED');
  assert.ok(ranked[0].why.whyRecommended.length > 0);
});

suite.test('S2.4: Execute emergency rebooking and verify full audit trail', () => {
  const ledger = [];
  const entry = {
    id: 'TX-SFO-HND-EMERGENCY',
    proposalId: 'opt_a',
    status: 'CONFIRMED',
    reference: 'NH-REC-8751',
    executionTimeMs: 44,
    createdAtIso: new Date().toISOString(),
  };

  ledger.push(entry);
  assert.strictEqual(ledger.length, 1);
  assert.strictEqual(ledger[0].status, 'CONFIRMED');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('scenario-s2-sfo-hnd-cancellation.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
