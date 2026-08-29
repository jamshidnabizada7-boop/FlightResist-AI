/**
 * FlightResist AI 2.0 — API helpers
 */

import { logger } from '@/lib/logger';
import { resolveUserMode } from '@/lib/user-mode';
import { getActiveProvider, getDemoProvider } from './providers';
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
  /** True when the user's LIVE preference could not be served for this read
   *  (CLI absent, secure store missing, or circuit breaker OPEN) and the
   *  snapshot was built with the demo provider instead. Always accompanied by
   *  `live_unavailable_reason` — the frontend shows a banner, never a 500. */
  live_unavailable?: boolean;
  live_unavailable_reason?: string;
}

/** Hydrates the session (cold start) and returns the full current-trip payload.
 *  Session-scoped: pass the caller's session ID (falls back to the ambient
 *  request context, then the shared default session for cookie-less clients).
 *  Provider selection honors the signed-in user's Demo/Live preference:
 *  `userMode` may be supplied by callers that already resolved it; otherwise
 *  it is resolved here from the session's fresh DB value, so a mode switch
 *  is reflected immediately on the next trip read (refresh).
 *
 *  Provider-selection failures never fail the read: trip state lives in the
 *  session store/DB, independent of the provider, so an unhealthy Atlas (CLI
 *  missing, secure store unavailable, breaker OPEN) degrades this read to the
 *  demo provider with `live_unavailable` set — loudly labeled, not silent. */
export async function currentTripResponse(sessionId?: string, userMode?: string): Promise<CurrentTripResponse> {
  const id = resolveSessionId(sessionId);
  const resolvedMode = userMode ?? (await resolveUserMode());
  // Establish ambient context so nested calls that cannot take an explicit
  // session ID (e.g. provider failover announcements) land on this session.
  return withSessionContext(id, async () => {
    let liveUnavailableReason: string | null = null;
    let selection: Awaited<ReturnType<typeof getActiveProvider>>;
    try {
      selection = await getActiveProvider(resolvedMode);
    } catch (err) {
      // getActiveProvider only throws when a LIVE preference cannot be served
      // (CLI absent, secure store unavailable, breaker OPEN). Trip state lives
      // in the session store/DB — independent of the provider — so degrade
      // this read to demo and declare the fallback instead of failing.
      liveUnavailableReason = err instanceof Error ? err.message : String(err);
      logger.warn('Trip read degraded to demo provider — live selection failed', {
        reason: liveUnavailableReason,
      });
      selection = { provider: getDemoProvider(), info: demoFallbackInfo(liveUnavailableReason) };
    }
    const { info } = selection;
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
      ...(liveUnavailableReason
        ? { live_unavailable: true, live_unavailable_reason: liveUnavailableReason }
        : {}),
    };
  });
}

/** ProviderInfo for a degraded read: clearly labeled as a LIVE→Demo fallback. */
function demoFallbackInfo(reason: string): ProviderInfo {
  return {
    mode: 'DEMO',
    badge: '[USER: LIVE UNAVAILABLE — DEMO FALLBACK]',
    label: 'DemoProvider — live mode unavailable for this read',
    probeDetail: reason,
  };
}
