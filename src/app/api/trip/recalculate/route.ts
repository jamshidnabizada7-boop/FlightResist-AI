/**
 * POST /api/trip/recalculate — Sub-50ms On-Demand Recalculation API
 *
 * Re-runs the algorithmic candidate generator, hard constraint decision funnel,
 * and multi-criteria optimizer for the current active itinerary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionIdFromRequest, withSessionContext } from '@/lib/flightresist/session-id';
import { getSession } from '@/lib/flightresist/store';
import { applyHardConstraints } from '@/lib/flightresist/constraints';
import { rankOptions } from '@/lib/flightresist/optimizer';
import { buildOptionWhy } from '@/lib/flightresist/why-engine';
import { generateRouteCandidates } from '@/lib/flightresist/route-generator';
import type { FlightCandidate, TripConstraints, RecoveryAnalysis, ScoredOption } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sessionId = getSessionIdFromRequest(req);
  return withSessionContext(sessionId, () => recalculate(req, sessionId));
}

async function recalculate(req: NextRequest, sessionId: string): Promise<NextResponse> {
  const t0 = performance.now();
  try {
    let body: { constraints?: Partial<TripConstraints> } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    const s = getSession(sessionId);
    const itinerary = {
      ...s.itinerary,
      constraints: {
        ...s.itinerary.constraints,
        ...(body.constraints || {}),
      },
    };

    const candidates: FlightCandidate[] = generateRouteCandidates({
      origin: itinerary.origin,
      destination: itinerary.destination,
      travelDateIso: itinerary.travelDateIso,
      budgetCeilingUsd: itinerary.constraints.budgetUsd,
      mctMin: itinerary.constraints.mctMin,
      baggagePieces: itinerary.constraints.baggagePieces,
      baggageWeightKg: itinerary.constraints.baggageWeightKg,
      isCanonicalDemo: itinerary.tripId === 'TRIP-SIN-NRT-2026',
    });

    const constraintResult = applyHardConstraints(candidates, itinerary);
    const rawOptions = rankOptions(constraintResult.survivors, itinerary);
    const bestOption = rawOptions[0];

    const options: ScoredOption[] = rawOptions.map((o) => ({
      ...o,
      why: bestOption ? buildOptionWhy(o, bestOption, itinerary) : undefined,
    }));

    const analysis: RecoveryAnalysis = {
      disruption: s.disruption || {
        flightNumber: itinerary.legs[0]?.flightNumber || 'FL100',
        event: 'CANCELLATION',
        reason: 'Recalculation Simulation',
        detectedAtIso: new Date().toISOString(),
        severity: 'HIGH',
        detail: 'On-demand recalculation simulation',
      },
      impactGraph: s.analysis?.impactGraph || {
        nodes: [],
        edges: [],
        riskScore: s.riskScore,
        severity: 'LOW',
        summary: 'Baseline recalculation',
        chainNarration: {
          rootFailure: 'Simulation',
          cascade: [],
          primaryConsequence: 'None',
          riskExplanation: 'Recalculated on demand',
        },
      },
      constraintResult,
      options,
      recommendedId: options[0]?.id ?? null,
      explanation: s.analysis?.explanation ?? null,
      analyzedAtIso: new Date().toISOString(),
      totalAnalysisMs: Math.round(performance.now() - t0),
    };

    s.analysis = analysis;
    const latencyMs = Math.round(performance.now() - t0);

    return NextResponse.json({
      status: 'RECALCULATED',
      itinerary,
      analysis,
      latencyMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Recalculation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
