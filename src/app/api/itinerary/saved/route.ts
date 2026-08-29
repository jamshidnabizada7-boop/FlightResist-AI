/**
 * /api/itinerary/saved — Multi-Trip Saved Itineraries CRUD
 *
 * GET  — list saved itineraries (per user or public presets)
 * POST — save a new custom or imported itinerary to the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, dbAvailable } from '@/lib/db';
import { ItinerarySchema } from '@/lib/flightresist/pnr-parser';
import type { Itinerary } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!dbAvailable()) {
      return NextResponse.json({ saved: [] });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const rows = await db.savedItinerary.findMany({
      where: userId
        ? {
            OR: [{ userId }, { userId: null }],
          }
        : { userId: null },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const saved = rows.map((r) => {
      let parsedData: Itinerary | null = null;
      try {
        parsedData = JSON.parse(r.data) as Itinerary;
      } catch {
        /* ignore parsing error */
      }
      return {
        id: r.id,
        tripId: r.tripId,
        name: r.name,
        origin: r.origin,
        destination: r.destination,
        travelDateIso: r.travelDateIso,
        isPreset: r.isPreset,
        presetId: r.presetId,
        itinerary: parsedData,
        userId: r.userId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ saved });
  } catch (err) {
    console.error('[api/itinerary/saved GET]', err);
    return NextResponse.json({ error: 'Failed to fetch saved itineraries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!dbAvailable()) {
      return NextResponse.json(
        { error: 'Database is not available for persistent saving on this deployment.' },
        { status: 503 }
      );
    }

    const body = (await req.json()) as {
      name?: string;
      itinerary?: unknown;
      isPreset?: boolean;
      presetId?: string;
    };

    if (!body.itinerary) {
      return NextResponse.json({ error: 'Missing `itinerary` payload.' }, { status: 400 });
    }

    const validated = ItinerarySchema.safeParse(body.itinerary);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid itinerary data structure.',
          details: validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const itinerary = validated.data as Itinerary;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    const savedName =
      body.name ||
      itinerary.tripPurpose ||
      `${itinerary.origin} → ${itinerary.destination} (${itinerary.legs[0]?.airlineCode || 'Trip'})`;

    const record = await db.savedItinerary.create({
      data: {
        tripId: itinerary.tripId,
        name: savedName,
        origin: itinerary.origin,
        destination: itinerary.destination,
        travelDateIso: itinerary.travelDateIso,
        isPreset: !!body.isPreset,
        presetId: body.presetId || null,
        data: JSON.stringify(itinerary),
        userId,
      },
    });

    return NextResponse.json({
      success: true,
      saved: {
        id: record.id,
        tripId: record.tripId,
        name: record.name,
        origin: record.origin,
        destination: record.destination,
        travelDateIso: record.travelDateIso,
        isPreset: record.isPreset,
        presetId: record.presetId,
        itinerary,
        userId: record.userId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[api/itinerary/saved POST]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save itinerary' },
      { status: 500 }
    );
  }
}
