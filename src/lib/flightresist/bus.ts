/**
 * FlightResist AI 2.0 — SSE Event Bus
 * Single global EventEmitter (survives HMR via globalThis) that fans agent
 * events out to every open SSE connection.
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
    this.emitter.setMaxListeners(50);
  }

  publish<K extends BusChannel>(channel: K, payload: BusPayloads[K]): void {
    this.emitter.emit(channel, payload);
  }

  subscribe<K extends BusChannel>(channel: K, listener: (payload: BusPayloads[K]) => void): () => void {
    this.emitter.on(channel, listener as (...args: unknown[]) => void);
    return () => this.emitter.off(channel, listener as (...args: unknown[]) => void);
  }
}

const globalForBus = globalThis as unknown as { __flightresistBus?: TypedBus };

export function getBus(): TypedBus {
  if (!globalForBus.__flightresistBus) {
    globalForBus.__flightresistBus = new TypedBus();
  }
  return globalForBus.__flightresistBus;
}
