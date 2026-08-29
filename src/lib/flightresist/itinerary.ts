/**
 * FlightResist AI 2.0 — Demo Scenario Itinerary & Dynamic Bridge
 *
 * TRIP-SIN-NRT-2026: Singapore → Tokyo Narita with a Hong Kong layover.
 * Purpose: ¥2.1B contract signing at Marunouchi client HQ, 08:30 JST next morning.
 * Primary leg SQ856 gets cancelled by Typhoon "Trami" at 05:30 SIN time.
 */

import type { Itinerary, DisruptionEvent } from './types';
import { PRESET_SIN_NRT, PRESETS, getPresetById, getPresetSummaries, DEFAULT_PRESET_ID } from './presets';

export const TRIP_ID = 'TRIP-SIN-NRT-2026';

/** Day 0 = 2026-08-27 (all scenario timestamps anchor here). */
export const DAY0 = '2026-08-27';

/** Canonical default itinerary — backed by the curated Singapore Airlines & Cathay Pacific preset */
export const ITINERARY: Itinerary = PRESET_SIN_NRT;

/** The canonical simulated disruption (also the payload shape accepted by POST /api/disrupt/trigger). */
export const CANONICAL_DISRUPTION: DisruptionEvent = {
  flightNumber: 'SQ856',
  event: 'CANCELLATION',
  reason: 'Severe Weather — Typhoon Trami',
  detectedAtIso: '2026-08-27T05:30:00+08:00',
  severity: 'CRITICAL',
  detail:
    'SQ856 (SIN 08:00 → HKG 12:05) cancelled. Typhoon Trami has closed the HKG hub until 18:00; downstream connection CX520 (HKG 14:30 → NRT 19:45) will be missed.',
};

/** Second scenario — connection-leg delay (milder, different graph shape). */
export const DELAY_DISRUPTION: DisruptionEvent = {
  flightNumber: 'CX520',
  event: 'DELAY',
  reason: 'Late inbound aircraft — rotational delay',
  detectedAtIso: '2026-08-27T11:50:00+08:00',
  severity: 'HIGH',
  delayMinutes: 45,
  detail:
    'CX520 (HKG 14:30 → NRT 19:45) delayed +45m by a late inbound aircraft; new arrival 20:30 JST. Ground transfer slot at risk, evening buffer compresses — mission still recoverable.',
};

/** Demo scenario catalog surfaced to the UI (id → label/description/disruption). */
export const SCENARIOS: {
  id: 'cancellation' | 'delay';
  label: string;
  shortLabel: string;
  description: string;
  severityBadge: 'CRITICAL' | 'HIGH';
  disruption: DisruptionEvent;
}[] = [
  {
    id: 'cancellation',
    label: 'Typhoon cancels SQ856',
    shortLabel: 'Cancellation',
    description: 'Primary leg cancelled — hub closed, connection guaranteed missed. Risk 87/100 CRITICAL.',
    severityBadge: 'CRITICAL',
    disruption: CANONICAL_DISRUPTION,
  },
  {
    id: 'delay',
    label: 'CX520 delayed +45m',
    shortLabel: 'Delay',
    description: 'Connection leg slips — transfer slot and rest window compress. Risk 41/100 HIGH.',
    severityBadge: 'HIGH',
    disruption: DELAY_DISRUPTION,
  },
];

export function scenarioById(id: string | undefined) {
  return SCENARIOS.find((s) => s.id === id);
}

/** Original planned arrival (used for delay computations). */
export const ORIGINAL_ARRIVAL_ISO = ITINERARY.legs[ITINERARY.legs.length - 1].arrIso;

/** Minutes needed to get from NRT arrival gate to a Marunouchi meeting room. */
export const NRT_TO_MEETING_MIN = 150;

// Re-export presets catalog for convenience
export { PRESETS, getPresetById, getPresetSummaries, DEFAULT_PRESET_ID, PRESET_SIN_NRT };
