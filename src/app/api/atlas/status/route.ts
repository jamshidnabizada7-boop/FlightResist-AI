/**
 * GET /api/atlas/status — is the atlas-flight CLI available on this deployment?
 *
 * Response: { available: boolean, reason?: string, authenticated?: boolean }
 *
 * `reason` names the actual blocker when unavailable: the CLI may be absent
 * (serverless deployments ship without it) or installed but unable to reach
 * its secure credential store (headless containers), in which case live
 * operations fail even though `--version` works. The frontend polls this on
 * mount to decide whether Live mode is actually selectable. The check runs
 * the same cached runtime probe (60 s TTL) as provider selection — without
 * the full provider/circuit setup — so it is cheap to call repeatedly.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkAtlasAvailability } from '@/lib/flightresist/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const probe = await checkAtlasAvailability();
    return NextResponse.json({
      available: probe.available,
      reason: probe.detail,
      authenticated: probe.authenticated,
      ticketingAvailable: probe.ticketingAvailable,
      ticketingBlocker: probe.ticketingBlocker,
      ticketingActivationUrl: probe.ticketingActivationUrl,
    });
  } catch (err) {
    // Never throw from a status endpoint: `available: false` is the
    // actionable signal for the frontend; the real cause goes to the log.
    logger.error('Atlas status check failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ available: false, reason: 'Atlas status check failed.' });
  }
}
