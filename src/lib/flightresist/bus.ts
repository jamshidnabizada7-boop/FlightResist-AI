/**
 * FlightResist AI 2.0 — SSE Event Bus (session-scoped)
 *
 * A single global EventEmitter (survives HMR via globalThis) fans agent events
 * out to every open SSE connection — with every channel namespaced by session
 * ID, so concurrent users only ever receive their own session's traffic.
 */

import { EventEmitter } from 'node:events';
import type { AgentEvent, TripState } from './types';

export interface BusPayloads {
  agent: AgentEvent;
  state: { from: TripState; to: TripState; atIso: string };
  reset: { atIso: string };
  snapshot: { state: TripState; riskScore: number };
}

export type BusChannel = keyof BusPayloads;

class TypedBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Each SSE connection subscribes to 4 channels; with many concurrent
    // sessions × connections the default cap of 10 listeners would trip
    // warnings. Connections unsubscribe on disconnect, so listener counts
    // are bounded by open-connection lifetime.
    this.emitter.setMaxListeners(0);
  }

  /** Composite channel key — the per-session namespace. */
  private key(sessionId: string, channel: BusChannel): string {
    return `fr:${sessionId}:${channel}`;
  }

  publish<K extends BusChannel>(sessionId: string, channel: K, payload: BusPayloads[K]): void {
    this.emitter.emit(this.key(sessionId, channel), payload);
  }

  subscribe<K extends BusChannel>(
    sessionId: string,
    channel: K,
    listener: (payload: BusPayloads[K]) => void,
  ): () => void {
    const key = this.key(sessionId, channel);
    this.emitter.on(key, listener as (...args: unknown[]) => void);
    return () => this.emitter.off(key, listener as (...args: unknown[]) => void);
  }
}

const globalForBus = globalThis as unknown as { __flightresistBus?: TypedBus };

export function getBus(): TypedBus {
  if (!globalForBus.__flightresistBus) {
    globalForBus.__flightresistBus = new TypedBus();
  }
  return globalForBus.__flightresistBus;
}
