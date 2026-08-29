/**
 * FlightResist AI 2.0 — Algorithmic Topological Route & Candidate Generator
 *
 * Universal candidate generation engine for arbitrary global city pairs in Simulation / Demo mode.
 * Generates direct and 1-stop connecting flights via valid hub topologies with realistic block times,
 * timezone-aware arrival timestamps, layover intervals, and fare distributions partitioned
 * across the 4 hard constraint funnel categories (over_budget, unsafe_connection, baggage_incompatible, finalist).
 *
 * Preserves 100% deterministic fidelity for the canonical SIN → NRT scenario on 2026-08-27.
 */

import { getAirport, calculateDistanceKm, calculateFlightDurationMin, GLOBAL_AIRPORTS } from './airports-data';
import { getAllAirlines, getAirlinesForRoute, GLOBAL_AIRLINES } from './airlines-data';
import { getFixtureCandidates } from './fixture';
import type { FlightCandidate, FlightLeg, Layover } from './types';

export interface RouteGeneratorOptions {
  origin: string;
  destination: string;
  travelDateIso?: string;
  departureDateIso?: string;
  baseFareUsd?: number;
  budgetCeilingUsd?: number;
  mctMin?: number;
  baggagePieces?: number;
  baggageWeightKg?: number;
  isCanonicalDemo?: boolean;
}

/**
 * Format a Date object into an ISO 8601 string with a specific UTC timezone offset.
 * Example: formatIsoWithOffset(date, 8) -> "2026-08-27T08:00:00+08:00"
 */
function formatIsoWithOffset(utcDate: Date, tzOffset: number): string {
  const localMs = utcDate.getTime() + tzOffset * 3600000;
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  const sign = tzOffset >= 0 ? '+' : '-';
  const absTz = Math.abs(tzOffset);
  const tzH = String(Math.floor(absTz)).padStart(2, '0');
  const tzM = String(Math.round((absTz % 1) * 60)).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${mi}:${s}${sign}${tzH}:${tzM}`;
}

/**
 * Format standard UTC timezone offset string from hours.
 */
function formatTz(tzOffset: number): string {
  const sign = tzOffset >= 0 ? '+' : '-';
  const absTz = Math.abs(tzOffset);
  const tzH = String(Math.floor(absTz)).padStart(2, '0');
  const tzM = String(Math.round((absTz % 1) * 60)).padStart(2, '0');
  return `${sign}${tzH}:${tzM}`;
}

/**
 * Parse an ISO date or datetime string to get "YYYY-MM-DD" and UTC timestamp at 00:00 local time.
 */
function parseTravelDate(travelDateIso?: string, departureDateIso?: string): { dateStr: string; year: number; month: number; day: number } {
  const raw = travelDateIso || departureDateIso || '2026-08-27';
  const dateStr = raw.slice(0, 10);
  const parts = dateStr.split('-');
  const year = Number(parts[0]) || 2026;
  const month = Number(parts[1]) || 8;
  const day = Number(parts[2]) || 27;
  return { dateStr, year, month, day };
}

/**
 * Generates 35–45 realistic flight recovery candidates for arbitrary global city pairs.
 */
export function generateRouteCandidates(options: RouteGeneratorOptions): FlightCandidate[] {
  const {
    origin,
    destination,
    baseFareUsd = 800,
    budgetCeilingUsd = 200,
    mctMin = 60,
    baggagePieces = 1,
    baggageWeightKg = 23,
    isCanonicalDemo = false,
  } = options;

  if (!origin || !destination || origin.toUpperCase() === destination.toUpperCase()) {
    return [];
  }

  const origUpper = origin.toUpperCase();
  const destUpper = destination.toUpperCase();
  const { dateStr } = parseTravelDate(options.travelDateIso, options.departureDateIso);

  // Canonical Demo Check: maintain bit-exact compatibility with canonical SIN -> NRT scenario
  if (origUpper === 'SIN' && destUpper === 'NRT' && (isCanonicalDemo || dateStr === '2026-08-27')) {
    return getFixtureCandidates();
  }

  const origAirport = getAirport(origUpper) || {
    iata: origUpper,
    name: `${origUpper} International`,
    city: origUpper,
    country: 'UN',
    lat: 0,
    lon: 0,
    tzOffset: 0,
    isMajorHub: true,
    region: 'OTHER' as const,
  };

  const destAirport = getAirport(destUpper) || {
    iata: destUpper,
    name: `${destUpper} International`,
    city: destUpper,
    country: 'UN',
    lat: 0,
    lon: 0,
    tzOffset: 0,
    isMajorHub: true,
    region: 'OTHER' as const,
  };

  const directDist = Math.max(100, calculateDistanceKm(origAirport.lat, origAirport.lon, destAirport.lat, destAirport.lon));
  const directDuration = calculateFlightDurationMin(directDist);

  // Filter connecting hubs by geographic detour factor (d1 + d2) / directDist
  const allHubs = Object.values(GLOBAL_AIRPORTS).filter(
    (h) => h.iata !== origUpper && h.iata !== destUpper && h.isMajorHub,
  );

  let candidateHubs = allHubs.filter((hub) => {
    const d1 = calculateDistanceKm(origAirport.lat, origAirport.lon, hub.lat, hub.lon);
    const d2 = calculateDistanceKm(hub.lat, hub.lon, destAirport.lat, destAirport.lon);
    const detour = (d1 + d2) / directDist;
    return detour <= 1.45;
  });

  // If strict detour factor yields few hubs, relax threshold and guarantee at least 12 hubs
  if (candidateHubs.length < 12) {
    const fallbackHubs = allHubs.filter((hub) => {
      const d1 = calculateDistanceKm(origAirport.lat, origAirport.lon, hub.lat, hub.lon);
      const d2 = calculateDistanceKm(hub.lat, hub.lon, destAirport.lat, destAirport.lon);
      const detour = (d1 + d2) / directDist;
      return detour <= 2.50;
    });
    if (fallbackHubs.length >= 12) {
      candidateHubs = fallbackHubs;
    } else {
      const existingIatas = new Set(fallbackHubs.map((h) => h.iata));
      const remainingHubs = allHubs.filter((h) => !existingIatas.has(h.iata));
      candidateHubs = [...fallbackHubs, ...remainingHubs].slice(0, 16);
    }
  }

  // Sort candidate hubs by lowest detour factor
  candidateHubs.sort((a, b) => {
    const da = calculateDistanceKm(origAirport.lat, origAirport.lon, a.lat, a.lon) + calculateDistanceKm(a.lat, a.lon, destAirport.lat, destAirport.lon);
    const db = calculateDistanceKm(origAirport.lat, origAirport.lon, b.lat, b.lon) + calculateDistanceKm(b.lat, b.lon, destAirport.lat, destAirport.lon);
    return da - db;
  });

  const availableAirlines = getAirlinesForRoute(origUpper, destUpper);
  const candidates: FlightCandidate[] = [];
  let idCounter = 1;

  // -------------------------------------------------------------------------
  // 1. Direct Nonstop Candidates (6 candidates: 2 finalists, 2 over_budget, 1 bag_incompat, 1 finalist)
  // -------------------------------------------------------------------------
  for (let i = 0; i < 6; i++) {
    const air = availableAirlines[i % availableAirlines.length];
    const depHour = 6 + i * 3;
    const depIso = `${dateStr}T${String(depHour).padStart(2, '0')}:00:00${formatTz(origAirport.tzOffset)}`;
    const depUtcMs = new Date(depIso).getTime();
    const arrUtcMs = depUtcMs + directDuration * 60000;
    const arrIso = formatIsoWithOffset(new Date(arrUtcMs), destAirport.tzOffset);

    let fareDiffUsd = 0;
    let bagPieces = Math.max(1, baggagePieces);
    let bagKg = Math.max(23, baggageWeightKg);
    let fixtureClass: 'over_budget' | 'unsafe_connection' | 'baggage_incompatible' | 'finalist' = 'finalist';

    if (i === 2 || i === 3) {
      fareDiffUsd = budgetCeilingUsd + 120 + i * 35;
      fixtureClass = 'over_budget';
    } else if (i === 4) {
      bagPieces = 0;
      bagKg = 0;
      fareDiffUsd = Math.max(0, budgetCeilingUsd - 60);
      fixtureClass = 'baggage_incompatible';
    } else {
      fareDiffUsd = Math.max(0, Math.round(budgetCeilingUsd * 0.4 + i * 15));
      fixtureClass = 'finalist';
    }

    const flightNumber = `${air.code}${100 + i * 12}`;
    candidates.push({
      id: `cand-${String(idCounter++).padStart(2, '0')}`,
      fareKey: `FARE-DIR-${origUpper}${destUpper}-${air.code}-${i + 1}`,
      airlineCode: air.code,
      airlineName: air.name,
      label: `${air.name} · nonstop`,
      legs: [
        {
          flightNumber,
          airlineCode: air.code,
          airlineName: air.name,
          from: origUpper,
          to: destUpper,
          depIso,
          arrIso,
          durationMin: directDuration,
          aircraft: air.defaultAircraft,
          cabin: 'Economy',
        },
      ],
      layovers: [],
      depIso,
      arrIso,
      totalDurationMin: directDuration,
      stops: 0,
      minConnectionMin: null,
      fareDiffUsd,
      baggagePieces: bagPieces,
      baggageWeightKg: bagKg,
      seatsLeft: 3 + (i % 6),
      otp: air.otp,
      fixtureClass,
      metadata: {
        bookable: true,
        priceStatus: 'current',
        ticketingAvailable: true,
      },
    });
  }

  // -------------------------------------------------------------------------
  // 2. 1-Stop Connecting Candidates (34 candidates across valid transit hubs)
  // -------------------------------------------------------------------------
  const hubCount = Math.min(candidateHubs.length, 12);
  for (let h = 0; h < hubCount; h++) {
    const hub = candidateHubs[h];
    const d1 = calculateDistanceKm(origAirport.lat, origAirport.lon, hub.lat, hub.lon);
    const d2 = calculateDistanceKm(hub.lat, hub.lon, destAirport.lat, destAirport.lon);
    const dur1 = calculateFlightDurationMin(d1);
    const dur2 = calculateFlightDurationMin(d2);

    for (let k = 0; k < 3; k++) {
      if (candidates.length >= 40) break;

      const air1 = availableAirlines[(h * 2 + k) % availableAirlines.length];
      const air2 = availableAirlines[(h * 2 + k + 1) % availableAirlines.length];

      const depHour = 6 + ((h * 3 + k * 4) % 15);
      const depMinute = (k * 20) % 60;
      const depIso = `${dateStr}T${String(depHour).padStart(2, '0')}:${String(depMinute).padStart(2, '0')}:00${formatTz(origAirport.tzOffset)}`;
      const leg1DepUtc = new Date(depIso).getTime();
      const leg1ArrUtc = leg1DepUtc + dur1 * 60000;

      let layoverMin = Math.max(90, mctMin + 30);
      let fixtureClass: 'over_budget' | 'unsafe_connection' | 'baggage_incompatible' | 'finalist' = 'finalist';
      let fareDiffUsd = Math.max(0, budgetCeilingUsd - 40 + k * 10);
      let bagPieces = Math.max(1, baggagePieces);
      let bagKg = Math.max(23, baggageWeightKg);

      // Distribution across hard constraint buckets
      if (k === 1) {
        // ~35% unsafe connection (< MCT)
        layoverMin = Math.max(25, Math.min(mctMin - 15, 45));
        fixtureClass = 'unsafe_connection';
      } else if (k === 2 && h % 2 === 0) {
        // ~25% over budget
        fareDiffUsd = budgetCeilingUsd + 95 + h * 20;
        fixtureClass = 'over_budget';
      } else if (k === 2 && h % 2 !== 0) {
        // ~20% baggage incompatible
        bagPieces = 0;
        bagKg = 0;
        fareDiffUsd = Math.max(0, budgetCeilingUsd - 75);
        fixtureClass = 'baggage_incompatible';
      } else {
        // ~20% finalist
        fareDiffUsd = Math.max(0, Math.round(budgetCeilingUsd * 0.5 + k * 20));
        fixtureClass = 'finalist';
      }

      const leg2DepUtc = leg1ArrUtc + layoverMin * 60000;
      const leg2ArrUtc = leg2DepUtc + dur2 * 60000;

      const leg1ArrIso = formatIsoWithOffset(new Date(leg1ArrUtc), hub.tzOffset);
      const leg2DepIso = formatIsoWithOffset(new Date(leg2DepUtc), hub.tzOffset);
      const arrIso = formatIsoWithOffset(new Date(leg2ArrUtc), destAirport.tzOffset);

      const flightNumber1 = `${air1.code}${200 + h * 20 + k * 2}`;
      const flightNumber2 = `${air2.code}${300 + h * 20 + k * 2 + 1}`;

      candidates.push({
        id: `cand-${String(idCounter++).padStart(2, '0')}`,
        fareKey: `FARE-HUB-${hub.iata}-${air1.code}-${k + 1}`,
        airlineCode: air1.code,
        airlineName: air1.name,
        label: `${air1.name} / ${air2.name} · via ${hub.city}`,
        legs: [
          {
            flightNumber: flightNumber1,
            airlineCode: air1.code,
            airlineName: air1.name,
            from: origUpper,
            to: hub.iata,
            depIso,
            arrIso: leg1ArrIso,
            durationMin: dur1,
            aircraft: air1.defaultAircraft,
            cabin: 'Economy',
          },
          {
            flightNumber: flightNumber2,
            airlineCode: air2.code,
            airlineName: air2.name,
            from: hub.iata,
            to: destUpper,
            depIso: leg2DepIso,
            arrIso,
            durationMin: dur2,
            aircraft: air2.defaultAircraft,
            cabin: 'Economy',
          },
        ],
        layovers: [{ airport: hub.iata, minutes: layoverMin }],
        depIso,
        arrIso,
        totalDurationMin: dur1 + layoverMin + dur2,
        stops: 1,
        minConnectionMin: layoverMin,
        fareDiffUsd,
        baggagePieces: bagPieces,
        baggageWeightKg: bagKg,
        seatsLeft: 2 + ((h + k) % 7),
        otp: Math.min(air1.otp, air2.otp),
        fixtureClass,
        metadata: {
          bookable: true,
          priceStatus: 'current',
          ticketingAvailable: true,
        },
      });
    }
  }

  return candidates;
}
