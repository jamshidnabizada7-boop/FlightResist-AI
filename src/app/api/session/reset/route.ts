/**
 * POST /api/session/reset — operator reset to NORMAL (fresh demo run).
 * Clears the agent trace + analysis; the execution ledger persists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { rateLimit } from '@/lib/rate-limit';
import { currentTripResponse } from '@/lib/flightresist/api';
import { forceReset } from '@/lib/flightresist/store';
import { getActiveProvider } from '@/lib/flightresist/providers';
import { getSessionIdFromRequest, withSessionContext } from '@/lib/flightresist/session-id';
import { resolveUserMode } from '@/lib/user-mode';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Session scoping: reset only the caller's session (cookie-based session
  // ID; cookie-less clients reset the shared default session).
  const sessionId = getSessionIdFromRequest(req);
  return withSessionContext(sessionId, () => postReset(req, sessionId));
}

async function postReset(req: NextRequest, sessionId: string): Promise<NextResponse> {
  const requestId = randomUUID();
  const log = logger.withRequestId(requestId);
  log.info('Session reset request');

  // Rate limit: 60/min in dev/test/demo, 15/min in prod
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const limit = process.env.NODE_ENV !== 'production' || process.env.ATLAS_MODE === 'demo' ? 60 : 15;
  const { allowed, remaining, resetMs } = rateLimit(`reset:${ip}`, limit);
  if (!allowed) {
    log.warn('Rate limit exceeded', { ip, resetMs });
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: resetMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
    );
  }

  try {
    // Honor the signed-in user's Demo/Live preference so a reset keeps the
    // trip labeled with the provider the user actually picked in the UI.
    const userMode = await resolveUserMode();
    const { info } = await getActiveProvider(userMode);
    // Phase 7: await forceReset — DB operations are now sequential,
    // guaranteeing the reset is durable before the response is sent.
    await forceReset(info.mode, sessionId);
    const trip = await currentTripResponse(sessionId, userMode);
    log.info('Session reset complete', { state: trip.state });
    return NextResponse.json({ status: 'RESET', state: trip.state, ledger: trip.ledger });
  } catch (err) {
    const e = err instanceof Error ? err : new Error('Reset failed');
    log.error('Session reset failed', { message: e.message, stack: e.stack, name: e.name });
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
