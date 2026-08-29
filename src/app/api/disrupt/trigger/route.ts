/**
 * POST /api/disrupt/trigger — disruption webhook / simulator.
 *
 * Payload: { "flight_number": "SQ856", "event": "CANCELLATION", "reason": "Severe Weather" }
 * Response: { "status": "DISRUPTION_TRIGGERED", "state": "ANALYZING" }
 *
 * The analysis pipeline runs asynchronously; progress streams over
 * GET /api/recovery/stream (SSE) and the result lands in GET /api/recovery/options.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { rateLimit } from '@/lib/rate-limit';
import { currentTripResponse } from '@/lib/flightresist/api';
import { CANONICAL_DISRUPTION, DELAY_DISRUPTION, ITINERARY, scenarioById } from '@/lib/flightresist/itinerary';
import { triggerDisruption } from '@/lib/flightresist/pipeline';
import { getSessionIdFromRequest, withSessionContext } from '@/lib/flightresist/session-id';
import { resolveUserMode } from '@/lib/user-mode';
import { getSession } from '@/lib/flightresist/store';
import type { DisruptionEvent } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Session scoping: cookie-based session ID (cookie-less clients fall back
  // to the shared default session). Established as the ambient context for
  // the whole request so every store/bus/pipeline call resolves to it.
  const sessionId = getSessionIdFromRequest(req);
  return withSessionContext(sessionId, () => postDisruption(req, sessionId));
}

async function postDisruption(req: NextRequest, sessionId: string): Promise<NextResponse> {
  const requestId = randomUUID();
  const log = logger.withRequestId(requestId);

  // Rate limit: 60/min in dev/test/demo, 15/min in prod
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const limit = process.env.NODE_ENV !== 'production' || process.env.ATLAS_MODE === 'demo' ? 60 : 15;
  const { allowed, remaining, resetMs } = rateLimit(`trigger:${ip}`, limit);
  if (!allowed) {
    log.warn('Rate limit exceeded', { ip, resetMs });
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: resetMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
    );
  }

  try {
    let body: {
      flight_number?: string;
      event?: string;
      reason?: string;
      scenario?: string;
      delay_minutes?: number;
    } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    // User-scoped provider selection (Task 32): the signed-in user's Demo/Live
    // preference decides which provider the recovery pipeline searches
    // through. Anonymous callers fall back to the env-based provider logic.
    const userMode = await resolveUserMode();

    log.info('Disruption trigger request', {
      flight_number: body.flight_number,
      event: body.event,
      reason: body.reason,
      scenario: body.scenario,
      delay_minutes: body.delay_minutes,
      userMode: userMode ?? 'env-default',
    });

    const session = getSession(sessionId);
    const activeItinerary = session.itinerary ?? ITINERARY;

    // Scenario shortcut: POST {"scenario": "delay", "delay_minutes": 90} or {"scenario": "cancellation"}
    const preset = scenarioById(body.scenario);
    if (preset) {
      let disruption = { ...preset.disruption, detectedAtIso: new Date().toISOString() };
      // Custom delay duration for the delay scenario (clamped 15–1440).
      if (preset.id === 'delay' && body.delay_minutes !== undefined) {
        const minutes = Math.max(15, Math.min(1440, Math.round(Number(body.delay_minutes) || 45)));
        const lastLeg = activeItinerary.legs[activeItinerary.legs.length - 1];
        const plannedMin = Number(/T(\d{2}):(\d{2})/.exec(lastLeg.arrIso)?.[1] ?? 0) * 60 + Number(/T(\d{2}):(\d{2})/.exec(lastLeg.arrIso)?.[2] ?? 0);
        const newTotal = plannedMin + minutes;
        const clock = `${String(Math.floor((newTotal / 60) % 24)).padStart(2, '0')}:${String(newTotal % 60).padStart(2, '0')}`;
        disruption = {
          ...disruption,
          delayMinutes: minutes,
          detail: `${disruption.flightNumber} (${lastLeg.from} → ${lastLeg.to}) delayed +${minutes}m; new arrival ${clock}. Downstream buffers compress.`,
        };
      }
      const result = await triggerDisruption(disruption, sessionId, userMode);
      log.info('Disruption trigger response', { status: result.status, state: result.state });
      return NextResponse.json(result);
    }

    const flightNumber = (body.flight_number ?? activeItinerary.legs[0]?.flightNumber ?? CANONICAL_DISRUPTION.flightNumber).toUpperCase();
    const leg = activeItinerary.legs.find((l) => l.flightNumber.toUpperCase() === flightNumber);
    if (!leg) {
      return NextResponse.json(
        {
          error: `Flight ${flightNumber} is not part of itinerary ${activeItinerary.tripId}`,
          available_flights: activeItinerary.legs.map((l) => l.flightNumber),
        },
        { status: 400 },
      );
    }

    const event = (body.event?.toUpperCase() as DisruptionEvent['event']) ?? 'CANCELLATION';
    const isDelay = event === 'DELAY';
    const delayMinutes = isDelay ? Math.max(15, Math.min(1440, Number(body.delay_minutes ?? 45))) : undefined;

    const defaultReason = isDelay
      ? DELAY_DISRUPTION.reason
      : event === 'TERMINAL_CLOSURE'
        ? 'Airport Terminal Safety Closure'
        : event === 'MISCONNECT'
          ? 'Inbound Feeder Connection Lost'
          : CANONICAL_DISRUPTION.reason;

    const disruption: DisruptionEvent = {
      flightNumber: leg.flightNumber,
      event,
      reason: body.reason ?? defaultReason,
      detectedAtIso: new Date().toISOString(),
      severity: isDelay ? (delayMinutes && delayMinutes >= 180 ? 'CRITICAL' : 'HIGH') : 'CRITICAL',
      delayMinutes,
      detail:
        leg.flightNumber === CANONICAL_DISRUPTION.flightNumber && !isDelay && event === 'CANCELLATION' && activeItinerary.tripId === 'TRIP-SIN-NRT-2026'
          ? CANONICAL_DISRUPTION.detail
          : isDelay
            ? `${leg.flightNumber} (${leg.from} ${leg.depIso} → ${leg.to}) delayed +${delayMinutes}m — arrival slips; downstream buffers compress.`
            : `${leg.flightNumber} (${leg.from} ${leg.depIso} → ${leg.to}) ${event.toLowerCase()} — downstream journey impacted.`,
    };

    const result = await triggerDisruption(disruption, sessionId, userMode);
    log.info('Disruption trigger response', { status: result.status, state: result.state });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Disruption trigger failed';
    const conflict = /NORMAL state|already running/.test(message);
    const e = err instanceof Error ? err : new Error(message);
    log.error('Disruption trigger failed', { message: e.message, stack: e.stack, name: e.name });
    if (conflict) {
      const current = await currentTripResponse(sessionId);
      return NextResponse.json({ error: message, state: current.state }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
