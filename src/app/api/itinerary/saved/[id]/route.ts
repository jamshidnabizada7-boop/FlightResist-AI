/**
 * /api/itinerary/saved/[id] — Single Saved Itinerary GET & DELETE
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, dbAvailable } from '@/lib/db';
import type { Itinerary } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!dbAvailable()) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { id } = await params;
    const record = await db.savedItinerary.findUnique({
      where: { id },
    });

    if (!record) {
      return NextResponse.json({ error: 'Saved itinerary not found.' }, { status: 404 });
    }

    let parsedItinerary: Itinerary | null = null;
    try {
      parsedItinerary = JSON.parse(record.data) as Itinerary;
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      saved: {
        id: record.id,
        tripId: record.tripId,
        name: record.name,
        origin: record.origin,
        destination: record.destination,
        travelDateIso: record.travelDateIso,
        isPreset: record.isPreset,
        presetId: record.presetId,
        itinerary: parsedItinerary,
        userId: record.userId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[api/itinerary/saved/[id] GET]', err);
    return NextResponse.json({ error: 'Failed to retrieve saved itinerary' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!dbAvailable()) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { id } = await params;
    const existing = await db.savedItinerary.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Saved itinerary not found.' }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Only allow deletion if item is unowned (public test item) or matches the authenticated user
    if (existing.userId && existing.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to delete this itinerary.' }, { status: 403 });
    }

    await db.savedItinerary.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Itinerary deleted.' });
  } catch (err) {
    console.error('[api/itinerary/saved/[id] DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete saved itinerary' }, { status: 500 });
  }
}
