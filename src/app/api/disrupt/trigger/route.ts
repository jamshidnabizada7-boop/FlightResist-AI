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
import type { DisruptionEvent } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const log = logger.withRequestId(requestId);

  // Rate limit: 3 requests per minute per IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const { allowed, remaining, resetMs } = rateLimit(`trigger:${ip}`, 3);
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

    log.info('Disruption trigger request', {
      flight_number: body.flight_number,
      event: body.event,
      reason: body.reason,
      scenario: body.scenario,
      delay_minutes: body.delay_minutes,
    });

    // Scenario shortcut: POST {"scenario": "delay", "delay_minutes": 90} or {"scenario": "cancellation"}
    const preset = scenarioById(body.scenario);
    if (preset) {
      let disruption = { ...preset.disruption, detectedAtIso: new Date().toISOString() };
      // Custom delay duration for the delay scenario (clamped 15–180 for demo sanity).
      if (preset.id === 'delay' && body.delay_minutes !== undefined) {
        const minutes = Math.max(15, Math.min(180, Math.round(Number(body.delay_minutes) || 45)));
        const lastLeg = ITINERARY.legs[ITINERARY.legs.length - 1];
        const plannedMin = Number(/T(\d{2}):(\d{2})/.exec(lastLeg.arrIso)?.[1] ?? 0) * 60 + Number(/T(\d{2}):(\d{2})/.exec(lastLeg.arrIso)?.[2] ?? 0);
        const newTotal = plannedMin + minutes;
        const clock = `${String(Math.floor((newTotal / 60) % 24)).padStart(2, '0')}:${String(newTotal % 60).padStart(2, '0')}`;
        disruption = {
          ...disruption,
          delayMinutes: minutes,
          detail: `CX520 (HKG 14:30 → NRT 19:45) delayed +${minutes}m; new arrival ${clock} JST. Ground transfer slot and evening buffer at risk — mission still recoverable.`,
        };
      }
      const result = await triggerDisruption(disruption);
      log.info('Disruption trigger response', { status: result.status, state: result.state });
      return NextResponse.json(result);
    }

    const flightNumber = (body.flight_number ?? CANONICAL_DISRUPTION.flightNumber).toUpperCase();
    const leg = ITINERARY.legs.find((l) => l.flightNumber.toUpperCase() === flightNumber);
    if (!leg) {
      return NextResponse.json(
        {
          error: `Flight ${flightNumber} is not part of itinerary ${ITINERARY.tripId}`,
          available_flights: ITINERARY.legs.map((l) => l.flightNumber),
        },
        { status: 400 },
      );
    }

    const event = (body.event?.toUpperCase() as DisruptionEvent['event']) ?? 'CANCELLATION';
    const isDelay = event === 'DELAY';
    const delayMinutes = isDelay ? Math.max(5, Math.min(600, Number(body.delay_minutes ?? 45))) : undefined;

    const disruption: DisruptionEvent = {
      flightNumber: leg.flightNumber,
      event,
      reason: body.reason ?? (isDelay ? DELAY_DISRUPTION.reason : CANONICAL_DISRUPTION.reason),
      detectedAtIso: new Date().toISOString(),
      severity: isDelay ? 'HIGH' : 'CRITICAL',
      delayMinutes,
      detail:
        leg.flightNumber === CANONICAL_DISRUPTION.flightNumber && !isDelay
          ? CANONICAL_DISRUPTION.detail
          : isDelay
            ? `${leg.flightNumber} (${leg.from} ${leg.depIso} → ${leg.to}) delayed +${delayMinutes}m — arrival slips; downstream buffers compress.`
            : `${leg.flightNumber} (${leg.from} ${leg.depIso} → ${leg.to}) cancelled — downstream connections on this trip are impacted.`,
    };

    const result = await triggerDisruption(disruption);
    log.info('Disruption trigger response', { status: result.status, state: result.state });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Disruption trigger failed';
    const conflict = /NORMAL state|already running/.test(message);
    const e = err instanceof Error ? err : new Error(message);
    log.error('Disruption trigger failed', { message: e.message, stack: e.stack, name: e.name });
    if (conflict) {
      const current = await currentTripResponse();
      return NextResponse.json({ error: message, state: current.state }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
