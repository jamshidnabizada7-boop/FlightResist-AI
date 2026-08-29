/**
 * FlightResist AI 2.0 — AtlasSandboxProvider (verified `atlas-flight` CLI 0.3.12)
 *
 * Rewritten in Phase 3 from the capability matrix verified end-to-end in
 * Phase 1. Every CLI flag and JSON field below is taken from REAL CLI output,
 * not invented. Branches on response `code`, never `message` (per Atlas rule).
 *
 * Verified command surface (Phase 1):
 *   search             --origin --destination --depart --adults --json
 *   offer verify       --offer-id --json        → yields booking_id + traveler_id
 *   booking confirm-price --booking-id --json   → yields PRICE_CONFIRMED
 *   booking baggage list/select --booking-id [--traveler-id --segment-id --baggage-id]
 *   order create       --booking-id --passengers-stdin (JSON via stdin)
 *   order pay          --confirmation-id --json → yields airline_pnrs / ticket_numbers
 *   order status       --order-no --json        → yields ticketing_available / ticketing_blocker
 *
 * Real multi-step booking flow (Phase 1 verified):
 *   search → offer verify → booking confirm-price → order create → order pay → TICKETED
 *
 * Never retries order creation or payment (SKILL.md safety rule).
 */

import { execFile, spawn as spawnProcess } from 'node:child_process';
import { promisify } from 'node:util';
import type { FlightCandidate, FlightLeg, Layover, ProviderMode } from '../types';
import { getAirport } from '../airports-data';
import { getAirline } from '../airlines-data';
import {
  BaseTravelProvider,
  ProviderUnavailableError,
  type FareVerification,
  type OrderCreation,
  type OrderStatus,
  type OrderStepReport,
  type PassengerData,
} from './base';

const exec = promisify(execFile);
const CLI = 'atlas-flight';
const PROBE_TTL_MS = 60_000;
const CLI_TIMEOUT_MS = 20_000;
// order pay polls internally for up to 120 s waiting for ticketing.
const PAY_TIMEOUT_MS = 180_000;

const AIRLINE_NAMES: Record<string, string> = {
  '7C': 'Jeju Air', SQ: 'Singapore Airlines', CX: 'Cathay Pacific',
  TR: 'Scoot', VJ: 'VietJet Air', NH: 'ANA', JL: 'Japan Airlines',
  BR: 'EVA Air', CI: 'China Airlines', KE: 'Korean Air',
  OZ: 'Asiana Airlines', MH: 'Malaysia Airlines', TG: 'Thai Airways',
  VN: 'Vietnam Airlines', PR: 'Philippine Airlines',
  TW: "T'way Air", FD: 'Thai AirAsia', XJ: 'Thai AirAsia X',
  ZG: 'ZIPAIR', UO: 'HK Express', MM: 'Peach Aviation',
  SL: 'Thai Lion Air', AK: 'AirAsia', D7: 'AirAsia X',
  BX: 'Air Busan', RS: 'Air Seoul', ZE: 'Eastar Jet', LJ: 'Jin Air',
  MU: 'China Eastern', CZ: 'China Southern', CA: 'Air China',
  HX: 'Hong Kong Airlines', IT: 'Tigerair Taiwan',
};

// ---------------------------------------------------------------------------
// Per-offer session cache — carries IDs through search → verify → confirm.
// Lost on process restart; a new search rebuilds it. This is intentional:
// Atlas offers expire (expire_time ~16 min), so we never resurrect a stale ID.
// ---------------------------------------------------------------------------

interface AtlasOfferCache {
  offerId: string;
  searchId: string;
  bookingId: string | null;       // populated by offer verify
  travelerIds: string[];         // populated by offer verify
  segmentIds: string[];          // populated by offer verify
  currency: string;
  price: number;
  priceStatus: 'current' | 'reference' | string;
  bookable: boolean;
  rawOffer?: Record<string, unknown>;
  ticketingAvailable?: boolean;
  ticketingBlocker?: string;
  ticketingActivationUrl?: string;
  confirmedAtIso: string | null; // populated by booking confirm-price
}

const offerCache = new Map<string, AtlasOfferCache>();

/** Session-scoped cheapest-offer baseline, used to compute fare deltas. */
let priceBaseline = 0;

// ---------------------------------------------------------------------------
// Atlas JSON envelope types (Phase 1 schemas)
// ---------------------------------------------------------------------------

interface AtlasEnvelope {
  schema_version?: string;
  status: string;
  code: string;
  message: string;
  retryable: boolean;
  request_id: string | null;
  data: Record<string, unknown>;
  details?: Record<string, unknown>;
}

interface AtlasSegment {
  segment_id?: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string; // "202608270050"
  arrival_time: string;
  carrier: string;
  operating_carrier: string | null;
  flight_number: string;
  duration_minutes: number;
  cabin_class: number;
  direction: string;
}

// ---------------------------------------------------------------------------
// Runtime probe
// ---------------------------------------------------------------------------

export interface AtlasProbeResult {
  available: boolean;
  detail: string;
  checkedAtIso: string;
  /** Machine-readable cause when `available` is false (secure store missing, CLI absent). */
  reason?: string;
  authenticated?: boolean;
  ticketingAvailable?: boolean;
  ticketingBlocker?: string;
  ticketingActivationUrl?: string;
}

let probeCache: { result: AtlasProbeResult; at: number } | null = null;

export async function probeAtlas(): Promise<AtlasProbeResult> {
  if (probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) return probeCache.result;

  let result: AtlasProbeResult;
  try {
    const { stdout: vOut } = await exec(CLI, ['--version'], { timeout: 10000 });
    const v = vOut.trim().slice(0, 80);

    // Auth status gates more than ticketing: the CLI stores its credentials in
    // an OS secure-credential facility. A container without one answers every
    // real command with SECURE_STORE_UNAVAILABLE even though --version works,
    // so that code must fail the probe — otherwise the UI reports "Atlas
    // Connected" and every live operation fails later.
    let authenticated: boolean | undefined;
    let ticketingAvailable: boolean | undefined;
    let ticketingBlocker: string | undefined;
    let ticketingActivationUrl: string | undefined;
    try {
      const { stdout: aOut } = await exec(CLI, ['auth', 'status', '--json'], { timeout: 10000 });
      const env = JSON.parse(aOut) as AtlasEnvelope;
      const d = (env.data ?? {}) as Record<string, unknown>;
      authenticated = typeof d.authenticated === 'boolean' ? d.authenticated : undefined;
      ticketingAvailable = typeof d.ticketing_available === 'boolean' ? d.ticketing_available : undefined;
      ticketingBlocker = typeof d.ticketing_blocker === 'string' ? d.ticketing_blocker : undefined;
      ticketingActivationUrl = typeof d.ticketing_activation_url === 'string' ? d.ticketing_activation_url : undefined;
      if (env.code === 'SECURE_STORE_UNAVAILABLE') {
        result = {
          available: false,
          detail:
            '`atlas-flight` CLI is installed but its secure credential store is unavailable in this deployment (no OS keyring/secret-service) — live Atlas operations cannot run. Use the self-hosted version with a desktop environment for real flights.',
          checkedAtIso: new Date().toISOString(),
          reason: 'SECURE_STORE_UNAVAILABLE',
        };
        probeCache = { result, at: Date.now() };
        return result;
      }
    } catch {
      /* auth probe failure is non-fatal — search still works */
    }

    result = {
      available: true,
      detail: `${CLI} CLI detected: ${v}; authenticated=${authenticated ?? 'unknown'}; ticketing_available=${ticketingAvailable ?? 'unknown'}${ticketingBlocker ? ` (${ticketingBlocker})` : ''}`,
      checkedAtIso: new Date().toISOString(),
      authenticated,
      ticketingAvailable,
      ticketingBlocker,
      ticketingActivationUrl,
    };
  } catch {
    result = {
      available: false,
      detail: `\`atlas-flight\` CLI not found on PATH (probe executed, exit≠0 or ENOENT) — Atlas sandbox transactions cannot run.`,
      checkedAtIso: new Date().toISOString(),
      reason: 'CLI_NOT_FOUND',
    };
  }
  probeCache = { result, at: Date.now() };
  return result;
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

async function runCli(args: string[], stdin?: string, timeoutMs?: number): Promise<AtlasEnvelope> {
  const probe = await probeAtlas();
  if (!probe.available) {
    throw new ProviderUnavailableError('AtlasSandboxProvider', probe.detail);
  }
  const timeout = timeoutMs ?? CLI_TIMEOUT_MS;
  try {
    const parsed = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
      const child = spawnProcess(CLI, args, { timeout });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (c) => { stdout += c; });
      child.stderr.on('data', (c) => { stderr += c; });
      child.on('error', reject);
      child.on('close', (code) => resolve({ stdout, stderr, code }));
      if (stdin !== undefined) {
        child.stdin.write(stdin);
        child.stdin.end();
      } else {
        child.stdin.end();
      }
    });
    if (!parsed.stdout) {
      throw new Error(`Atlas CLI exited with no stdout (code=${parsed.code}): ${parsed.stderr.slice(0, 200)}`);
    }
    let env: AtlasEnvelope;
    try {
      env = JSON.parse(parsed.stdout) as AtlasEnvelope;
    } catch {
      throw new Error(`Atlas CLI returned non-JSON output: ${parsed.stdout.slice(0, 200)}${parsed.stderr ? ' | stderr: ' + parsed.stderr.slice(0, 200) : ''}`);
    }
    return env;
  } catch (err) {
    throw new ProviderUnavailableError(
      'AtlasSandboxProvider',
      `CLI invocation failed (${args.join(' ')}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Branch on `code` (never `message`). Throws with a clear, actionable reason. */
function assertCode(env: AtlasEnvelope, expected: string, context: string): void {
  if (env.code !== expected) {
    const detail = (env.details && typeof env.details === 'object' ? JSON.stringify(env.details) : '') || env.message;
    throw new Error(
      `Atlas ${context} expected code=${expected}, got code=${env.code} (${env.status}). ${detail}`.trim(),
    );
  }
}

/** Convert airport IATA into its UTC offset hours using global airport database. */
function airportOffset(airport: string): number {
  const ap = getAirport(airport);
  if (ap) return ap.tzOffset;
  const TZ: Record<string, number> = {
    // Asian regional fallbacks
    NRT: 9, HND: 9, KIX: 9, FUK: 9, CTS: 9, NGO: 9, OKA: 9,
    ICN: 9, GMP: 9, PUS: 9, CJU: 9,
    SIN: 8, KUL: 8, PEN: 8, BKI: 8,
    MNL: 8, CEB: 8, DVO: 8,
    HKG: 8, MFM: 8,
    TPE: 8, TSA: 8, KHH: 8,
    PVG: 8, SHA: 8, PEK: 8, PKX: 8, CAN: 8, SZX: 8, CTU: 8, TFU: 8,
    WUH: 8, CKG: 8, HGH: 8, NKG: 8, XMN: 8, TAO: 8, KMG: 8, XIY: 8,
    DPS: 8,
    BKK: 7, DMK: 7, HKT: 7, CNX: 7,
    SGN: 7, HAN: 7, DAD: 7, CXR: 7,
    PNH: 7, REP: 7,
    VTE: 7,
    CGK: 7, SUB: 7,
    // European fallbacks
    LHR: 1, LGW: 1, CDG: 2, FRA: 2, AMS: 2, MAD: 2, FCO: 2, ZRH: 2, VIE: 2, IST: 3,
    // North American fallbacks
    JFK: -4, EWR: -4, BOS: -4, ORD: -5, ATL: -4, MIA: -4, DFW: -5, DEN: -6, SFO: -7, LAX: -7, SEA: -7, YVR: -7, YYZ: -4, MEX: -6,
    // Oceania fallbacks
    SYD: 10, MEL: 10, BNE: 10, AKL: 12,
    // Middle East / Africa fallbacks
    DXB: 4, DOH: 3, AUH: 4, JNB: 2,
    // South America fallbacks
    GRU: -3,
  };
  return TZ[airport.toUpperCase()] ?? 0;
}

/**
 * Normalizes Atlas segment timestamps (e.g. "202611150810") onto FlightResist-AI's
 * scenario reference dates (DAY0: 2026-08-27, DAY1: 2026-08-28), preserving clock
 * times, segment elapsed durations, layover connection times, and airport UTC offsets.
 */
function normalizeAtlasTimeToScenarioIso(
  raw: string,
  airport: string,
  originDepartureTimeRaw?: string,
): string {
  if (raw.includes('T') || raw.includes('-')) return raw;
  if (raw.length !== 12) return raw;

  const y = Number(raw.slice(0, 4));
  const mo = Number(raw.slice(4, 6)) - 1;
  const d = Number(raw.slice(6, 8));
  const h = raw.slice(8, 10);
  const mi = raw.slice(10, 12);
  const segDateUtc = Date.UTC(y, mo, d);

  let dayDiff = 0;
  if (originDepartureTimeRaw && originDepartureTimeRaw.length === 12) {
    const oy = Number(originDepartureTimeRaw.slice(0, 4));
    const omo = Number(originDepartureTimeRaw.slice(4, 6)) - 1;
    const od = Number(originDepartureTimeRaw.slice(6, 8));
    const originDateUtc = Date.UTC(oy, omo, od);
    dayDiff = Math.round((segDateUtc - originDateUtc) / (24 * 60 * 60 * 1000));
  }

  // Anchor to DAY0: 2026-08-27
  const SCENARIO_DAY0_UTC = Date.UTC(2026, 7, 27);
  const targetUtcMs = SCENARIO_DAY0_UTC + dayDiff * (24 * 60 * 60 * 1000);
  const targetDate = new Date(targetUtcMs);
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const targetDay = String(targetDate.getUTCDate()).padStart(2, '0');

  const tz = airportOffset(airport);
  const sign = tz >= 0 ? '+' : '-';
  const atz = Math.abs(tz);
  const tzStr = `${sign}${String(atz).padStart(2, '0')}:00`;

  return `${targetYear}-${targetMonth}-${targetDay}T${h}:${mi}:00${tzStr}`;
}

function cabinLabel(cls: number): string {
  switch (cls) {
    case 1: return 'Economy';
    case 2: return 'Premium Economy';
    case 3: return 'Business';
    case 4: return 'First';
    default: return 'Economy';
  }
}

// ---------------------------------------------------------------------------
// Mapping: Atlas offer → FlightCandidate (deterministic ID per offer)
// ---------------------------------------------------------------------------

function mapOfferToCandidate(
  offerId: string,
  offer: Record<string, unknown>,
  searchId: string,
  index: number,
  baselinePrice: number,
  probe?: AtlasProbeResult,
): FlightCandidate {
  const segments = Array.isArray(offer.segments) ? (offer.segments as AtlasSegment[]) : [];
  const price = Number(offer.total_price ?? 0);
  const currency = String(offer.currency ?? 'USD');
  const bookable = Boolean(offer.bookable);
  const priceStatus = (offer.price_status === 'current' ? 'current' : 'reference') as 'current' | 'reference';
  const ticketingAvailable = Boolean(probe?.ticketingAvailable);
  const ticketingBlocker = probe?.ticketingBlocker;

  const originDepRaw = segments[0] ? String(segments[0].departure_time) : undefined;

  const legs: FlightLeg[] = segments.map((seg) => {
    const fromAirport = String(seg.departure_airport);
    const toAirport = String(seg.arrival_airport);
    const depIso = normalizeAtlasTimeToScenarioIso(String(seg.departure_time), fromAirport, originDepRaw);
    const arrIso = normalizeAtlasTimeToScenarioIso(String(seg.arrival_time), toAirport, originDepRaw);
    const segCarrier = String(seg.carrier);
    const segFlightNo = String(seg.flight_number);
    const segDuration = Number(seg.duration_minutes ?? 0);
    const calcDuration = Math.max(0, Math.round((new Date(arrIso).getTime() - new Date(depIso).getTime()) / 60000));

    return {
      flightNumber: segFlightNo,
      airlineCode: segCarrier,
      airlineName: getAirline(segCarrier)?.name ?? AIRLINE_NAMES[segCarrier] ?? segCarrier,
      from: fromAirport,
      to: toAirport,
      depIso,
      arrIso,
      durationMin: segDuration > 0 ? segDuration : calcDuration,
      aircraft: 'Live Atlas',
      cabin: cabinLabel(Number(seg.cabin_class ?? 1)),
    };
  });

  const layovers: Layover[] = [];
  for (let i = 1; i < legs.length; i++) {
    const prevLeg = legs[i - 1];
    const currLeg = legs[i];
    const connMin = Math.max(
      0,
      Math.round((new Date(currLeg.depIso).getTime() - new Date(prevLeg.arrIso).getTime()) / 60000),
    );
    layovers.push({ airport: prevLeg.to, minutes: connMin });
  }

  const depIso = legs[0]?.depIso ?? (originDepRaw ? normalizeAtlasTimeToScenarioIso(originDepRaw, 'SIN') : '2026-08-27T08:00:00+08:00');
  const arrIso = legs[legs.length - 1]?.arrIso ?? depIso;
  const totalDurationMin =
    legs.reduce((acc, l) => acc + l.durationMin, 0) +
    layovers.reduce((acc, l) => acc + l.minutes, 0);

  const ticketingActivationUrl = probe?.ticketingActivationUrl;

  // Cache the full search context and raw offer for subsequent pipeline stages
  offerCache.set(offerId, {
    offerId,
    searchId,
    bookingId: null,
    travelerIds: [],
    segmentIds: [],
    currency,
    price,
    priceStatus,
    bookable,
    rawOffer: offer,
    ticketingAvailable,
    ticketingBlocker,
    ticketingActivationUrl,
    confirmedAtIso: null,
  });

  const primaryAirline = segments[0]?.carrier ?? 'XX';
  const primaryAirlineName = getAirline(primaryAirline)?.name ?? AIRLINE_NAMES[primaryAirline] ?? primaryAirline;
  const label =
    legs.length === 1
      ? `${primaryAirlineName} (direct)`
      : `${primaryAirlineName} via ${layovers.map((l) => l.airport).join('/')}`;

  const fareDiffUsd = isNaN(price) || price <= 0 || baselinePrice <= 0
    ? 0
    : Math.max(0, Math.round((price - baselinePrice) * 100) / 100);

  return {
    id: `atlas-${String(index).padStart(2, '0')}`,
    fareKey: offerId,
    airlineCode: primaryAirline,
    airlineName: primaryAirlineName,
    label,
    legs,
    layovers,
    depIso,
    arrIso,
    totalDurationMin,
    stops: Math.max(0, legs.length - 1),
    minConnectionMin: layovers.length > 0 ? Math.min(...layovers.map((l) => l.minutes)) : null,
    fareDiffUsd,
    baggagePieces: 1,
    baggageWeightKg: 23,
    seatsLeft: 9,
    otp: 0.85,
    metadata: {
      bookable,
      priceStatus,
      ticketingAvailable,
      ticketingBlocker,
    },
  };
}

/** Convert a flat name ("Wei Chen") to Atlas FAMILY/GIVEN uppercase ("CHEN/WEI"). */
function atlasNameFormat(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const given = parts.slice(0, -1).join(' ');
    const family = parts[parts.length - 1];
    return `${family}/${given}`.toUpperCase();
  }
  return name.toUpperCase();
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class AtlasSandboxProvider extends BaseTravelProvider {
  readonly mode: ProviderMode = 'ATLAS_SANDBOX';

  /**
   * Retry a non-side-effecting Atlas operation once after a short delay.
   * Only used for search and fare verification — order creation and payment
   * are NEVER retried (SKILL.md safety rule).
   */
  private async retryOnce<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err instanceof ProviderUnavailableError ||
        (err instanceof Error && /timed?\s*out|timeout|ETIMEDOUT/i.test(err.message));
      if (!isRetryable) throw err;
      console.warn(`[AtlasSandbox] ${label} failed (${err instanceof Error ? err.message : String(err)}), retrying once in 2 s…`);
      await new Promise<void>((r) => setTimeout(r, 2000));
      return fn();
    }
  }

  async searchFlights(origin: string, destination: string, date: string): Promise<FlightCandidate[]> {
    return this.retryOnce('searchFlights', async () => {
      const probe = await probeAtlas();
      const env = await runCli([
        'search',
        '--origin', origin,
        '--destination', destination,
        '--depart', date,
        '--adults', '1',
        '--json',
      ]);
      assertCode(env, 'FLIGHT_SEARCHED', 'search');
      const data = env.data as { search_id?: string; offers?: Record<string, unknown>[] };
      const searchId = String(data.search_id ?? '');
      const offers = Array.isArray(data.offers) ? data.offers : [];

      // Ingest all offers from live search without prematurely dropping reference-only / unbookable offers
      const validPrices = offers
        .map((o) => Number(o.total_price))
        .filter((p) => !isNaN(p) && p > 0);
      const baseline = validPrices.length > 0 ? Math.min(...validPrices) : 0;
      priceBaseline = baseline;

      return offers.map((o, i) =>
        mapOfferToCandidate(
          String(o.offer_id ?? `offer-${i}`),
          o,
          searchId,
          i,
          baseline,
          probe,
        ),
      );
    });
  }

  async verifyFare(fareKey: string): Promise<FareVerification> {
    return this.retryOnce('verifyFare', async () => {
      const cached = offerCache.get(fareKey);
      if (!cached) {
        throw new Error(`Atlas offer "${fareKey}" not in session cache — run searchFlights first or the offer expired.`);
      }

      // Check if the offer is reference-only, unbookable, or ticketing is blocked
      if (cached.priceStatus === 'reference' || !cached.bookable) {
        const activationInfo = cached.ticketingActivationUrl ? ` (ATRIP workspace: ${cached.ticketingActivationUrl})` : '';
        const blockerInfo = cached.ticketingBlocker ? ` Blocker: ${cached.ticketingBlocker}.` : '';
        throw new Error(
          `UNBOOKABLE_OFFER: Offer ${cached.offerId} is reference-only inventory (price_status=${cached.priceStatus}, bookable=${cached.bookable}). It supports real-time flight price search and comparison only, and does not support price verification, order creation, or ticketing.${blockerInfo}${activationInfo}`,
        );
      }

      if (cached.ticketingAvailable === false && cached.ticketingBlocker) {
        const activationInfo = cached.ticketingActivationUrl ? ` (ATRIP workspace: ${cached.ticketingActivationUrl})` : '';
        throw new Error(
          `UNBOOKABLE_OFFER: Atlas ticketing is currently blocked (${cached.ticketingBlocker})${activationInfo}. Price verification, order creation, and ticketing are unavailable until account activation is completed.`,
        );
      }

      // Step 1: offer verify — yields booking_id + traveler_id.
      const verified = await runCli(['offer', 'verify', '--offer-id', cached.offerId, '--json']);
      if (verified.code !== 'OFFER_VERIFIED') {
        const detail =
          (verified.details && typeof verified.details === 'object' ? JSON.stringify(verified.details) : '') ||
          verified.message;
        throw new Error(`Atlas offer verify returned code=${verified.code}: ${detail || verified.message || 'Offer could not be verified'}`);
      }

      const vData = verified.data as {
        booking_id?: string;
        previous_price?: number;
        current_price?: number;
        currency?: string;
        price_change?: string;
        travelers?: { traveler_id: string }[];
        segments?: { segment_id: string }[];
      };

      cached.bookingId = String(vData.booking_id ?? '');
      cached.travelerIds = (vData.travelers ?? []).map((t) => String(t.traveler_id));
      cached.segmentIds = (vData.segments ?? []).map((s) => String(s.segment_id));
      cached.price = Number(vData.current_price ?? cached.price);
      cached.currency = String(vData.currency ?? cached.currency);

      // Step 2: booking confirm-price — Per SKILL.md, ONLY call confirm-price when price_change === 'increased'!
      if (vData.price_change === 'increased') {
        const confirmed = await runCli(['booking', 'confirm-price', '--booking-id', cached.bookingId, '--json']);
        if (confirmed.code !== 'PRICE_CONFIRMED' && confirmed.code !== 'PRICE_CHANGED') {
          const detail =
            (confirmed.details && typeof confirmed.details === 'object' ? JSON.stringify(confirmed.details) : '') ||
            confirmed.message;
          throw new Error(`Atlas booking confirm-price returned code=${confirmed.code}: ${detail}`);
        }
        const cData = confirmed.data as { current_price?: number; currency?: string };
        cached.price = Number(cData.current_price ?? cached.price);
      }

      cached.confirmedAtIso = new Date().toISOString();

      return {
        fareKey,
        valid: true,
        fareDiffUsd: Math.max(0, Math.round((cached.price - priceBaseline) * 100) / 100),
        currency: cached.currency,
        fareBasis: `ATLAS-${cached.priceStatus.toUpperCase()}`,
        ttlMin: 15,
        verifiedAtIso: cached.confirmedAtIso,
        providerLatencyMs: 0,
      };
    });
  }

  async createAndPayOrder(
    fareKey: string,
    passenger: PassengerData,
    onStep?: (step: OrderStepReport) => void,
  ): Promise<OrderCreation> {
    const cached = offerCache.get(fareKey);
    if (!cached) {
      throw new Error(`Atlas offer "${fareKey}" not found in session cache — session may have expired. Please search again.`);
    }
    if (!cached.bookingId) {
      throw new Error(`Atlas booking for ${fareKey} not verified — verifyFare must complete before order create.`);
    }
    const travelerId = cached.travelerIds[0];
    if (!travelerId) {
      throw new Error(`Atlas offer ${fareKey} returned no traveler_id — cannot build passenger payload.`);
    }

    const atlasName = atlasNameFormat(passenger.name);

    // ---- 1. Order create (passenger stdin JSON object) ----------------------
    const t0 = Date.now();
    const passengerPayload = {
      passengers: [
        {
          traveler_id: travelerId,
          name: atlasName, // FAMILY/GIVEN uppercase per Atlas convention
          passenger_type: 'adult',
          gender: 'M',
          birthday: '1990-01-01',
          nationality: 'SG',
          // Sandbox passport — some routes require `document` even when
          // verify lists it outside required_fields. Including it by default
          // avoids a PASSENGER_INFO_REQUIRED round-trip.
          document: {
            type: 'PP',
            number: 'SG0000000',
            issuing_country: 'SG',
            expires: '2030-12-31',
          },
        },
      ],
      contact: {
        name: atlasName,
        email: 'agent@flightresist.ai',
      },
    };

    onStep?.({
      name: 'create_order',
      detail: `Submitting Atlas order for ${passenger.name} (booking ${cached.bookingId})`,
      durationMs: 0,
    });

    const orderEnv = await runCli(
      ['order', 'create', '--booking-id', cached.bookingId, '--passengers-stdin', '--json'],
      JSON.stringify(passengerPayload),
    );
    if (orderEnv.code !== 'PAYMENT_CONFIRMATION_REQUIRED') {
      const orderUrl = (orderEnv.data?.order_url as string) || (orderEnv.details?.url as string) || undefined;
      const detail = (orderEnv.details && typeof orderEnv.details === 'object' ? JSON.stringify(orderEnv.details) : '') || orderEnv.message;
      throw new Error(
        `Atlas order create failed (code=${orderEnv.code}): ${detail}${orderUrl ? ` — Order link: ${orderUrl}` : ''}`,
      );
    }
    const orderData = orderEnv.data as {
      order_no?: string;
      total_price?: number;
      payment_confirmation_id?: string;
      order_url?: string;
    };
    const orderNo = String(orderData.order_no ?? '');
    const paymentConfirmationId = String(orderData.payment_confirmation_id ?? '');
    const initialOrderUrl = orderData.order_url;
    if (!orderNo || !paymentConfirmationId) {
      throw new Error(`Atlas order create missing order_no or payment_confirmation_id: ${JSON.stringify(orderData)}`);
    }

    const createMs = Date.now() - t0;
    onStep?.({
      name: 'create_order',
      detail: `Atlas order ${orderNo} created — $${orderData.total_price ?? cached.price} ${cached.currency}${initialOrderUrl ? ` (${initialOrderUrl})` : ''}`,
      durationMs: createMs,
    });

    // ---- 2. Order pay (NEVER retry — SKILL.md safety rule) ------------------
    const payStart = Date.now();
    const payEnv = await runCli(['order', 'pay', '--confirmation-id', paymentConfirmationId, '--json'], undefined, PAY_TIMEOUT_MS);
    const payMs = Date.now() - payStart;
    const payData = (payEnv.data ?? {}) as {
      order_url?: string;
      order_no?: string;
      airline_pnrs?: string[];
      ticket_numbers?: string[];
    };
    const resolvedOrderUrl = payData.order_url || initialOrderUrl || (payEnv.details?.url as string) || undefined;

    // PAYMENT_BALANCE_CHECK_REQUIRED (411) safely surfaced without retrying payment
    if (payEnv.code === 'PAYMENT_BALANCE_CHECK_REQUIRED') {
      onStep?.({
        name: 'authorize_payment',
        detail: `Payment balance check required for order ${orderNo}. Account balance may be insufficient.${resolvedOrderUrl ? ` Order URL: ${resolvedOrderUrl}` : ''}`,
        durationMs: payMs,
      });
      onStep?.({
        name: 'issue_ticket',
        detail: `Order ${orderNo} created, payment pending balance verification. Do NOT retry payment.`,
        durationMs: 0,
      });
      throw new Error(
        `PAYMENT_BALANCE_CHECK_REQUIRED: Payment could not be confirmed for order ${orderNo}. ATRIP account balance may be insufficient. Check balance at ATRIP workspace${resolvedOrderUrl ? ` (${resolvedOrderUrl})` : ''}. Do NOT re-submit payment directly.`,
      );
    }

    // TICKETING_PENDING is a valid intermediate outcome — the CLI polled for
    // up to 120 s and ticketing has not completed yet. Treat as success; the
    // caller can use getOrderStatus to track final ticketing.
    const isTicketed = payEnv.code === 'TICKETED';
    const isPending = payEnv.code === 'TICKETING_PENDING';
    if (!isTicketed && !isPending) {
      assertCode(payEnv, 'TICKETED', 'order pay');
    }
    const pnr = Array.isArray(payData.airline_pnrs) && payData.airline_pnrs.length > 0
      ? String(payData.airline_pnrs[0])
      : null;
    const ticketNo = Array.isArray(payData.ticket_numbers) && payData.ticket_numbers.length > 0
      ? String(payData.ticket_numbers[0])
      : null;

    onStep?.({
      name: 'authorize_payment',
      detail: `Sandbox payment ${isPending ? 'submitted' : 'authorized'} — order ${orderNo}${resolvedOrderUrl ? ` (${resolvedOrderUrl})` : ''}`,
      durationMs: payMs,
    });
    onStep?.({
      name: 'issue_ticket',
      detail: isPending
        ? `Ticketing pending — PNR will be issued asynchronously (order ${orderNo})${resolvedOrderUrl ? ` (${resolvedOrderUrl})` : ''}`
        : `Ticketed — PNR ${pnr ?? 'N/A'}${ticketNo ? `, ticket ${ticketNo}` : ''}`,
      durationMs: 0,
    });

    return {
      orderId: orderNo,
      pnr, // REAL PNR from Atlas (sandbox produces e.g. "S78066"); never fabricated.
      demoReference: null, // Atlas mode does not use SIM- prefixes.
      paymentRef: paymentConfirmationId,
      ticketRef: ticketNo,
      status: 'CONFIRMED',
      passengerName: passenger.name,
      fareKey,
    };
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    const t0 = Date.now();
    const env = await runCli(['order', 'status', '--order-no', orderId, '--json']);
    // Order status uses a wider set of success codes than the booking flow;
    // any code that is not an error envelope is treated as a valid status read.
    const d = env.data as {
      ticketing_available?: boolean;
      ticketing_blocker?: string;
      ticketing_activation_url?: string;
      order_status?: string;
      airline_pnrs?: string[];
    };
    const isErr = env.status === 'error' || env.code.startsWith('ERROR') || env.code === 'ORDER_NOT_FOUND';
    if (isErr) {
      throw new Error(`Atlas order status for ${orderId}: code=${env.code} — ${env.message}`);
    }

    // Normalize to a FlightResist OrderStatus.status.
    const raw = String(d.order_status ?? env.code).toUpperCase();
    let status: OrderStatus['status'];
    if (raw.includes('TICKETED') || d.ticketing_available === true) status = 'TICKETED';
    else if (raw.includes('CONFIRM') || raw.includes('PAID')) status = 'CONFIRMED';
    else if (raw.includes('PEND') || raw.includes('AWAIT')) status = 'PENDING';
    else if (raw.includes('FAIL') || raw.includes('CANCEL')) status = 'FAILED';
    else status = 'CONFIRMED';

    const pnr = Array.isArray(d.airline_pnrs) && d.airline_pnrs.length > 0 ? String(d.airline_pnrs[0]) : null;

    return {
      orderId,
      status,
      pnr,
      demoReference: null,
      checkedAtIso: new Date().toISOString(),
      providerLatencyMs: Date.now() - t0,
    };
  }
}
