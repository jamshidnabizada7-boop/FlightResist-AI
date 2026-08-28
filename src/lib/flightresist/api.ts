/**
 * FlightResist AI 2.0 — API helpers
 */

import { resolveUserMode } from '@/lib/user-mode';
import { getActiveProvider } from './providers';
import { withSessionContext } from './session-id';
import { buildSnapshot, getLedger, hydrateFromDb, resolveSessionId } from './store';
import type { ProviderInfo } from './types';

export interface CurrentTripResponse {
  trip_id: string;
  state: string;
  itinerary: ReturnType<typeof buildSnapshot>['itinerary'];
  risk_score: number;
  provider_mode: string;
  provider: ProviderInfo;
  disruption: ReturnType<typeof buildSnapshot>['disruption'];
  analysis: ReturnType<typeof buildSnapshot>['analysis'];
  execution: ReturnType<typeof buildSnapshot>['execution'];
  ledger: Awaited<ReturnType<typeof getLedger>>;
  events: ReturnType<typeof buildSnapshot>['events'];
  engine_version: string;
}

/** Hydrates the session (cold start) and returns the full current-trip payload.
 *  Session-scoped: pass the caller's session ID (falls back to the ambient
 *  request context, then the shared default session for cookie-less clients).
 *  Provider selection honors the signed-in user's Demo/Live preference:
 *  `userMode` may be supplied by callers that already resolved it; otherwise
 *  it is resolved here from the session's fresh DB value, so a mode switch
 *  is reflected immediately on the next trip read (refresh). */
export async function currentTripResponse(sessionId?: string, userMode?: string): Promise<CurrentTripResponse> {
  const id = resolveSessionId(sessionId);
  const resolvedMode = userMode ?? (await resolveUserMode());
  // Establish ambient context so nested calls that cannot take an explicit
  // session ID (e.g. provider failover announcements) land on this session.
  return withSessionContext(id, async () => {
    const { info } = await getActiveProvider(resolvedMode);
    await hydrateFromDb(info.mode, id);
    const snap = buildSnapshot(info, id);
    const ledger = await getLedger(id);
    return {
      trip_id: snap.tripId,
      state: snap.state,
      itinerary: snap.itinerary,
      risk_score: snap.riskScore,
      provider_mode: info.mode,
      provider: info,
      disruption: snap.disruption,
      analysis: snap.analysis,
      execution: snap.execution,
      ledger,
      events: snap.events,
      engine_version: snap.engineVersion,
    };
  });
}
