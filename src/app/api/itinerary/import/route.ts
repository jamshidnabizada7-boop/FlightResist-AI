/**
 * POST /api/itinerary/import — Parse and validate JSON or PNR itinerary text
 *
 * Request body:
 *  - `format`: 'JSON' | 'PNR'
 *  - `content`: string (raw JSON or raw GDS PNR text)
 *  - `activateImmediately`?: boolean (if true, activates on current session)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ItinerarySchema, parsePnr, formatPnr } from '@/lib/flightresist/pnr-parser';
import { getSessionIdFromRequest } from '@/lib/flightresist/session-id';
import { setSessionItinerary } from '@/lib/flightresist/store';
import { resolveUserMode } from '@/lib/user-mode';
import type { Itinerary } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      format?: 'JSON' | 'PNR';
      content?: string;
      activateImmediately?: boolean;
    };

    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
      return NextResponse.json({ success: false, errors: ['Import content cannot be empty.'] }, { status: 400 });
    }

    const format = (body.format || 'JSON').toUpperCase();
    let parsedItinerary: Itinerary | undefined;
    let warnings: string[] | undefined;

    if (format === 'PNR') {
      const result = parsePnr(body.content);
      if (!result.success || !result.itinerary) {
        return NextResponse.json(
          {
            success: false,
            errors: result.errors || ['Failed to parse PNR text.'],
          },
          { status: 400 }
        );
      }
      parsedItinerary = result.itinerary;
      warnings = result.warnings;
    } else if (format === 'JSON') {
      let jsonObj: unknown;
      try {
        jsonObj = JSON.parse(body.content);
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            errors: [`Invalid JSON syntax: ${err instanceof Error ? err.message : String(err)}`],
          },
          { status: 400 }
        );
      }

      const validated = ItinerarySchema.safeParse(jsonObj);
      if (!validated.success) {
        return NextResponse.json(
          {
            success: false,
            errors: validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          },
          { status: 400 }
        );
      }
      parsedItinerary = validated.data as Itinerary;
    } else {
      return NextResponse.json(
        {
          success: false,
          errors: [`Unsupported format '${body.format}'. Supported formats: 'JSON', 'PNR'.`],
        },
        { status: 400 }
      );
    }

    let activated = false;
    if (body.activateImmediately && parsedItinerary) {
      const sessionId = getSessionIdFromRequest(req);
      const userMode = await resolveUserMode();
      await setSessionItinerary(parsedItinerary, userMode, sessionId);
      activated = true;
    }

    return NextResponse.json({
      success: true,
      itinerary: parsedItinerary,
      formattedPnr: formatPnr(parsedItinerary),
      warnings,
      activated,
    });
  } catch (err) {
    console.error('[api/itinerary/import]', err);
    return NextResponse.json(
      { success: false, errors: [err instanceof Error ? err.message : 'Import failed.'] },
      { status: 500 }
    );
  }
}
