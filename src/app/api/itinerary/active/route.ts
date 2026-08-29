/**
 * POST /api/itinerary/active — Set the active itinerary for the current session
 *
 * Accepts either:
 *  - `{ presetId: string }`
 *  - `{ itinerary: Itinerary }`
 *
 * Validates the schema, sets session itinerary, resets trip state to NORMAL,
 * updates persistence, and emits a snapshot to SSE subscribers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentTripResponse } from '@/lib/flightresist/api';
import { getPresetById } from '@/lib/flightresist/presets';
import { ItinerarySchema } from '@/lib/flightresist/pnr-parser';
import { getSessionIdFromRequest } from '@/lib/flightresist/session-id';
import { setSessionItinerary } from '@/lib/flightresist/store';
import { resolveUserMode } from '@/lib/user-mode';
import type { Itinerary } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const sessionId = getSessionIdFromRequest(req);
    const body = (await req.json()) as { presetId?: string; itinerary?: unknown };

    let targetItinerary: Itinerary | undefined;

    if (body.presetId) {
      const preset = getPresetById(body.presetId);
      if (!preset) {
        return NextResponse.json(
          { error: `Preset '${body.presetId}' not found in curated catalog.` },
          { status: 400 }
        );
      }
      targetItinerary = preset;
    } else if (body.itinerary) {
      const parsed = ItinerarySchema.safeParse(body.itinerary);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: 'Invalid itinerary data format.',
            details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          },
          { status: 400 }
        );
      }
      targetItinerary = parsed.data as Itinerary;
    } else {
      return NextResponse.json(
        { error: 'Please provide either a valid `presetId` or `itinerary` payload.' },
        { status: 400 }
      );
    }

    const userMode = await resolveUserMode();
    await setSessionItinerary(targetItinerary, userMode, sessionId);

    const trip = await currentTripResponse(sessionId, userMode);

    return NextResponse.json({
      status: 'ACTIVE_UPDATED',
      trip,
    });
  } catch (err) {
    console.error('[api/itinerary/active]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to activate itinerary' },
      { status: 500 }
    );
  }
}
