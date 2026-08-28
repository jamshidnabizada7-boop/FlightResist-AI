/**
 * FlightResist AI 2.0 — API helpers
 */

import { getActiveProvider } from './providers';
import { buildSnapshot, getLedger, hydrateFromDb } from './store';
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

/** Hydrates the session (cold start) and returns the full current-trip payload. */
export async function currentTripResponse(): Promise<CurrentTripResponse> {
  const { info } = await getActiveProvider();
  await hydrateFromDb(info.mode);
  const snap = buildSnapshot(info);
  const ledger = await getLedger();
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
}
