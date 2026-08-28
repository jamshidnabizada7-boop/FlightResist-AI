/**
 * GET /api/atlas/status — is the atlas-flight CLI available on this deployment?
 *
 * Response: { "available": boolean, "reason?: string" }
 *
 * The frontend polls this on mount to decide whether Live mode is actually
 * selectable: serverless deployments (Vercel) ship without the CLI, so only
 * Demo mode works there. The check runs the same cached runtime probe
 * (60 s TTL) as provider selection — without the full provider/circuit
 * setup — so it is cheap to call repeatedly.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkAtlasAvailability } from '@/lib/flightresist/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const available = await checkAtlasAvailability();
    return NextResponse.json(
      available
        ? { available: true }
        : {
            available: false,
            reason:
              'atlas-flight CLI not found on this deployment — Live mode requires the self-hosted version.',
          },
    );
  } catch (err) {
    // Never throw from a status endpoint: `available: false` is the
    // actionable signal for the frontend; the real cause goes to the log.
    logger.error('Atlas status check failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ available: false, reason: 'Atlas status check failed.' });
  }
}
