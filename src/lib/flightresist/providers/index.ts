/**
 * FlightResist AI 2.0 — Provider Selection (auto / demo / atlas / user)
 *
 * Three selection layers (first match wins):
 *   1. User preference (Task 32): the signed-in user's explicit choice,
 *      threaded in by the disruption trigger / execution confirm routes.
 *        DEMO → always the deterministic DemoProvider (even if the CLI exists).
 *        LIVE → Atlas when the CLI probe + circuit breaker are healthy;
 *               otherwise a loud error — never demo data under a LIVE badge.
 *   2. ATLAS_MODE=demo → DemoProvider pinned by environment.
 *   3. ATLAS_MODE=auto (default): runtime probe → CLI absent → DemoProvider.
 *      The app NEVER depends exclusively on unavailable external services.
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

/**
 * Select the travel provider.
 *
 * @param userMode optional signed-in user's preference ("DEMO" | "LIVE",
 *        persisted via PATCH /api/user/mode). Undefined (anonymous caller, or
 *        a route that is not user-scoped) falls back to the env-based logic
 *        below, preserving the pre-existing behavior exactly.
 */
export async function getActiveProvider(userMode?: string): Promise<ActiveProvider> {
  const circuit = getAtlasCircuit();

  // ---- Layer 1: explicit user preference (Task 32) ------------------------

  if (userMode === 'DEMO') {
    // User explicitly chose demo — deterministic fixture, even when the CLI
    // exists and ATLAS_MODE would otherwise select Atlas.
    return {
      provider: getDemoProvider(),
      info: {
        mode: 'DEMO',
        badge: '[USER: DETERMINISTIC DEMO]',
        label: 'DemoProvider — pinned by user preference',
        probeDetail: 'User selected Demo mode — deterministic fixture inventory, no live airline calls.',
      },
    };
  }

  if (userMode === 'LIVE') {
    // User explicitly chose live — real inventory or an honest failure.
    // Never silently fail over to demo data while the UI shows LIVE.
    const probe = await probeAtlas();
    if (!probe.available) {
      throw new Error(
        'Live mode unavailable on this deployment — the atlas-flight CLI is not installed. Only Demo mode is supported here; use the self-hosted version for real flights.',
      );
    }
    // Reading `isOpen` also performs the OPEN → HALF_OPEN transition once the
    // cooldown has elapsed, re-admitting Atlas as a probe.
    if (circuit.isOpen) {
      throw new Error(
        'Live mode temporarily unavailable — the Atlas circuit breaker is OPEN after repeated failures. Retry in ~30 s or switch back to Demo mode.',
      );
    }
    // Atlas selected — re-arm the failover announcement for the next episode.
    globalForCircuit.__flightresistAtlasFallbackAnnounced = false;
    return {
      provider: getGuardedAtlasProvider(),
      info: {
        mode: 'ATLAS_SANDBOX',
        badge: '[USER: ATLAS SANDBOX]',
        label: 'AtlasSandboxProvider — live mode selected by user',
        probeDetail: probe.detail,
      },
    };
  }

  // ---- Layers 2–3: environment-based selection -----------------------------

  const mode = (process.env.ATLAS_MODE ?? 'auto').toLowerCase();

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

/**
 * Cheap Atlas CLI availability probe for GET /api/atlas/status — the frontend
 * uses it to warn before a user switches to Live mode. Runs the same cached
 * runtime probe (60 s TTL) as provider selection, without the full provider /
 * circuit-breaker setup, so it is safe to call frequently.
 */
export async function checkAtlasAvailability(): Promise<boolean> {
  const probe = await probeAtlas();
  return probe.available;
}
