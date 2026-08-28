/**
 * FlightResist AI — user provider-mode resolution (Task 32).
 *
 * Resolves the authenticated user's provider preference ("DEMO" | "LIVE")
 * for pipeline provider selection (disruption trigger, recovery execution).
 *
 * Why read the DB instead of just `session.user.preferredMode`? The session
 * token carries `preferredMode` from sign-in time and is NOT refreshed when
 * the user switches modes — PATCH /api/user/mode updates only the database
 * (the auth callbacks are intentionally frozen). Reading the fresh column
 * by the session's user id is what actually connects the UI choice to the
 * provider used; the token value is only a fallback for DB-less deployments
 * (where login is impossible anyway, so in practice it is never reached).
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, dbAvailable } from '@/lib/db';

export type UserProviderMode = 'DEMO' | 'LIVE';

/**
 * The signed-in user's provider mode preference, or undefined when the caller
 * is unauthenticated (anonymous traffic keeps the env-based provider logic).
 */
export async function resolveUserMode(): Promise<UserProviderMode | undefined> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return undefined;

    if (dbAvailable()) {
      try {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { preferredMode: true },
        });
        if (user) return user.preferredMode === 'LIVE' ? 'LIVE' : 'DEMO';
      } catch {
        /* fall through to the token value below */
      }
    }

    // DB unavailable or user row gone — best-effort stale token value.
    return session?.user?.preferredMode === 'LIVE' ? 'LIVE' : 'DEMO';
  } catch {
    // getServerSession can throw when there is no resolvable request context
    // (e.g. a background task). Treat as anonymous so callers keep the
    // env-based provider logic instead of crashing.
    return undefined;
  }
}
