/**
 * PATCH /api/user/mode — switch the signed-in user's provider preference.
 *
 * Payload:  { "mode": "DEMO" | "LIVE" }   (case-insensitive)
 * Response: { "mode": "DEMO" | "LIVE" }   (200)
 *
 * Errors:
 *   401 — not signed in
 *   400 — invalid/missing mode, or malformed body
 *   503 — database unavailable (the preference lives in SQLite, which does
 *          not persist on serverless deployments such as Vercel)
 *   500 — persistence failure
 *
 * The preference is consumed server-side by the recovery pipeline (the
 * disruption trigger and execution confirm routes resolve the FRESH value
 * from the DB). The JWT's session copy is refreshed separately: after this
 * PATCH succeeds, the header calls the NextAuth client `update({ preferredMode })`
 * so the token copy stays in sync for the rest of the login session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, dbAvailable } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  if (!dbAvailable()) {
    return NextResponse.json(
      {
        error:
          'Database unavailable — mode preferences cannot be saved on this deployment. Run the self-hosted version to persist your choice.',
      },
      { status: 503 },
    );
  }

  let body: { mode?: unknown };
  try {
    body = (await req.json()) as { mode?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const raw = typeof body.mode === 'string' ? body.mode.trim().toUpperCase() : '';
  if (raw !== 'DEMO' && raw !== 'LIVE') {
    return NextResponse.json(
      { error: 'Invalid mode. Expected "DEMO" or "LIVE".' },
      { status: 400 },
    );
  }

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { preferredMode: raw },
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.error('Mode preference update failed', {
      userId: session.user.id,
      mode: raw,
      message: e.message,
      stack: e.stack,
      name: e.name,
    });
    return NextResponse.json(
      { error: 'Failed to update mode preference.' },
      { status: 500 },
    );
  }

  logger.info('User mode preference updated', { userId: session.user.id, mode: raw });
  return NextResponse.json({ mode: raw });
}
