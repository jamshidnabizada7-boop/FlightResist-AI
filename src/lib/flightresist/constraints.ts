/**
 * FlightResist AI 2.0 — Hard Constraint Filtering (deterministic, authoritative)
 *
 * Applied in strict order; each candidate is attributed to the FIRST rule it
 * violates (single primary rejection reason). The rules are non-negotiable —
 * no scoring, no LLM, no user preference can override them:
 *
 *   1. misses_deadline        arrival ≤ required arrival deadline (hard limit)
 *   2. over_budget            fare difference ≤ traveler budget ceiling
 *   3. unsafe_connection      every layover ≥ MCT (60 min)
 *   4. baggage_incompatible   checked baggage ≥ 1 × 23 kg
 */

import type {
  ConstraintResult,
  FlightCandidate,
  FunnelStage,
  Itinerary,
  PruneReason,
} from './types';

export function applyHardConstraints(
  candidates: FlightCandidate[],
  itinerary: Itinerary,
): ConstraintResult {
  const { constraints } = itinerary;
  const hardLimitMs = new Date(constraints.hardArrivalLimitIso).getTime();

  const stages: { reason: PruneReason; label: string; rule: string; test: (c: FlightCandidate) => boolean }[] = [
    {
      reason: 'misses_deadline',
      label: 'Required arrival deadline',
      rule: `Arrival ≤ 2026-08-28 12:00 JST (trip salvaged only if in Tokyo by Friday noon)`,
      test: (c) => {
        const t = new Date(c.arrIso).getTime();
        return isNaN(t) || t > hardLimitMs;
      },
    },
    {
      reason: 'over_budget',
      label: 'Budget ceiling',
      rule: `Fare difference ≤ $${constraints.budgetUsd} (traveler-set rebooking budget)`,
      test: (c) => c.fareDiffUsd > constraints.budgetUsd,
    },
    {
      reason: 'unsafe_connection',
      label: 'Minimum connection time',
      rule: `Layover ≥ ${constraints.mctMin} min (MCT safety floor)`,
      // A direct flight (stops === 0) has no layover — vacuously safe. A null
      // connection time on a CONNECTING itinerary is missing data → unsafe.
      // (Pruning null outright wrongly rejected every nonstop, including the
      // canonical Option C finalist — see fixture.ts / optimizer.ts docstrings.)
      test: (c) => c.stops > 0 && (c.minConnectionMin == null || c.minConnectionMin < constraints.mctMin),
    },
    {
      reason: 'baggage_incompatible',
      label: 'Baggage allowance',
      rule: `Checked baggage ≥ ${constraints.baggagePieces} × ${constraints.baggageWeightKg} kg (contract documents travel checked)`,
      test: (c) =>
        c.baggagePieces < constraints.baggagePieces || c.baggageWeightKg < constraints.baggageWeightKg,
    },
  ];

  let pool = [...candidates];
  const funnel: FunnelStage[] = [];
  const prunedSummary: Record<PruneReason, number> = {
    misses_deadline: 0,
    over_budget: 0,
    unsafe_connection: 0,
    baggage_incompatible: 0,
  };

  for (const stage of stages) {
    const removed: FlightCandidate[] = [];
    const kept: FlightCandidate[] = [];
    for (const c of pool) {
      if (stage.test(c)) removed.push(c);
      else kept.push(c);
    }
    prunedSummary[stage.reason] = removed.length;
    funnel.push({
      reason: stage.reason,
      label: stage.label,
      rule: stage.rule,
      removed: removed.length,
      remaining: kept.length,
      removedIds: removed.map((c) => c.id),
    });
    pool = kept;
  }

  return {
    survivors: pool,
    funnel,
    prunedSummary,
    totalCandidates: candidates.length,
  };
}
