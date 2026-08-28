/**
 * GET /api/trip/current — current trip session state.
 *
 * Session-scoped: each concurrent user (cookie-based `fr-session`) gets their
 * own trip state; cookie-less clients share the default session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentTripResponse } from '@/lib/flightresist/api';
import { getSessionIdFromRequest } from '@/lib/flightresist/session-id';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = getSessionIdFromRequest(req);
    const payload = await currentTripResponse(sessionId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[api/trip/current]', err);
    return NextResponse.json({ error: 'Failed to load trip session' }, { status: 500 });
  }
}
