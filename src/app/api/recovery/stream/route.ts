/**
 * GET /api/recovery/stream — Server-Sent Events agent reasoning trace.
 *
 * On connect: replays every persisted agent event (dedup by seq client-side),
 * then streams live events (agent / state / reset / snapshot) until the client
 * disconnects. Heartbeat comment every 15s keeps intermediaries from buffering.
 *
 * Session-scoped: subscriptions are namespaced by the caller's cookie-based
 * session ID, so concurrent users only ever receive their own session's
 * events. Cookie-less clients stream the shared default session.
 */

import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { currentTripResponse } from '@/lib/flightresist/api';
import { getBus } from '@/lib/flightresist/bus';
import { getSession } from '@/lib/flightresist/store';
import { getSessionIdFromRequest } from '@/lib/flightresist/session-id';
import type { AgentEvent, TripState } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_MS = 15_000;

export async function GET(req: NextRequest) {
  const sessionId = getSessionIdFromRequest(req);
  const requestId = randomUUID();
  const log = logger.withRequestId(requestId);
  log.info('SSE stream connect', { sessionId });

  const trip = await currentTripResponse(sessionId);
  const session = getSession(sessionId);
  const bus = getBus();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      // Initial snapshot — lets a freshly loaded client sync instantly.
      send('snapshot', {
        state: trip.state,
        risk_score: trip.risk_score,
        provider_mode: trip.provider_mode,
        engine_version: trip.engine_version,
      });

      // Replay the persisted trace (client dedups by seq).
      for (const e of session.events) {
        send('agent', e);
      }

      const offAgent = bus.subscribe(sessionId, 'agent', (e: AgentEvent) => send('agent', e));
      const offState = bus.subscribe(sessionId, 'state', (p: { from: TripState; to: TripState; atIso: string }) =>
        send('state', p),
      );
      const offReset = bus.subscribe(sessionId, 'reset', (p: { atIso: string }) => send('reset', p));
      const offSnap = bus.subscribe(sessionId, 'snapshot', (p: { state: TripState; riskScore: number }) =>
        send('snapshot', p),
      );

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        offAgent();
        offState();
        offReset();
        offSnap();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener('abort', cleanup);

      log.info('SSE stream established', { state: trip.state });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
