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
  priceStatus: string;
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

/** Convert "202608270050" at a given airport into an ISO-8601 string with that airport's UTC offset. */
function airportOffset(airport: string): number {
  // Minimal UTC-offset table — matches fixture.ts TZ. Extend if Atlas ever
  // surfaces an airport outside this set.
  const TZ: Record<string, number> = {
    SIN: 8, HKG: 8, TPE: 8, KUL: 8, MNL: 8, ICN: 9, NRT: 9, BKK: 7, SGN: 7, PVG: 8,
  };
  return TZ[airport] ?? 0;
}

function atlasTimeToIso(raw: string, airport: string): string {
  if (raw.length !== 12) return raw; // pass through anything non-canonical
  const y = raw.slice(0, 4);
  const mo = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const h = raw.slice(8, 10);
  const mi = raw.slice(10, 12);
  const tz = airportOffset(airport);
  const sign = tz >= 0 ? '+' : '-';
  const atz = Math.abs(tz);
  return `${y}-${mo}-${d}T${h}:${mi}:00${sign}${String(atz).padStart(2, '0')}:00`;
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

function mapOfferToCandidate(offerId: string, offer: Record<string, unknown>, searchId: string, index: number, baselinePrice: number): FlightCandidate {
  const segments = Array.isArray(offer.segments) ? (offer.segments as AtlasSegment[]) : [];
  const price = Number(offer.total_price ?? 0);
  const currency = String(offer.currency ?? 'USD');

  const legs: FlightLeg[] = segments.map((seg) => ({
    flightNumber: String(seg.flight_number),
    airlineCode: String(seg.carrier),
    airlineName: AIRLINE_NAMES[seg.carrier] ?? String(seg.carrier),
    from: String(seg.departure_airport),
    to: String(seg.arrival_airport),
    depIso: atlasTimeToIso(String(seg.departure_time), String(seg.departure_airport)),
    arrIso: atlasTimeToIso(String(seg.arrival_time), String(seg.arrival_airport)),
    durationMin: Number(seg.duration_minutes ?? 0),
    aircraft: 'Live Atlas',
    cabin: cabinLabel(Number(seg.cabin_class ?? 1)),
  }));

  const layovers: Layover[] = [];
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    const prevArrMin = atlasTimeToMinutes(String(prev.arrival_time));
    const currDepMin = atlasTimeToMinutes(String(curr.departure_time));
    const connMin = Math.max(0, currDepMin - prevArrMin);
    layovers.push({ airport: String(prev.arrival_airport), minutes: connMin });
  }

  const depIso = legs[0]?.depIso ?? atlasTimeToIso(String((segments[0] as AtlasSegment | undefined)?.departure_time ?? ''), String((segments[0] as AtlasSegment | undefined)?.departure_airport ?? ''));
  const arrIso = legs[legs.length - 1]?.arrIso ?? depIso;
  const totalDurationMin = segments.reduce((acc, s) => acc + Number(s.duration_minutes ?? 0), 0) + layovers.reduce((acc, l) => acc + l.minutes, 0);

  // Cache the raw offer for verifyFare to pick up.
  offerCache.set(offerId, {
    offerId,
    searchId,
    bookingId: null,
    travelerIds: [],
    segmentIds: [],
    currency,
    price,
    priceStatus: String(offer.price_status ?? 'current'),
    confirmedAtIso: null,
  });

  const primaryAirline = segments[0]?.carrier ?? 'XX';
  const label =
    legs.length === 1
      ? `${AIRLINE_NAMES[primaryAirline] ?? primaryAirline} (direct)`
      : `${AIRLINE_NAMES[primaryAirline] ?? primaryAirline} via ${layovers.map((l) => l.airport).join('/')}`;

  // Atlas search does not surface baggage allowance or seats-left. We record
  // what we can verify: ancillary_supported includes 'baggage' → the offer
  // supports baggage selection; we default checked-baggage figures so the
  // constraint funnel treats live offers consistently with the fixture
  // (1×23kg checked bag assumed included, seatsLeft ample).
  return {
    id: `atlas-${String(index).padStart(2, '0')}`,
    fareKey: offerId,
    airlineCode: primaryAirline,
    airlineName: AIRLINE_NAMES[primaryAirline] ?? primaryAirline,
    label,
    legs,
    layovers,
    depIso,
    arrIso,
    totalDurationMin,
    stops: Math.max(0, legs.length - 1),
    minConnectionMin: layovers.length > 0 ? Math.min(...layovers.map((l) => l.minutes)) : null,
    fareDiffUsd: Math.max(0, Math.round((price - baselinePrice) * 100) / 100), // delta vs cheapest offer in result set
    baggagePieces: 1,
    baggageWeightKg: 23,
    seatsLeft: 99,
    otp: 0.8,
  };
}

/** Minutes since epoch from "202608270050" — sufficient for same-day deltas. */
function atlasTimeToMinutes(raw: string): number {
  if (raw.length !== 12) return 0;
  const h = Number(raw.slice(8, 10));
  const m = Number(raw.slice(10, 12));
  const day = Number(raw.slice(6, 8));
  return day * 1440 + h * 60 + m;
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

    // Filter out reference-only / unbookable offers up front — they cannot
    // progress through verifyFare or order create.
    const bookable = offers.filter((o) => o.bookable === true && o.price_status === 'current');

    // Atlas reports absolute prices; the engine's funnel expects FARE DELTAS
    // against a $150 ceiling (per the master spec and DemoProvider fixture).
    // Anchor the delta at the cheapest offer in this result set — that offer
    // becomes the baseline (Δ = $0) and every other offer's delta is its
    // premium above it. This preserves the funnel's budget semantics without
    // fabricating a baseline the CLI did not surface.
    const baseline = bookable.length > 0
      ? Math.min(...bookable.map((o) => Number(o.total_price ?? Infinity)))
      : 0;
    priceBaseline = baseline;

    return bookable.map((o, i) => mapOfferToCandidate(String(o.offer_id), o, searchId, i, baseline));
    });
  }

  async verifyFare(fareKey: string): Promise<FareVerification> {
    return this.retryOnce('verifyFare', async () => {
    const cached = offerCache.get(fareKey);
    if (!cached) {
      throw new Error(`Atlas offer ${fareKey} not in session cache — run searchFlights first or the offer expired.`);
    }

    // Step 1: offer verify — yields booking_id + traveler_id.
    const verified = await runCli(['offer', 'verify', '--offer-id', cached.offerId, '--json']);
    assertCode(verified, 'OFFER_VERIFIED', 'offer verify');
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

    // Step 2: booking confirm-price — final price lock before order create.
    const confirmed = await runCli(['booking', 'confirm-price', '--booking-id', cached.bookingId, '--json']);
    assertCode(confirmed, 'PRICE_CONFIRMED', 'booking confirm-price');
    const cData = confirmed.data as { current_price?: number; currency?: string };
    cached.price = Number(cData.current_price ?? cached.price);
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
    if (!cached || !cached.bookingId) {
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
    assertCode(orderEnv, 'PAYMENT_CONFIRMATION_REQUIRED', 'order create');
    const orderData = orderEnv.data as {
      order_no?: string;
      total_price?: number;
      payment_confirmation_id?: string;
    };
    const orderNo = String(orderData.order_no ?? '');
    const paymentConfirmationId = String(orderData.payment_confirmation_id ?? '');
    if (!orderNo || !paymentConfirmationId) {
      throw new Error(`Atlas order create missing order_no or payment_confirmation_id: ${JSON.stringify(orderData)}`);
    }

    const createMs = Date.now() - t0;
    onStep?.({
      name: 'create_order',
      detail: `Atlas order ${orderNo} created — $${orderData.total_price} ${cached.currency}`,
      durationMs: createMs,
    });

    // ---- 2. Order pay (NEVER retry — SKILL.md safety rule) ------------------
    const payStart = Date.now();
    const payEnv = await runCli(['order', 'pay', '--confirmation-id', paymentConfirmationId, '--json'], undefined, PAY_TIMEOUT_MS);
    // PAYMENT_BALANCE_CHECK_REQUIRED is a non-success code we surface clearly.
    if (payEnv.code === 'PAYMENT_BALANCE_CHECK_REQUIRED') {
      throw new Error(
        `Atlas payment failed: ATRIP account balance insufficient (code=PAYMENT_BALANCE_CHECK_REQUIRED). Order ${orderNo} created but not paid. Do NOT re-submit payment; check balance at ATRIP workspace.`,
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
    const payData = payEnv.data as {
      airline_pnrs?: string[];
      ticket_numbers?: string[];
    };
    const pnr = Array.isArray(payData.airline_pnrs) && payData.airline_pnrs.length > 0
      ? String(payData.airline_pnrs[0])
      : null;
    const ticketNo = Array.isArray(payData.ticket_numbers) && payData.ticket_numbers.length > 0
      ? String(payData.ticket_numbers[0])
      : null;
    const payMs = Date.now() - payStart;

    onStep?.({
      name: 'authorize_payment',
      detail: `Sandbox payment ${isPending ? 'submitted' : 'authorized'} — order ${orderNo}`,
      durationMs: payMs,
    });
    onStep?.({
      name: 'issue_ticket',
      detail: isPending
        ? `Ticketing pending — PNR will be issued asynchronously (order ${orderNo})`
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
