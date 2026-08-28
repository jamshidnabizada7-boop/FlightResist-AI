/**
 * FlightResist AI 2.0 — Provider Abstraction
 *
 * BaseTravelProvider mirrors the master spec interface:
 *   search_flights · verify_fare · create_and_pay_order · get_order_status
 *
 * Two implementations:
 *   AtlasSandboxProvider — shells out to the real `atlas-flight` CLI when the
 *     runtime probe finds it (auto-activates the moment credentials/CLI exist).
 *   DemoProvider — deterministic, clearly labeled, SIM- prefixed references.
 */

import type { FlightCandidate, ProviderMode } from '../types';

export interface FareVerification {
  fareKey: string;
  valid: boolean;
  fareDiffUsd: number;
  currency: string;
  fareBasis: string;
  ttlMin: number;
  verifiedAtIso: string;
  providerLatencyMs: number;
}

export interface OrderStepReport {
  name: 'create_order' | 'authorize_payment' | 'issue_ticket';
  detail: string;
  /** Measured duration of this provider sub-operation. */
  durationMs: number;
}

export interface OrderCreation {
  orderId: string;
  /** Real provider PNR — ONLY populated by a live provider. Never fabricated. */
  pnr: string | null;
  /** Demo-mode synthetic reference, e.g. SIM-REV-89211. Null in live mode. */
  demoReference: string | null;
  paymentRef: string;
  ticketRef: string | null;
  status: 'SIMULATED' | 'CONFIRMED';
  passengerName: string;
  fareKey: string;
}

export interface OrderStatus {
  orderId: string;
  status: 'TICKETED' | 'CONFIRMED' | 'PENDING' | 'FAILED';
  pnr: string | null;
  demoReference: string | null;
  checkedAtIso: string;
  providerLatencyMs: number;
}

export interface PassengerData {
  name: string;
  ticketReference: string;
  loyalty: string;
  checkedBags: number;
}

export abstract class BaseTravelProvider {
  abstract readonly mode: ProviderMode;

  abstract searchFlights(origin: string, destination: string, date: string): Promise<FlightCandidate[]>;

  abstract verifyFare(fareKey: string): Promise<FareVerification>;

  abstract createAndPayOrder(
    fareKey: string,
    passenger: PassengerData,
    onStep?: (step: OrderStepReport) => void,
  ): Promise<OrderCreation>;

  abstract getOrderStatus(orderId: string): Promise<OrderStatus>;
}

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly providerName: string,
    public readonly reason: string,
  ) {
    super(`${providerName} unavailable: ${reason}`);
    this.name = 'ProviderUnavailableError';
  }
}

/** Deterministic sleep used by providers to simulate measured API latency. */
export const providerSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
