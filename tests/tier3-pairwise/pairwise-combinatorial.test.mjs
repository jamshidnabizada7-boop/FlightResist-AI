// tests/tier3-pairwise/pairwise-combinatorial.test.mjs
// Tier 3: Pairwise Combinatorial Interaction Tests
// Matrix: 6 Curated Presets × 5 Disruption Types × 4 Constraint Profiles (18 orthogonal pairs)

import assert from 'node:assert';
import {
  createTestSuite,
  CURATED_PRESETS,
  generateAlgorithmicCandidates,
  calculateTripImpactGraph,
  applyConstraintFunnel,
  rankRecoveryOptions,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Tier 3: Pairwise Combinatorial Interaction Matrix');

// Test Matrix Definition
const PAIRWISE_MATRIX = [
  // Pair 1..3: SIN-NRT Variations
  { presetId: 'TRIP-SIN-NRT-2026', event: 'CANCELLATION', delayMin: 0, profile: 'BASELINE', budget: 150, mct: 60, bags: 1, bagKg: 23 },
  { presetId: 'TRIP-SIN-NRT-2026', event: 'DELAY', delayMin: 180, profile: 'STRICT_BUDGET_50', budget: 50, mct: 60, bags: 1, bagKg: 23 },
  { presetId: 'TRIP-SIN-NRT-2026', event: 'MISCONNECT', delayMin: 90, profile: 'STRICT_MCT_120', budget: 150, mct: 120, bags: 1, bagKg: 23 },

  // Pair 4..6: LHR-JFK Variations
  { presetId: 'TRIP-LHR-JFK-2026', event: 'DELAY', delayMin: 240, profile: 'BASELINE', budget: 200, mct: 90, bags: 2, bagKg: 32 },
  { presetId: 'TRIP-LHR-JFK-2026', event: 'CANCELLATION', delayMin: 0, profile: 'HEAVY_BAGS_2X32KG', budget: 300, mct: 90, bags: 2, bagKg: 32 },
  { presetId: 'TRIP-LHR-JFK-2026', event: 'TERMINAL_CLOSURE', delayMin: 360, profile: 'STRICT_BUDGET_50', budget: 50, mct: 60, bags: 1, bagKg: 23 },

  // Pair 7..9: SFO-HND Variations
  { presetId: 'TRIP-SFO-HND-2026', event: 'CANCELLATION', delayMin: 0, profile: 'STRICT_MCT_120', budget: 300, mct: 120, bags: 1, bagKg: 23 },
  { presetId: 'TRIP-SFO-HND-2026', event: 'DELAY', delayMin: 120, profile: 'HEAVY_BAGS_2X32KG', budget: 400, mct: 60, bags: 2, bagKg: 32 },
  { presetId: 'TRIP-SFO-HND-2026', event: 'MISCONNECT', delayMin: 150, profile: 'BASELINE', budget: 300, mct: 60, bags: 1, bagKg: 23 },

  // Pair 10..12: SYD-LAX Variations
  { presetId: 'TRIP-SYD-LAX-2026', event: 'DELAY', delayMin: 300, profile: 'STRICT_BUDGET_50', budget: 80, mct: 75, bags: 2, bagKg: 30 },
  { presetId: 'TRIP-SYD-LAX-2026', event: 'CANCELLATION', delayMin: 0, profile: 'BASELINE', budget: 250, mct: 75, bags: 2, bagKg: 30 },
  { presetId: 'TRIP-SYD-LAX-2026', event: 'TERMINAL_CLOSURE', delayMin: 480, profile: 'STRICT_MCT_120', budget: 350, mct: 120, bags: 2, bagKg: 30 },

  // Pair 13..15: DXB-CDG Variations
  { presetId: 'TRIP-DXB-CDG-2026', event: 'TERMINAL_CLOSURE', delayMin: 240, profile: 'BASELINE', budget: 350, mct: 60, bags: 2, bagKg: 32 },
  { presetId: 'TRIP-DXB-CDG-2026', event: 'DELAY', delayMin: 90, profile: 'STRICT_BUDGET_50', budget: 60, mct: 60, bags: 1, bagKg: 23 },
  { presetId: 'TRIP-DXB-CDG-2026', event: 'CANCELLATION', delayMin: 0, profile: 'HEAVY_BAGS_2X32KG', budget: 500, mct: 60, bags: 2, bagKg: 32 },

  // Pair 16..18: FRA-SIN Variations
  { presetId: 'TRIP-FRA-SIN-2026', event: 'MISCONNECT', delayMin: 180, profile: 'BASELINE', budget: 180, mct: 60, bags: 1, bagKg: 23 },
  { presetId: 'TRIP-FRA-SIN-2026', event: 'DELAY', delayMin: 360, profile: 'STRICT_MCT_120', budget: 250, mct: 120, bags: 1, bagKg: 23 },
  { presetId: 'TRIP-FRA-SIN-2026', event: 'CANCELLATION', delayMin: 0, profile: 'STRICT_BUDGET_50', budget: 40, mct: 60, bags: 1, bagKg: 23 },
];

PAIRWISE_MATRIX.forEach((comb, idx) => {
  const testNum = idx + 1;
  const testName = `P${String(testNum).padStart(2, '0')}: [${comb.presetId}] × [${comb.event}${comb.delayMin > 0 ? ` +${comb.delayMin}m` : ''}] × [${comb.profile}]`;

  suite.test(testName, () => {
    const rawPreset = CURATED_PRESETS.find(p => p.tripId === comb.presetId);
    assert.ok(rawPreset, `Preset ${comb.presetId} must exist`);

    const itinerary = {
      ...rawPreset,
      constraints: {
        ...rawPreset.constraints,
        budgetUsd: comb.budget,
        mctMin: comb.mct,
        baggagePieces: comb.bags,
        baggageWeightKg: comb.bagKg,
      },
    };

    const disruption = {
      flightNumber: itinerary.legs[0].flightNumber,
      event: comb.event,
      delayMinutes: comb.delayMin,
      reason: `Automated combinatorial test ${comb.event}`,
    };

    // 1. Impact Graph & Risk Calculation
    const impactGraph = calculateTripImpactGraph(itinerary, disruption);
    assert.ok(impactGraph.riskScore >= 0 && impactGraph.riskScore <= 100);
    assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(impactGraph.severity));
    assert.ok(impactGraph.nodes.length >= 2);

    // 2. Candidate Generation
    const candidates = generateAlgorithmicCandidates({
      origin: itinerary.origin,
      destination: itinerary.destination,
      travelDateIso: itinerary.travelDateIso,
      baseFareUsd: 850,
      budgetCeilingUsd: comb.budget,
      mctMin: comb.mct,
      isCanonicalDemo: comb.presetId === 'TRIP-SIN-NRT-2026' && comb.profile === 'BASELINE',
    });
    assert.ok(candidates.length > 0, 'Candidate search must return candidates');

    // 3. Decision Funnel Evaluation
    const funnelRes = applyConstraintFunnel(candidates, itinerary);
    assert.strictEqual(funnelRes.funnel.length, 4);
    assert.strictEqual(
      funnelRes.survivors.length +
        funnelRes.prunedSummary.misses_deadline +
        funnelRes.prunedSummary.over_budget +
        funnelRes.prunedSummary.unsafe_connection +
        funnelRes.prunedSummary.baggage_incompatible,
      funnelRes.totalCandidates,
      'Conservation of candidates across funnel stages'
    );

    // 4. Multi-Criteria Ranking (when survivors exist)
    if (funnelRes.survivors.length > 0) {
      const ranked = rankRecoveryOptions(funnelRes.survivors, itinerary);
      assert.ok(ranked.length <= 3);
      assert.strictEqual(ranked[0].status, 'RECOMMENDED');
      assert.ok(ranked[0].recoveryScore >= (ranked[1]?.recoveryScore || 0));
    }
  });
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('pairwise-combinatorial.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
