/**
 * GET /api/itinerary/presets — Curated Enterprise Business Presets Catalog
 */

import { NextResponse } from 'next/server';
import { getAllPresets, getPresetSummaries } from '@/lib/flightresist/presets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const presets = getAllPresets();
    const summaries = getPresetSummaries();
    return NextResponse.json({
      presets,
      summaries,
      count: presets.length,
    });
  } catch (err) {
    console.error('[api/itinerary/presets]', err);
    return NextResponse.json({ error: 'Failed to load itinerary presets' }, { status: 500 });
  }
}
