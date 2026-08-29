/**
 * PATCH /api/trip/constraints — Sub-50ms Live Constraint Recalculation API
 *
 * Real-time endpoint for updating traveler constraints (budget, MCT, arrival deadline, baggage).
 * Instantly re-evaluates the decision funnel and multi-criteria ranking for active candidates in <5ms.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionIdFromRequest, withSessionContext } from '@/lib/flightresist/session-id';
import { getSession, updateSessionConstraints } from '@/lib/flightresist/store';
import { applyHardConstraints } from '@/lib/flightresist/constraints';
import { rankOptions } from '@/lib/flightresist/optimizer';
import { buildOptionWhy, buildFactPayload } from '@/lib/flightresist/why-engine';
import { generateRouteCandidates } from '@/lib/flightresist/route-generator';
import { resolveUserMode } from '@/lib/user-mode';
import type { FlightCandidate, TripConstraints, RecoveryAnalysis, ScoredOption } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const sessionId = getSessionIdFromRequest(req);
  return withSessionContext(sessionId, () => patchConstraints(req, sessionId));
}

async function patchConstraints(req: NextRequest, sessionId: string): Promise<NextResponse> {
  const t0 = performance.now();
  try {
    const body = (await req.json()) as Partial<TripConstraints>;
    const userMode = await resolveUserMode();
    const s = getSession(sessionId);

    // Update constraints on the active itinerary
    const updatedItinerary = updateSessionConstraints(
      {
        ...(body.budgetUsd !== undefined ? { budgetUsd: Number(body.budgetUsd) } : {}),
        ...(body.mctMin !== undefined ? { mctMin: Number(body.mctMin) } : {}),
        ...(body.arrivalDeadlineIso ? { arrivalDeadlineIso: body.arrivalDeadlineIso } : {}),
        ...(body.hardArrivalLimitIso ? { hardArrivalLimitIso: body.hardArrivalLimitIso } : {}),
        ...(body.baggagePieces !== undefined ? { baggagePieces: Number(body.baggagePieces) } : {}),
        ...(body.baggageWeightKg !== undefined ? { baggageWeightKg: Number(body.baggageWeightKg) } : {}),
      },
      userMode,
      sessionId,
    );

    // If there is an active analysis or candidates to re-evaluate, recalculate the funnel and ranking
    if (s.analysis && s.analysis.constraintResult) {
      // Re-evaluate from the original candidates pool
      const candidates: FlightCandidate[] = generateRouteCandidates({
        origin: updatedItinerary.origin,
        destination: updatedItinerary.destination,
        travelDateIso: updatedItinerary.travelDateIso,
        budgetCeilingUsd: updatedItinerary.constraints.budgetUsd,
        mctMin: updatedItinerary.constraints.mctMin,
        baggagePieces: updatedItinerary.constraints.baggagePieces,
        baggageWeightKg: updatedItinerary.constraints.baggageWeightKg,
        isCanonicalDemo: updatedItinerary.tripId === 'TRIP-SIN-NRT-2026',
      });

      const constraintResult = applyHardConstraints(candidates, updatedItinerary);
      const rawOptions = rankOptions(constraintResult.survivors, updatedItinerary);
      const bestOption = rawOptions[0];

      const options: ScoredOption[] = rawOptions.map((o) => ({
        ...o,
        why: bestOption ? buildOptionWhy(o, bestOption, updatedItinerary) : undefined,
      }));

      const updatedAnalysis: RecoveryAnalysis = {
        ...s.analysis,
        constraintResult,
        options,
        recommendedId: options[0]?.id ?? null,
      };

      s.analysis = updatedAnalysis;
    }

    const elapsedMs = Math.round(performance.now() - t0);

    return NextResponse.json({
      status: 'UPDATED',
      itinerary: updatedItinerary,
      analysis: s.analysis,
      latencyMs: elapsedMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update constraints';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
