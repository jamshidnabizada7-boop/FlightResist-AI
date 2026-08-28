/**
 * FlightResist AI 2.0 — Demo Scenario Itinerary
 *
 * TRIP-SIN-NRT-2026: Singapore → Tokyo Narita with a Hong Kong layover.
 * Purpose: ¥2.1B contract signing at Marunouchi client HQ, 08:30 JST next morning.
 * Primary leg SQ856 gets cancelled by Typhoon "Trami" at 05:30 SIN time.
 */

import type { Itinerary, DisruptionEvent } from './types';

export const TRIP_ID = 'TRIP-SIN-NRT-2026';

/** Day 0 = 2026-08-27 (all scenario timestamps anchor here). */
export const DAY0 = '2026-08-27';

export const ITINERARY: Itinerary = {
  tripId: TRIP_ID,
  origin: 'SIN',
  destination: 'NRT',
  travelDateIso: '2026-08-27T00:00:00+08:00',
  legs: [
    {
      flightNumber: 'SQ856',
      airlineCode: 'SQ',
      airlineName: 'Singapore Airlines',
      from: 'SIN',
      to: 'HKG',
      depIso: '2026-08-27T08:00:00+08:00',
      arrIso: '2026-08-27T12:05:00+08:00',
      durationMin: 245,
      aircraft: 'Airbus A350-900',
      cabin: 'Economy (Flexi)',
    },
    {
      flightNumber: 'CX520',
      airlineCode: 'CX',
      airlineName: 'Cathay Pacific',
      from: 'HKG',
      to: 'NRT',
      depIso: '2026-08-27T14:30:00+08:00',
      arrIso: '2026-08-27T19:45:00+09:00',
      durationMin: 255,
      aircraft: 'Boeing 777-300ER',
      cabin: 'Economy (Flexi)',
    },
  ],
  passenger: {
    name: 'Wei Chen',
    ticketReference: 'SQ-4471-XK2',
    loyalty: 'KrisFlyer Elite Gold',
    checkedBags: 1,
  },
  tripPurpose: 'Contract signing — ¥2.1B infrastructure partnership, Marunouchi client HQ',
  constraints: {
    /** Traveler-set rebooking budget ceiling (fare difference vs original ticket). */
    budgetUsd: 150,
    /** Minimum connection time — hard safety floor. */
    mctMin: 60,
    /** Ideal target arrival (protects a full night of rest before the signing). */
    arrivalDeadlineIso: '2026-08-27T23:59:00+09:00',
    /** REQUIRED ARRIVAL DEADLINE — hard constraint. Absolute latest arrival that
     *  still salvages the trip purpose (traveler must be in Tokyo by Friday noon). */
    hardArrivalLimitIso: '2026-08-28T12:00:00+09:00',
    baggagePieces: 1,
    baggageWeightKg: 23,
  },
  commitments: [
    {
      id: 'cm-transfer',
      kind: 'TRANSFER',
      label: 'Private airport transfer (prepaid)',
      detail: 'Chauffeur meet-and-greet, NRT Terminal 1 → Shinagawa',
      atIso: '2026-08-27T20:30:00+09:00',
      location: 'Narita Terminal 1',
    },
    {
      id: 'cm-hotel',
      kind: 'HOTEL',
      label: 'Shinagawa Prince Hotel — check-in',
      detail: 'Guaranteed late arrival, room held with card',
      atIso: '2026-08-27T22:00:00+09:00',
      location: 'Shinagawa, Tokyo',
    },
    {
      id: 'cm-meeting',
      kind: 'MEETING',
      label: 'Contract signing — Marunouchi client HQ',
      detail: 'The entire purpose of the trip. Client board flies out same day.',
      atIso: '2026-08-28T08:30:00+09:00',
      location: 'Marunouchi, Tokyo',
    },
  ],
};

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
