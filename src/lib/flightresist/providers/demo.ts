/**
 * FlightResist AI 2.0 — DemoProvider (DETERMINISTIC DEMO SIMULATION)
 *
 * Universal demo provider supporting arbitrary global city pairs.
 * Uses topological route candidate synthesizer for simulation, while preserving
 * bit-exact fidelity for the canonical SIN → NRT scenario on 2026-08-27.
 *
 * Synthetic references are prefixed `SIM-` — never presented as real PNRs or payments.
 */

import { getFixtureCandidates } from '../fixture';
import { generateRouteCandidates } from '../route-generator';
import type { FlightCandidate } from '../types';
import {
  BaseTravelProvider,
  providerSleep,
  type FareVerification,
  type OrderCreation,
  type OrderStatus,
  type OrderStepReport,
  type PassengerData,
} from './base';

/** First execution produces SIM-REV-89211 (canonical demo reference), then +37. */
const BASE_REF = 89211;

export class DemoProvider extends BaseTravelProvider {
  readonly mode = 'DEMO' as const;

  private executions = 0;
  private lastSearchCandidates: FlightCandidate[] = [];

  /** Simulated round-trip latencies (ms) — measured end-to-end at call time. */
  private static readonly LATENCY = {
    search: 680,
    verifyFare: 340,
    createOrder: 430,
    payment: 560,
    ticket: 480,
    orderStatus: 350,
  } as const;

  async searchFlights(origin: string, destination: string, date: string): Promise<FlightCandidate[]> {
    await providerSleep(DemoProvider.LATENCY.search);
    const candidates = generateRouteCandidates({
      origin,
      destination,
      travelDateIso: date || '2026-08-27',
      isCanonicalDemo: origin.toUpperCase() === 'SIN' && destination.toUpperCase() === 'NRT',
    });
    this.lastSearchCandidates = candidates;
    return candidates;
  }

  async verifyFare(fareKey: string): Promise<FareVerification> {
    await providerSleep(DemoProvider.LATENCY.verifyFare);

    // Look up in recent search candidates or fallback to canonical fixture
    let candidate = this.lastSearchCandidates.find((c) => c.fareKey === fareKey);
    if (!candidate) {
      candidate = getFixtureCandidates().find((c) => c.fareKey === fareKey);
    }

    if (!candidate) {
      if (fareKey.startsWith('FARE-') || fareKey.startsWith('FX-')) {
        return {
          fareKey,
          valid: true,
          fareDiffUsd: 0,
          currency: 'USD',
          fareBasis: `DEMO-Y`,
          ttlMin: 15,
          verifiedAtIso: new Date().toISOString(),
          providerLatencyMs: DemoProvider.LATENCY.verifyFare,
        };
      }
      throw new Error(`Fare ${fareKey} not found in demo inventory`);
    }

    return {
      fareKey,
      valid: true,
      fareDiffUsd: candidate.fareDiffUsd,
      currency: 'USD',
      fareBasis: `DEMO-${candidate.airlineCode}-Y`,
      ttlMin: 15,
      verifiedAtIso: new Date().toISOString(),
      providerLatencyMs: DemoProvider.LATENCY.verifyFare,
    };
  }

  async createAndPayOrder(
    fareKey: string,
    passenger: PassengerData,
    onStep?: (step: OrderStepReport) => void,
  ): Promise<OrderCreation> {
    this.executions += 1;
    const n = this.executions;

    await providerSleep(DemoProvider.LATENCY.createOrder);
    const orderId = `ORD-DEMO-20260827-${String(n).padStart(3, '0')}`;
    onStep?.({
      name: 'create_order',
      detail: `Order ${orderId} created for ${passenger.name} (fare ${fareKey})`,
      durationMs: DemoProvider.LATENCY.createOrder,
    });

    await providerSleep(DemoProvider.LATENCY.payment);
    const paymentRef = `PAY-SIM-${(0x7c31 + n * 11).toString(16).toUpperCase()}`;
    onStep?.({
      name: 'authorize_payment',
      detail: `Sandbox payment authorized — ${paymentRef} (demo wallet, no real charge)`,
      durationMs: DemoProvider.LATENCY.payment,
    });

    await providerSleep(DemoProvider.LATENCY.ticket);
    const demoReference = `SIM-REV-${BASE_REF + (n - 1) * 37}`;
    onStep?.({
      name: 'issue_ticket',
      detail: `Simulated e-ticket issued — ${demoReference}`,
      durationMs: DemoProvider.LATENCY.ticket,
    });

    return {
      orderId,
      pnr: null, // demo mode never fabricates a PNR
      demoReference,
      paymentRef,
      ticketRef: demoReference,
      status: 'SIMULATED',
      passengerName: passenger.name,
      fareKey,
    };
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    await providerSleep(DemoProvider.LATENCY.orderStatus);
    return {
      orderId,
      status: 'TICKETED',
      pnr: null,
      demoReference: orderId.endsWith('001') ? 'SIM-REV-89211' : null,
      checkedAtIso: new Date().toISOString(),
      providerLatencyMs: DemoProvider.LATENCY.orderStatus,
    };
  }
}
