/**
 * POST /api/recovery/confirm — 1-tap human approval → provider execution.
 *
 * Payload: { "proposal_id": "opt_b" }
 * Response: { "status": "SIMULATED", "order_id": ..., "pnr": null,
 *             "demo_reference": "SIM-REV-89211", "state": "RECOVERED",
 *             "execution_time_ms": 2340, "steps": [...] }
 *
 * A transition to EXECUTING happens ONLY through this explicit POST payload.
 * pnr is populated only when the live provider returns a real PNR —
 * in DEMO mode demo_reference carries the simulated identifier instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { rateLimit } from '@/lib/rate-limit';
import { currentTripResponse } from '@/lib/flightresist/api';
import { executeRecovery } from '@/lib/flightresist/pipeline';
import { getSessionIdFromRequest, withSessionContext } from '@/lib/flightresist/session-id';
import { resolveUserMode } from '@/lib/user-mode';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Session scoping: cookie-based session ID (cookie-less clients fall back
  // to the shared default session). Established as the ambient context for
  // the whole request so every store/bus/pipeline call resolves to it.
  const sessionId = getSessionIdFromRequest(req);
  return withSessionContext(sessionId, () => postConfirm(req, sessionId));
}

async function postConfirm(req: NextRequest, sessionId: string): Promise<NextResponse> {
  const requestId = randomUUID();
  const log = logger.withRequestId(requestId);

  // Rate limit: 60/min in dev/test/demo, 15/min in prod
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const limit = process.env.NODE_ENV !== 'production' || process.env.ATLAS_MODE === 'demo' ? 60 : 15;
  const { allowed, remaining, resetMs } = rateLimit(`confirm:${ip}`, limit);
  if (!allowed) {
    log.warn('Rate limit exceeded', { ip, resetMs });
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: resetMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
    );
  }

  try {
    let body: { proposal_id?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
    const proposalId = typeof body.proposal_id === 'string' ? body.proposal_id.trim() : '';

    // User-scoped provider selection (Task 32): execution must run through
    // the same provider the user picked for the analysis — a LIVE-mode plan
    // carries Atlas offer IDs that only the Atlas provider can verify/book.
    const userMode = await resolveUserMode();

    log.info('Recovery confirm request', { proposalId, userMode: userMode ?? 'env-default' });

    if (!proposalId) {
      return NextResponse.json({ error: 'proposal_id is required (string)' }, { status: 400 });
    }
    if (proposalId.length > 64) {
      return NextResponse.json({ error: 'proposal_id exceeds maximum length' }, { status: 400 });
    }

    const result = await executeRecovery(proposalId, sessionId, userMode);
    log.info('Recovery confirmed', { proposalId, status: result.status, providerMode: result.providerMode });
    return NextResponse.json({
      status: result.status,
      provider_mode: result.providerMode,
      proposal_id: result.proposalId,
      order_id: result.orderId,
      pnr: result.pnr,
      demo_reference: result.demoReference,
      fare_key: result.fareKey,
      state: result.state,
      execution_time_ms: result.executionTimeMs,
      steps: result.steps,
      error: result.error,
      completed_at: result.completedAtIso,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    const e = err instanceof Error ? err : new Error(message);
    log.error('Recovery confirm failed', { message: e.message, stack: e.stack, name: e.name });
    // Phase 6: enhanced error classification
    // 409 — state guard rejection (not a server error)
    const isGuardError = /AWAITING_APPROVAL|proposal_id|Unknown proposal|already in progress|already executed/i.test(message);
    if (isGuardError) {
      const current = await currentTripResponse(sessionId);
      return NextResponse.json(
        { error: message, state: current.state, idempotent: /already/i.test(message) },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
