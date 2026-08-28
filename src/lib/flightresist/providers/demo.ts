/**
 * FlightResist AI 2.0 — DemoProvider (DETERMINISTIC DEMO)
 *
 * Same interface as AtlasSandboxProvider. Deterministic fixture inventory
 * (exactly 42 candidates), fixed simulated provider latencies (real elapsed
 * time is measured and displayed), synthetic references prefixed `SIM-` —
 * never presented as real PNRs or payments.
 */

import { getFixtureCandidates } from '../fixture';
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
    const all = getFixtureCandidates();
    // The fixture is the SIN → NRT inventory for the demo travel date.
    if (origin !== 'SIN' || destination !== 'NRT') return [];
    return all;
  }

  async verifyFare(fareKey: string): Promise<FareVerification> {
    await providerSleep(DemoProvider.LATENCY.verifyFare);
    const candidate = getFixtureCandidates().find((c) => c.fareKey === fareKey);
    if (!candidate) {
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
