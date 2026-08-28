/**
 * GET /api/trip/current — current trip session state.
 */

import { NextResponse } from 'next/server';
import { currentTripResponse } from '@/lib/flightresist/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await currentTripResponse();
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[api/trip/current]', err);
    return NextResponse.json({ error: 'Failed to load trip session' }, { status: 500 });
  }
}
