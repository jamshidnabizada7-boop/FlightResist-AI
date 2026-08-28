/**
 * FlightResist AI 2.0 — Deterministic Demo Fixture (changi_nrt_mock equivalent)
 *
 * EXACTLY 42 candidate records:
 *   12 × over_budget        (fare delta > $150 ceiling)
 *   18 × unsafe_connection  (layover < 60 min MCT)
 *    9 × baggage_incompatible (below 1×23kg checked allowance)
 *    3 × finalists          (Option A / B / C — engineered to the demo story)
 *
 * Every value is deterministic (no random, no clock): the demo funnel always
 * produces 42 → 30 → 12 → 3 with prune summary {over_budget: 12,
 * unsafe_connection: 18, baggage_incompatible: 9} and finalists B > C > A.
 */

import type { FlightCandidate, FlightLeg, Layover } from './types';

// ---------------------------------------------------------------------------
// Timezone + routing tables (all in UTC minutes since 2026-08-27T00:00:00+08:00)
// ---------------------------------------------------------------------------

const BASE_UTC_MS = Date.UTC(2026, 7, 26, 16, 0, 0); // = 2026-08-27T00:00+08:00

const TZ: Record<string, number> = {
  SIN: 8, HKG: 8, TPE: 8, KUL: 8, MNL: 8, ICN: 9, NRT: 9, BKK: 7, SGN: 7,
};

/** SIN → hub → NRT block times (minutes) per hub. */
const HUBS: Record<string, { city: string; fl1: number; fl2: number }> = {
  HKG: { city: 'Hong Kong', fl1: 235, fl2: 250 },
  TPE: { city: 'Taipei', fl1: 280, fl2: 185 },
  ICN: { city: 'Seoul Incheon', fl1: 385, fl2: 145 },
  KUL: { city: 'Kuala Lumpur', fl1: 65, fl2: 375 },
  BKK: { city: 'Bangkok', fl1: 145, fl2: 360 },
  SGN: { city: 'Ho Chi Minh City', fl1: 125, fl2: 350 },
  MNL: { city: 'Manila', fl1: 225, fl2: 265 },
};

const DIRECT_DUR = 390; // SIN → NRT nonstop, 6h30m

const AIRLINES: Record<string, { name: string; otp: number; aircraft: string }> = {
  SQ: { name: 'Singapore Airlines', otp: 0.91, aircraft: 'Airbus A350-900' },
  CX: { name: 'Cathay Pacific', otp: 0.86, aircraft: 'Boeing 777-300ER' },
  NH: { name: 'ANA', otp: 0.92, aircraft: 'Boeing 787-9' },
  JL: { name: 'Japan Airlines', otp: 0.91, aircraft: 'Boeing 787-8' },
  BR: { name: 'EVA Air', otp: 0.86, aircraft: 'Boeing 777-300ER' },
  CI: { name: 'China Airlines', otp: 0.82, aircraft: 'Airbus A350-900' },
  TR: { name: 'Scoot', otp: 0.78, aircraft: 'Boeing 787-9' },
  KE: { name: 'Korean Air', otp: 0.88, aircraft: 'Boeing 777-300ER' },
  OZ: { name: 'Asiana Airlines', otp: 0.85, aircraft: 'Airbus A350-900' },
  MH: { name: 'Malaysia Airlines', otp: 0.74, aircraft: 'Boeing 737-800' },
  TG: { name: 'Thai Airways', otp: 0.83, aircraft: 'Boeing 787-8' },
  VN: { name: 'Vietnam Airlines', otp: 0.8, aircraft: 'Airbus A321neo' },
  PR: { name: 'Philippine Airlines', otp: 0.76, aircraft: 'Airbus A321neo' },
  UO: { name: 'HK Express', otp: 0.75, aircraft: 'Airbus A321neo' },
  MM: { name: 'Peach Aviation', otp: 0.79, aircraft: 'Airbus A320neo' },
};

function iso(utcMin: number, tz: number): string {
  const d = new Date(BASE_UTC_MS + utcMin * 60000 + tz * 3600000);
  const p = (n: number) => String(n).padStart(2, '0');
  const sign = tz >= 0 ? '+' : '-';
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00${sign}${p(Math.abs(tz))}:00`;
}

// ---------------------------------------------------------------------------
// Candidate specs
// ---------------------------------------------------------------------------

interface Spec {
  al: [string] | [string, string];
  via: string | null; // hub IATA or null for direct
  /** Departure local time at SIN in minutes since 00:00. */
  dep: number;
  conn?: number; // layover minutes (2-leg only)
  fare: number;
  bagPieces: number;
  bagKg: number;
  seats: number;
  cabin?: string;
  flightNos?: string[];
  fixtureClass: 'over_budget' | 'unsafe_connection' | 'baggage_incompatible' | 'finalist';
}

const SPECS: Spec[] = [
  // --------------------------- 12 × over_budget ---------------------------
  { fixtureClass: 'over_budget', al: ['CX', 'CX'], via: 'HKG', dep: 9 * 60 + 40, conn: 105, fare: 210, bagPieces: 2, bagKg: 23, seats: 6 },
  { fixtureClass: 'over_budget', al: ['SQ', 'CX'], via: 'HKG', dep: 10 * 60 + 25, conn: 140, fare: 168, bagPieces: 1, bagKg: 23, seats: 3 },
  { fixtureClass: 'over_budget', al: ['NH'], via: null, dep: 11 * 60 + 5, fare: 189, bagPieces: 2, bagKg: 23, seats: 5 },
  { fixtureClass: 'over_budget', al: ['JL'], via: null, dep: 12 * 60 + 10, fare: 205, bagPieces: 2, bagKg: 23, seats: 4 },
  { fixtureClass: 'over_budget', al: ['BR', 'BR'], via: 'TPE', dep: 12 * 60 + 40, conn: 165, fare: 158, bagPieces: 2, bagKg: 23, seats: 7 },
  { fixtureClass: 'over_budget', al: ['KE', 'KE'], via: 'ICN', dep: 13 * 60 + 5, conn: 190, fare: 236, bagPieces: 2, bagKg: 23, seats: 8 },
  { fixtureClass: 'over_budget', al: ['CX', 'CX'], via: 'HKG', dep: 13 * 60 + 50, conn: 95, fare: 176, bagPieces: 1, bagKg: 23, seats: 2 },
  { fixtureClass: 'over_budget', al: ['SQ'], via: null, dep: 15 * 60 + 20, fare: 312, bagPieces: 2, bagKg: 23, seats: 9, cabin: 'Economy (Flexi walk-up)' },
  { fixtureClass: 'over_budget', al: ['TG', 'TG'], via: 'BKK', dep: 15 * 60 + 55, conn: 130, fare: 194, bagPieces: 1, bagKg: 23, seats: 6 },
  { fixtureClass: 'over_budget', al: ['CI', 'CI'], via: 'TPE', dep: 16 * 60 + 30, conn: 115, fare: 172, bagPieces: 2, bagKg: 23, seats: 5 },
  { fixtureClass: 'over_budget', al: ['NH'], via: null, dep: 18 * 60 + 10, fare: 465, bagPieces: 2, bagKg: 32, seats: 3, cabin: 'Business' },
  { fixtureClass: 'over_budget', al: ['SQ', 'SQ'], via: 'HKG', dep: 19 * 60 + 25, conn: 220, fare: 528, bagPieces: 2, bagKg: 32, seats: 2, cabin: 'Business' },

  // ------------------------ 18 × unsafe_connection ------------------------
  { fixtureClass: 'unsafe_connection', al: ['UO', 'UO'], via: 'HKG', dep: 10 * 60 + 15, conn: 45, fare: 38, bagPieces: 1, bagKg: 23, seats: 7 },
  { fixtureClass: 'unsafe_connection', al: ['CI', 'CI'], via: 'TPE', dep: 10 * 60 + 55, conn: 40, fare: 52, bagPieces: 1, bagKg: 23, seats: 4 },
  { fixtureClass: 'unsafe_connection', al: ['KE', 'KE'], via: 'ICN', dep: 11 * 60 + 30, conn: 55, fare: 74, bagPieces: 2, bagKg: 23, seats: 6 },
  { fixtureClass: 'unsafe_connection', al: ['TR', 'TR'], via: 'HKG', dep: 12 * 60 + 5, conn: 35, fare: 29, bagPieces: 1, bagKg: 23, seats: 8 },
  { fixtureClass: 'unsafe_connection', al: ['VN', 'VN'], via: 'SGN', dep: 12 * 60 + 45, conn: 50, fare: 61, bagPieces: 1, bagKg: 23, seats: 5 },
  { fixtureClass: 'unsafe_connection', al: ['BR', 'BR'], via: 'TPE', dep: 13 * 60 + 15, conn: 30, fare: 88, bagPieces: 2, bagKg: 23, seats: 3 },
  { fixtureClass: 'unsafe_connection', al: ['MH', 'MH'], via: 'KUL', dep: 13 * 60 + 40, conn: 45, fare: 22, bagPieces: 1, bagKg: 23, seats: 9 },
  { fixtureClass: 'unsafe_connection', al: ['TG', 'TG'], via: 'BKK', dep: 14 * 60 + 20, conn: 55, fare: 57, bagPieces: 1, bagKg: 23, seats: 6 },
  { fixtureClass: 'unsafe_connection', al: ['CX', 'CX'], via: 'HKG', dep: 14 * 60 + 55, conn: 40, fare: 96, bagPieces: 2, bagKg: 23, seats: 2 },
  { fixtureClass: 'unsafe_connection', al: ['OZ', 'OZ'], via: 'ICN', dep: 15 * 60 + 35, conn: 35, fare: 79, bagPieces: 1, bagKg: 23, seats: 7 },
  { fixtureClass: 'unsafe_connection', al: ['PR', 'PR'], via: 'MNL', dep: 16 * 60 + 5, conn: 50, fare: 66, bagPieces: 1, bagKg: 23, seats: 4 },
  { fixtureClass: 'unsafe_connection', al: ['TR', 'TR'], via: 'TPE', dep: 16 * 60 + 40, conn: 25, fare: 34, bagPieces: 1, bagKg: 23, seats: 9 },
  { fixtureClass: 'unsafe_connection', al: ['JL', 'JL'], via: 'ICN', dep: 17 * 60 + 15, conn: 45, fare: 118, bagPieces: 2, bagKg: 23, seats: 3 },
  { fixtureClass: 'unsafe_connection', al: ['UO', 'UO'], via: 'HKG', dep: 17 * 60 + 50, conn: 30, fare: 41, bagPieces: 1, bagKg: 23, seats: 6 },
  { fixtureClass: 'unsafe_connection', al: ['VN', 'VN'], via: 'SGN', dep: 18 * 60 + 25, conn: 55, fare: 48, bagPieces: 1, bagKg: 23, seats: 5 },
  { fixtureClass: 'unsafe_connection', al: ['MH', 'MH'], via: 'KUL', dep: 19 * 60 + 5, conn: 40, fare: 18, bagPieces: 1, bagKg: 23, seats: 9 },
  { fixtureClass: 'unsafe_connection', al: ['TG', 'TG'], via: 'BKK', dep: 19 * 60 + 40, conn: 35, fare: 63, bagPieces: 1, bagKg: 23, seats: 7 },
  { fixtureClass: 'unsafe_connection', al: ['CI', 'CI'], via: 'TPE', dep: 20 * 60 + 15, conn: 50, fare: 72, bagPieces: 1, bagKg: 23, seats: 4 },

  // --------------------- 9 × baggage_incompatible -------------------------
  { fixtureClass: 'baggage_incompatible', al: ['TR'], via: null, dep: 9 * 60 + 55, fare: 45, bagPieces: 0, bagKg: 0, seats: 8, cabin: 'Economy (Basic — cabin bag only)' },
  { fixtureClass: 'baggage_incompatible', al: ['UO', 'UO'], via: 'HKG', dep: 11 * 60 + 15, conn: 80, fare: 39, bagPieces: 0, bagKg: 0, seats: 9, cabin: 'Economy (Basic — cabin bag only)' },
  { fixtureClass: 'baggage_incompatible', al: ['TR', 'TR'], via: 'TPE', dep: 12 * 60 + 50, conn: 95, fare: 42, bagPieces: 0, bagKg: 0, seats: 6, cabin: 'Economy (Basic — cabin bag only)' },
  { fixtureClass: 'baggage_incompatible', al: ['MM', 'MM'], via: 'TPE', dep: 13 * 60 + 35, conn: 110, fare: 47, bagPieces: 0, bagKg: 0, seats: 7, cabin: 'Economy (Basic — cabin bag only)' },
  { fixtureClass: 'baggage_incompatible', al: ['PR', 'PR'], via: 'MNL', dep: 14 * 60 + 45, conn: 130, fare: 55, bagPieces: 1, bagKg: 20, seats: 5, cabin: 'Economy (Saver — 20kg)' },
  { fixtureClass: 'baggage_incompatible', al: ['VN', 'VN'], via: 'SGN', dep: 15 * 60 + 30, conn: 75, fare: 36, bagPieces: 0, bagKg: 0, seats: 8, cabin: 'Economy (Basic — cabin bag only)' },
  { fixtureClass: 'baggage_incompatible', al: ['TR', 'TR'], via: 'HKG', dep: 16 * 60 + 55, conn: 145, fare: 33, bagPieces: 0, bagKg: 0, seats: 9, cabin: 'Economy (Basic — cabin bag only)' },
  { fixtureClass: 'baggage_incompatible', al: ['MH', 'MH'], via: 'KUL', dep: 17 * 60 + 40, conn: 85, fare: 28, bagPieces: 1, bagKg: 20, seats: 6, cabin: 'Economy (Saver — 20kg)' },
  { fixtureClass: 'baggage_incompatible', al: ['UO', 'UO'], via: 'HKG', dep: 19 * 60 + 10, conn: 120, fare: 44, bagPieces: 0, bagKg: 0, seats: 7, cabin: 'Economy (Basic — cabin bag only)' },

  // ----------------------------- 3 finalists ------------------------------
  // Option B (engineered): TR976 SIN 11:45 → TPE 16:25 · BR2198 TPE 18:40 → NRT 22:45 (+$43, conn 2h15)
  { fixtureClass: 'finalist', al: ['TR', 'BR'], via: 'TPE', dep: 11 * 60 + 45, conn: 135, fare: 43, bagPieces: 2, bagKg: 23, seats: 4, flightNos: ['TR976', 'BR2198'], cabin: 'Economy' },
  // Option C (engineered): NH844 SIN 13:20 → NRT 20:50 nonstop (+$145)
  { fixtureClass: 'finalist', al: ['NH'], via: null, dep: 13 * 60 + 20, fare: 145, bagPieces: 2, bagKg: 23, seats: 2, flightNos: ['NH844'], cabin: 'Economy' },
  // Option A (engineered): MH602 SIN 13:20 → KUL 14:25 · MH58 KUL 23:30 → NRT 06:45+1d ($0, arrives after the 08:30 signing starts)
  { fixtureClass: 'finalist', al: ['MH', 'MH'], via: 'KUL', dep: 13 * 60 + 20, conn: 545, fare: 0, bagPieces: 1, bagKg: 23, seats: 9, flightNos: ['MH602', 'MH58'], cabin: 'Economy (involuntary rebook — no charge)' },
];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

const flightCounter = new Map<string, number>();
function nextFlightNo(code: string, i: number): string {
  if (flightCounter.has(code)) {
    const n = (flightCounter.get(code) as number) + 3;
    flightCounter.set(code, n);
    return `${code}${n}`;
  }
  flightCounter.set(code, 408 + i);
  return `${code}${408 + i}`;
}

function buildCandidate(spec: Spec, seq: number): FlightCandidate {
  const codes = spec.al;
  const dep1 = spec.dep; // SIN local minutes == UTC minutes since base

  const legs: FlightLeg[] = [];
  const layovers: Layover[] = [];

  let totalDur: number;
  let arrFinal: number;

  if (spec.via === null) {
    // Direct SIN → NRT
    const al = AIRLINES[codes[0]];
    const arr = dep1 + DIRECT_DUR;
    legs.push({
      flightNumber: spec.flightNos?.[0] ?? nextFlightNo(codes[0], seq),
      airlineCode: codes[0],
      airlineName: al.name,
      from: 'SIN',
      to: 'NRT',
      depIso: iso(dep1, TZ.SIN),
      arrIso: iso(arr, TZ.NRT),
      durationMin: DIRECT_DUR,
      aircraft: al.aircraft,
      cabin: spec.cabin ?? 'Economy',
    });
    totalDur = DIRECT_DUR;
    arrFinal = arr;
  } else {
    const hub = HUBS[spec.via];
    const arr1 = dep1 + hub.fl1;
    const dep2 = arr1 + (spec.conn as number);
    const arr2 = dep2 + hub.fl2;
    for (const [i, code] of codes.entries()) {
      const al = AIRLINES[code];
      const first = i === 0;
      legs.push({
        flightNumber: spec.flightNos?.[i] ?? nextFlightNo(code, seq),
        airlineCode: code,
        airlineName: al.name,
        from: first ? 'SIN' : spec.via,
        to: first ? spec.via : 'NRT',
        depIso: iso(first ? dep1 : dep2, TZ[first ? 'SIN' : spec.via]),
        arrIso: iso(first ? arr1 : arr2, TZ[first ? spec.via : 'NRT']),
        durationMin: first ? hub.fl1 : hub.fl2,
        aircraft: al.aircraft,
        cabin: spec.cabin ?? 'Economy',
      });
    }
    layovers.push({ airport: spec.via, minutes: spec.conn as number });
    totalDur = arr2 - dep1;
    arrFinal = arr2;
  }


  const otp = Math.min(...codes.map((c) => AIRLINES[c].otp));
  const viaCity = spec.via === null ? null : HUBS[spec.via].city;
  const mainAirline = AIRLINES[codes[0]];

  return {
    id: `cand-${String(seq).padStart(2, '0')}`,
    fareKey: `FX-SINNRT-${String(seq).padStart(3, '0')}`,
    airlineCode: codes[0],
    airlineName: mainAirline.name,
    label: viaCity ? `${mainAirline.name} · via ${viaCity}` : `${mainAirline.name} · nonstop`,
    legs,
    layovers,
    depIso: legs[0].depIso,
    arrIso: legs[legs.length - 1].arrIso,
    totalDurationMin: totalDur,
    stops: legs.length - 1,
    minConnectionMin: spec.via === null ? null : (spec.conn as number),
    fareDiffUsd: spec.fare,
    baggagePieces: spec.bagPieces,
    baggageWeightKg: spec.bagKg,
    seatsLeft: spec.seats,
    otp,
    fixtureClass: spec.fixtureClass,
  };
}

let CACHE: FlightCandidate[] | null = null;

/** Deterministic inventory: always the same 42 records in departure-time order. */
export function getFixtureCandidates(): FlightCandidate[] {
  if (CACHE) return CACHE.map((c) => ({ ...c }));
  const built = SPECS.map((s, i) => buildCandidate(s, i + 1));
  built.sort((a, b) => {
    const d = new Date(a.depIso).getTime() - new Date(b.depIso).getTime();
    if (d !== 0) return d;
    return new Date(a.arrIso).getTime() - new Date(b.arrIso).getTime();
  });
  CACHE = built.map((c, i) => ({
    ...c,
    id: `cand-${String(i + 1).padStart(2, '0')}`,
    fareKey: `FX-SINNRT-${String(i + 1).padStart(3, '0')}`,
  }));
  return CACHE.map((c) => ({ ...c }));
}

export const FIXTURE_STATS = {
  total: 42,
  overBudget: 12,
  unsafeConnection: 18,
  baggageIncompatible: 9,
  finalists: 3,
} as const;
