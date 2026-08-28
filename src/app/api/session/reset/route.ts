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

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const log = logger.withRequestId(requestId);
  log.info('Session reset request');

  // Rate limit: 5 requests per minute per IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const { allowed, remaining, resetMs } = rateLimit(`reset:${ip}`, 5);
  if (!allowed) {
    log.warn('Rate limit exceeded', { ip, resetMs });
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: resetMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
    );
  }

  try {
    const { info } = await getActiveProvider();
    // Phase 7: await forceReset — DB operations are now sequential,
    // guaranteeing the reset is durable before the response is sent.
    await forceReset(info.mode);
    const trip = await currentTripResponse();
    log.info('Session reset complete', { state: trip.state });
    return NextResponse.json({ status: 'RESET', state: trip.state, ledger: trip.ledger });
  } catch (err) {
    const e = err instanceof Error ? err : new Error('Reset failed');
    log.error('Session reset failed', { message: e.message, stack: e.stack, name: e.name });
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
