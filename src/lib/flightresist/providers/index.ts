/**
 * FlightResist AI 2.0 — Provider Selection (auto / demo / atlas)
 *
 * ATLAS_MODE=auto (default): runtime probe → CLI absent → DemoProvider.
 * The app NEVER depends exclusively on unavailable external services.
 *
 * Circuit breaker + failover: every AtlasSandboxProvider call runs through a
 * circuit breaker (3 consecutive failures → OPEN). While the circuit is OPEN,
 * provider selection fails over to DemoProvider for a 30 s cooldown, after
 * which a half-open probe retries Atlas. Failover is logged, announced once
 * per OPEN episode as a PROVIDER_FALLBACK agent event (so the frontend can
 * display "using backup provider"), and clearly labeled in ProviderInfo.
 */

import { logger } from '@/lib/logger';
import { CircuitBreaker } from '../circuit-breaker';
import { emitEvent } from '../store';
import type { FlightCandidate, ProviderInfo, ProviderMode } from '../types';
import { AtlasSandboxProvider, probeAtlas } from './atlas-sandbox';
import { BaseTravelProvider } from './base';
import { DemoProvider } from './demo';
import type {
  FareVerification,
  OrderCreation,
  OrderStatus,
  OrderStepReport,
  PassengerData,
} from './base';

export type { BaseTravelProvider } from './base';

let demoInstance: DemoProvider | null = null;
let atlasInstance: AtlasSandboxProvider | null = null;
let guardedAtlasInstance: CircuitGuardedAtlasProvider | null = null;

export function getDemoProvider(): DemoProvider {
  if (!demoInstance) demoInstance = new DemoProvider();
  return demoInstance;
}

export function getAtlasProvider(): AtlasSandboxProvider {
  if (!atlasInstance) atlasInstance = new AtlasSandboxProvider();
  return atlasInstance;
}

// ---------------------------------------------------------------------------
// Circuit breaker — Atlas provider health tracking
// Survives HMR via globalThis (same pattern as the SSE bus and session store).
// ---------------------------------------------------------------------------

const globalForCircuit = globalThis as unknown as {
  __flightresistAtlasCircuit?: CircuitBreaker;
  /** True once the PROVIDER_FALLBACK event for the current OPEN episode is emitted. */
  __flightresistAtlasFallbackAnnounced?: boolean;
};

/** Circuit breaker guarding the Atlas provider (failureThreshold 3, cooldown 30 s). */
export function getAtlasCircuit(): CircuitBreaker {
  if (!globalForCircuit.__flightresistAtlasCircuit) {
    globalForCircuit.__flightresistAtlasCircuit = new CircuitBreaker('atlas-provider', {
      failureThreshold: 3,
      cooldownMs: 30_000,
      successThreshold: 1,
    });
  }
  return globalForCircuit.__flightresistAtlasCircuit;
}

/**
 * Circuit-breaker wrapper around AtlasSandboxProvider.
 *
 * Every provider operation runs through `circuit.execute()`: while OPEN the
 * call is rejected outright (no CLI spawn), a success closes a half-open
 * circuit, and failures accumulate toward opening it. Provider selection
 * (getActiveProvider) checks the breaker and fails over to DemoProvider
 * before these methods are even reached — this wrapper additionally covers
 * the race where the circuit opens between selection and invocation.
 */
class CircuitGuardedAtlasProvider extends BaseTravelProvider {
  readonly mode: ProviderMode = 'ATLAS_SANDBOX';

  constructor(
    private readonly inner: AtlasSandboxProvider,
    private readonly circuit: CircuitBreaker,
  ) {
    super();
  }

  async searchFlights(origin: string, destination: string, date: string): Promise<FlightCandidate[]> {
    return this.guarded('searchFlights', () => this.inner.searchFlights(origin, destination, date));
  }

  async verifyFare(fareKey: string): Promise<FareVerification> {
    return this.guarded('verifyFare', () => this.inner.verifyFare(fareKey));
  }

  async createAndPayOrder(
    fareKey: string,
    passenger: PassengerData,
    onStep?: (step: OrderStepReport) => void,
  ): Promise<OrderCreation> {
    return this.guarded('createAndPayOrder', () => this.inner.createAndPayOrder(fareKey, passenger, onStep));
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    return this.guarded('getOrderStatus', () => this.inner.getOrderStatus(orderId));
  }

  /** Run one Atlas operation through the breaker; log the moment it opens. */
  private async guarded<T>(op: string, fn: () => Promise<T>): Promise<T> {
    const before = this.circuit.currentState;
    try {
      return await this.circuit.execute(fn);
    } catch (err) {
      if (before !== 'OPEN' && this.circuit.currentState === 'OPEN') {
        logger.warn('Atlas circuit breaker OPENED — provider selection will fail over to demo provider', {
          provider: 'atlas-provider',
          operation: op,
          failure: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  }
}

/** The Atlas provider wrapped with the circuit breaker — what the pipeline uses. */
export function getGuardedAtlasProvider(): BaseTravelProvider {
  if (!guardedAtlasInstance) {
    guardedAtlasInstance = new CircuitGuardedAtlasProvider(getAtlasProvider(), getAtlasCircuit());
  }
  return guardedAtlasInstance;
}

export interface ActiveProvider {
  provider: BaseTravelProvider;
  info: ProviderInfo;
}

/**
 * Announce an Atlas → Demo failover: structured warning log plus ONE
 * PROVIDER_FALLBACK agent event per OPEN episode (deduplicated —
 * getActiveProvider() is polled by several routes, so without the guard the
 * SSE trace would fill with duplicate warnings). The event surfaces in the
 * agent stream so the frontend can display "using backup provider".
 */
function announceAtlasFailover(circuit: CircuitBreaker, probeDetail: string): void {
  if (globalForCircuit.__flightresistAtlasFallbackAnnounced) return;
  globalForCircuit.__flightresistAtlasFallbackAnnounced = true;
  logger.warn('Atlas circuit breaker OPEN — falling back to demo provider', {
    provider: 'atlas-provider',
    circuitState: circuit.currentState,
    probeDetail,
  });
  emitEvent(
    'SEARCH',
    'provider_fallback',
    'Atlas circuit breaker OPEN — using backup provider (DemoProvider)',
    `Atlas failed 3 consecutive times — circuit [atlas-provider] is OPEN. Provider traffic fails over to the deterministic DemoProvider for a 30 s cooldown, after which a half-open probe retries Atlas. Runtime probe: ${probeDetail}`,
    'warn',
    0,
    'TOOL_ORCHESTRATOR',
  );
}

export async function getActiveProvider(): Promise<ActiveProvider> {
  const mode = (process.env.ATLAS_MODE ?? 'auto').toLowerCase();
  const circuit = getAtlasCircuit();

  if (mode === 'demo') {
    return {
      provider: getDemoProvider(),
      info: {
        mode: 'DEMO',
        badge: '[ENV: DETERMINISTIC DEMO]',
        label: 'DemoProvider — pinned by ATLAS_MODE=demo',
        probeDetail: 'Provider pinned to the deterministic demo fixture (42 candidates).',
      },
    };
  }

  const probe = await probeAtlas();

  // Circuit breaker gate: a healthy CLI probe is not sufficient — if the
  // circuit is OPEN, Atlas just failed repeatedly, so fail over to Demo.
  // (Reading `isOpen` also performs the OPEN → HALF_OPEN transition once the
  // cooldown has elapsed, re-admitting Atlas as a probe.)
  if (probe.available && circuit.isOpen) {
    announceAtlasFailover(circuit, probe.detail);
    return {
      provider: getDemoProvider(),
      info: {
        mode: 'DEMO',
        badge: '[ENV: DETERMINISTIC DEMO]',
        label: 'DemoProvider — Atlas circuit breaker OPEN (failover active)',
        probeDetail: `Circuit [atlas-provider] OPEN after repeated Atlas failures — using the deterministic demo fixture as backup provider. Half-open probe retries Atlas after the 30 s cooldown. Probe: ${probe.detail}`,
      },
    };
  }

  if (probe.available) {
    // Atlas selected — re-arm the failover announcement for the next episode.
    globalForCircuit.__flightresistAtlasFallbackAnnounced = false;
    return {
      provider: getGuardedAtlasProvider(),
      info: {
        mode: 'ATLAS_SANDBOX',
        badge: '[ENV: ATLAS SANDBOX]',
        label: 'AtlasSandboxProvider — real atlas-flight CLI',
        probeDetail: probe.detail,
      },
    };
  }

  // CLI absent → honest fallback, clearly labeled.
  return {
    provider: getDemoProvider(),
    info: {
      mode: 'DEMO',
      badge: '[ENV: DETERMINISTIC DEMO]',
      label: mode === 'atlas'
        ? 'DemoProvider — atlas-flight CLI requested but not found'
        : 'DemoProvider — deterministic fixture, 42 candidates',
      probeDetail: probe.detail,
    },
  };
}
