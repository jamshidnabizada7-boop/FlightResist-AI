/**
 * PATCH /api/trip/profile — Passenger Profile & Policy Customization API
 *
 * Endpoint for updating traveler details, loyalty tiers, passport data, and contact info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionIdFromRequest, withSessionContext } from '@/lib/flightresist/session-id';
import { getSession, updateSessionPassenger } from '@/lib/flightresist/store';
import { resolveUserMode } from '@/lib/user-mode';
import type { PassengerProfile } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const sessionId = getSessionIdFromRequest(req);
  return withSessionContext(sessionId, () => patchProfile(req, sessionId));
}

async function patchProfile(req: NextRequest, sessionId: string): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<PassengerProfile>;
    const userMode = await resolveUserMode();

    const updatedItinerary = updateSessionPassenger(body, userMode, sessionId);

    return NextResponse.json({
      status: 'UPDATED',
      itinerary: updatedItinerary,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update traveler profile';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
