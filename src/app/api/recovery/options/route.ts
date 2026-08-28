/**
 * GET /api/recovery/options — deterministic analysis result.
 *
 * Response (demo mode, deterministic fixture):
 * {
 *   "total_candidates": 42,
 *   "pruned_summary": { "over_budget": 12, "unsafe_connection": 18, "baggage_incompatible": 9 },
 *   "options": [ { "id": "opt_b", "fare_diff": 43, "delay_hours": 3, "risk_score": 18, ... } ]
 * }
 *
 * In ATLAS_SANDBOX mode every count is computed from actual provider responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { currentTripResponse } from '@/lib/flightresist/api';
import { getSessionIdFromRequest } from '@/lib/flightresist/session-id';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Session-scoped: return the caller's own deterministic analysis.
  const sessionId = getSessionIdFromRequest(req);
  const requestId = randomUUID();
  const log = logger.withRequestId(requestId);
  log.info('Recovery options request', { sessionId });

  try {
    const trip = await currentTripResponse(sessionId);
    if (!trip.analysis) {
      return NextResponse.json(
        {
          status: trip.state === 'NORMAL' ? 'NO_DISRUPTION' : 'ANALYZING',
          state: trip.state,
          error:
            trip.state === 'NORMAL'
              ? 'No disruption triggered yet. POST /api/disrupt/trigger first.'
              : 'Analysis in progress — follow /api/recovery/stream.',
        },
        { status: 409 },
      );
    }

    const a = trip.analysis;
    log.info('Recovery options response', { state: trip.state, optionCount: a.options.length });
    return NextResponse.json({
      status: 'RECOVERY_OPTIONS_READY',
      state: trip.state,
      trip_id: trip.trip_id,
      risk_score: trip.risk_score,
      disruption: a.disruption,
      impact_graph: a.impactGraph,
      total_candidates: a.constraintResult.totalCandidates,
      pruned_summary: {
        over_budget: a.constraintResult.prunedSummary.over_budget,
        unsafe_connection: a.constraintResult.prunedSummary.unsafe_connection,
        baggage_incompatible: a.constraintResult.prunedSummary.baggage_incompatible,
        misses_deadline: a.constraintResult.prunedSummary.misses_deadline,
      },
      funnel: a.constraintResult.funnel,
      options: a.options.map((o) => ({
        id: o.id,
        label: o.label,
        routing: o.candidate.label,
        legs: o.candidate.legs.map((l) => ({
          flight_number: l.flightNumber,
          from: l.from,
          to: l.to,
          dep: l.depIso,
          arr: l.arrIso,
        })),
        fare_diff: o.metrics.fareDiffUsd,
        delay_hours: o.metrics.delayHours,
        risk_score: o.residualRisk,
        recovery_score: o.recoveryScore,
        scores: o.scores,
        status: o.status,
        reason: o.reason,
        makes_meeting: o.metrics.makesMeeting,
      })),
      recommended_id: a.recommendedId,
      explanation: a.explanation,
      analysis_time_ms: a.totalAnalysisMs,
      analyzed_at: a.analyzedAtIso,
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error('Recovery options load failed');
    log.error('Recovery options load failed', { message: e.message, stack: e.stack, name: e.name });
    return NextResponse.json({ error: 'Failed to load recovery options' }, { status: 500 });
  }
}
