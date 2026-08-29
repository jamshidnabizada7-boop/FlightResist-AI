/**
 * FlightResist AI 2.0 — Session Store (multi-session & dynamic itinerary)
 *
 * In-memory live truth on globalThis (survives HMR) — now a Map of concurrent
 * sessions keyed by cookie-based session ID — plus write-through Prisma
 * persistence (survives restarts) and an append-only agent event log.
 *
 * Session resolution order (resolveSessionId):
 *   1. explicit `sessionId` argument (API routes / pipeline entry points)
 *   2. ambient AsyncLocalStorage context (established per-request)
 *   3. DEFAULT_SESSION_ID — the shared legacy session used by cookie-less
 *      clients (curl, smoke tests, MCP JSON-RPC), preserving the exact
 *      pre-multi-user behavior
 *
 * Idle sessions expire after 30 minutes (background sweep every 60 s).
 */

import { db, dbAvailable } from '@/lib/db';
import { getBus } from './bus';
import { ITINERARY, TRIP_ID } from './itinerary';
import { ambientSessionId, DEFAULT_SESSION_ID } from './session-id';
import { SESSION_TTL_MS } from './session-constants';
import { assertTransition } from './state-machine';
import type {
  AgentEvent,
  AgentEventLevel,
  DisruptionEvent,
  ExecutionResult,
  Itinerary,
  PassengerProfile,
  MissionContext,
  TripConstraints,
  ProviderInfo,
  RecoveryAnalysis,
  TripState,
} from './types';
import type { TraceActor } from './agents';

export const ENGINE_VERSION = '2.0.0-deterministic-core';

type EventPhase = AgentEvent['phase'];

export interface LiveSession {
  state: TripState;
  itinerary: Itinerary;
  riskScore: number;
  disruption: DisruptionEvent | null;
  analysis: RecoveryAnalysis | null;
  execution: ExecutionResult | null;
  events: AgentEvent[];
  seq: number;
  analysisRunning: boolean;
  /** Phase 6: prevents double-click / duplicate approval from creating duplicate orders. */
  executionLock: boolean;
  executionCount: number;
  initialized: boolean;
  /** Multi-session: last touch timestamp — drives the 30-minute idle expiry sweep. */
  lastAccessed: number;
}

const globalForStore = globalThis as unknown as {
  __flightresistSessions?: Map<string, LiveSession>;
  __flightresistCleanupTimer?: unknown;
};

function cloneItinerary(itinerary: Itinerary): Itinerary {
  return JSON.parse(JSON.stringify(itinerary)) as Itinerary;
}

function freshSession(): LiveSession {
  return {
    state: 'NORMAL',
    itinerary: cloneItinerary(ITINERARY),
    riskScore: 0,
    disruption: null,
    analysis: null,
    execution: null,
    events: [],
    seq: 0,
    analysisRunning: false,
    executionLock: false,
    executionCount: 0,
    initialized: false,
    lastAccessed: Date.now(),
  };
}

function getSessionStore(): Map<string, LiveSession> {
  if (!globalForStore.__flightresistSessions) {
    globalForStore.__flightresistSessions = new Map();
  }
  return globalForStore.__flightresistSessions;
}

/**
 * Resolve the effective session ID, in order:
 *   explicit argument → ambient AsyncLocalStorage context → shared default.
 */
export function resolveSessionId(sessionId?: string): string {
  if (sessionId && sessionId.length > 0) return sessionId;
  const ambient = ambientSessionId();
  if (ambient && ambient.length > 0) return ambient;
  return DEFAULT_SESSION_ID;
}

export function getSession(sessionId?: string): LiveSession {
  const id = resolveSessionId(sessionId);
  const sessions = getSessionStore();
  let session = sessions.get(id);
  if (!session) {
    session = freshSession();
    sessions.set(id, session);
  }
  // Touch so the idle-expiry sweep never removes an active session.
  session.lastAccessed = Date.now();
  return session;
}

/** Hard-drop a live session — the next access starts completely fresh. */
export function resetSession(sessionId?: string): void {
  getSessionStore().delete(resolveSessionId(sessionId));
}

/** Number of live in-memory sessions (observability / smoke checks). */
export function liveSessionCount(): number {
  return getSessionStore().size;
}

/**
 * DB persistence key for a session. The default (cookie-less) session keeps
 * the legacy TRIP_ID key so existing rows, restart hydration, and the shared
 * demo ledger keep working; isolated browser sessions get a scoped key.
 */
export function persistenceKey(sessionId?: string): string {
  const id = resolveSessionId(sessionId);
  return id === DEFAULT_SESSION_ID ? TRIP_ID : `${TRIP_ID}::${id}`;
}

// ---------------------------------------------------------------------------
// Idle-session expiry (30 min TTL, sweep every 60 s)
// ---------------------------------------------------------------------------

function cleanupSessions(): void {
  const store = getSessionStore();
  const now = Date.now();
  for (const [id, session] of store) {
    if (now - session.lastAccessed > SESSION_TTL_MS) {
      // Best effort: tell still-connected SSE clients to clear and re-sync —
      // the session (and its seq counter) restarts on the next access.
      try {
        getBus().publish(id, 'reset', { atIso: new Date().toISOString() });
      } catch {
        /* bus failures must never break the sweep */
      }
      store.delete(id);
    }
  }
}

if (!globalForStore.__flightresistCleanupTimer) {
  const timer = setInterval(cleanupSessions, 60_000) as unknown as { unref?: () => void };
  // Never hold the event loop open just for the expiry sweep.
  timer.unref?.();
  globalForStore.__flightresistCleanupTimer = timer;
}

// ---------------------------------------------------------------------------
// Dynamic Itinerary & Profile Mutators
// ---------------------------------------------------------------------------

export async function setSessionItinerary(
  itinerary: Itinerary,
  providerMode?: string,
  sessionId?: string
): Promise<void> {
  const id = resolveSessionId(sessionId);
  const s = getSession(id);
  s.itinerary = cloneItinerary(itinerary);
  s.state = 'NORMAL';
  s.riskScore = 0;
  s.disruption = null;
  s.analysis = null;
  s.execution = null;
  s.events = [];
  s.seq = 0;
  s.analysisRunning = false;
  s.executionLock = false;

  getBus().publish(id, 'reset', { atIso: new Date().toISOString() });
  getBus().publish(id, 'state', { from: s.state, to: 'NORMAL', atIso: new Date().toISOString() });
  getBus().publish(id, 'snapshot', { state: 'NORMAL', riskScore: 0 });

  if (dbAvailable()) {
    try {
      await db.agentEvent.deleteMany({ where: { sessionId: persistenceKey(id) } });
    } catch {
      /* best-effort */
    }
  }
  await persistSnapshot(providerMode || 'DEMO', id);
}

export function updateSessionConstraints(
  constraints: Partial<TripConstraints>,
  providerMode?: string,
  sessionId?: string
): Itinerary {
  const id = resolveSessionId(sessionId);
  const s = getSession(id);
  s.itinerary.constraints = {
    ...s.itinerary.constraints,
    ...constraints,
  };
  void persistSnapshot(providerMode || 'DEMO', id);
  getBus().publish(id, 'snapshot', { state: s.state, riskScore: s.riskScore });
  return s.itinerary;
}

export function updateSessionPassenger(
  passenger: Partial<PassengerProfile>,
  providerMode?: string,
  sessionId?: string
): Itinerary {
  const id = resolveSessionId(sessionId);
  const s = getSession(id);
  s.itinerary.passenger = {
    ...s.itinerary.passenger,
    ...passenger,
  };
  void persistSnapshot(providerMode || 'DEMO', id);
  getBus().publish(id, 'snapshot', { state: s.state, riskScore: s.riskScore });
  return s.itinerary;
}

export function updateSessionMission(
  mission: Partial<MissionContext>,
  providerMode?: string,
  sessionId?: string
): Itinerary {
  const id = resolveSessionId(sessionId);
  const s = getSession(id);
  s.itinerary.mission = {
    ...s.itinerary.mission,
    ...mission,
  };
  if (mission.title) {
    s.itinerary.tripPurpose = mission.title;
  }
  void persistSnapshot(providerMode || 'DEMO', id);
  getBus().publish(id, 'snapshot', { state: s.state, riskScore: s.riskScore });
  return s.itinerary;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function persistSnapshot(providerMode: string, sessionId?: string): Promise<void> {
  if (!dbAvailable()) return; // Skip DB writes on Vercel/serverless
  const id = resolveSessionId(sessionId);
  const s = getSession(id);
  const key = persistenceKey(id);
  try {
    await db.tripSession.upsert({
      where: { id: key },
      create: {
        id: key,
        state: s.state,
        providerMode,
        riskScore: s.riskScore,
        itinerary: JSON.stringify(s.itinerary),
        disruption: s.disruption ? JSON.stringify(s.disruption) : null,
        analysis: s.analysis ? JSON.stringify(s.analysis) : null,
        execution: s.execution ? JSON.stringify(s.execution) : null,
        selectedOption: s.execution?.proposalId ?? null,
        disruptionSeq: s.executionCount,
      },
      update: {
        state: s.state,
        providerMode,
        riskScore: s.riskScore,
        itinerary: JSON.stringify(s.itinerary),
        disruption: s.disruption ? JSON.stringify(s.disruption) : null,
        analysis: s.analysis ? JSON.stringify(s.analysis) : null,
        execution: s.execution ? JSON.stringify(s.execution) : null,
        selectedOption: s.execution?.proposalId ?? null,
        disruptionSeq: s.executionCount,
      },
    });
  } catch (err) {
    console.error('[flightresist] persistSnapshot failed:', err instanceof Error ? err.message : err);
  }
}

/** Restore a persisted session after a cold start (best effort). */
export async function hydrateFromDb(providerMode: string, sessionId?: string): Promise<void> {
  if (!dbAvailable()) {
    // On Vercel/serverless, skip hydration entirely — use in-memory state only
    const id = resolveSessionId(sessionId);
    const s = getSession(id);
    s.initialized = true;
    return;
  }
  const id = resolveSessionId(sessionId);
  const key = persistenceKey(id);
  const s = getSession(id);
  if (s.initialized) return;
  s.initialized = true;

  // Hydration is strictly a cold-start restore for PRISTINE sessions. If the
  // in-memory session already carries live activity (in-flight pipeline,
  // recorded events, non-NORMAL state), in-memory truth wins: the DB
  // write-through lags memory, so restoring now could resurrect a stale
  // "stuck" state and clobber a live run — e.g. a disruption triggered as a
  // session's very first request, followed by a GET while the pipeline runs.
  const pristine =
    s.state === 'NORMAL' &&
    s.disruption === null &&
    s.analysis === null &&
    s.execution === null &&
    s.seq === 0 &&
    !s.analysisRunning &&
    !s.executionLock;
  if (!pristine) return;
  try {
    const row = await db.tripSession.findUnique({ where: { id: key } });
    if (row) {
      if (row.itinerary) {
        try {
          s.itinerary = JSON.parse(row.itinerary) as Itinerary;
        } catch {
          s.itinerary = cloneItinerary(ITINERARY);
        }
      }

      if (row.state !== 'NORMAL') {
        const analysis = row.analysis ? (JSON.parse(row.analysis) as RecoveryAnalysis) : null;
        const execution = row.execution ? (JSON.parse(row.execution) as ExecutionResult) : null;
        let state = row.state as TripState;
        // Recover stuck transient states after a cold restart:
        //  - analysis never completed → back to NORMAL (disruption can be retriggered)
        //  - execution interrupted mid-flight → re-arm the approval gate
        if ((state === 'DISRUPTION_DETECTED' || state === 'ANALYZING') && !analysis) {
          state = 'NORMAL';
        } else if (state === 'EXECUTING' && analysis) {
          state = 'AWAITING_APPROVAL';
        } else if (state === 'EXECUTING') {
          state = 'NORMAL';
        }
        s.state = state;
        s.riskScore = state === 'NORMAL' ? 0 : row.riskScore;
        s.disruption = state === 'NORMAL' ? null : row.disruption ? (JSON.parse(row.disruption) as DisruptionEvent) : null;
        s.analysis = analysis;
        s.execution = execution;
        s.executionCount = row.disruptionSeq;
        const events = await db.agentEvent.findMany({
          where: { sessionId: key },
          orderBy: { seq: 'asc' },
        });
        s.events = events.map((e) => ({
          seq: e.seq,
          phase: e.phase as EventPhase,
          step: e.step,
          title: e.title,
          details: e.details,
          level: e.level as AgentEventLevel,
          agent: (e.agent as TraceActor | null) ?? undefined,
          timestamp: e.createdAt.toISOString(),
          durationMs: e.durationMs,
        }));
        s.seq = events.length;
      }
    }
    // Phase 7: await persist — eliminates race with forceReset on cold start.
    await persistSnapshot(providerMode, id);
  } catch (err) {
    console.error('[flightresist] hydrateFromDb failed:', err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export function emitEvent(
  phase: EventPhase,
  step: string,
  title: string,
  details: string,
  level: AgentEventLevel = 'info',
  durationMs = 0,
  agent?: TraceActor,
  sessionId?: string,
): AgentEvent {
  const id = resolveSessionId(sessionId);
  const s = getSession(id);
  s.seq += 1;
  const event: AgentEvent = {
    seq: s.seq,
    phase,
    step,
    title,
    details,
    level,
    agent,
    timestamp: new Date().toISOString(),
    durationMs,
  };
  s.events.push(event);
  getBus().publish(id, 'agent', event);

  if (dbAvailable()) {
    void db.agentEvent
      .create({
        data: {
          sessionId: persistenceKey(id),
          seq: event.seq,
          phase,
          step,
          title,
          details,
          level,
          agent: agent ?? null,
          durationMs,
        },
      })
      .catch((err: unknown) => console.error('[flightresist] event persist failed:', err));
  }

  return event;
}

export function setState(to: TripState, providerMode: string, sessionId?: string): void {
  const id = resolveSessionId(sessionId);
  const s = getSession(id);
  const from = s.state;
  if (from === to) return;
  assertTransition(from, to);
  s.state = to;
  getBus().publish(id, 'state', { from, to, atIso: new Date().toISOString() });
  getBus().publish(id, 'snapshot', { state: to, riskScore: s.riskScore });
  void persistSnapshot(providerMode, id);
}

/** Operator-level override (session reset) — bypasses transition table on purpose.
 *  Phase 7: now async — awaits DB operations so the caller can be certain
 *  the reset is durable before issuing the next request. */
export async function forceReset(providerMode?: string, sessionId?: string): Promise<void> {
  const id = resolveSessionId(sessionId);
  const s = getSession(id);
  s.state = 'NORMAL';
  s.riskScore = 0;
  s.disruption = null;
  s.analysis = null;
  s.execution = null;
  s.events = [];
  s.seq = 0;
  s.analysisRunning = false;
  s.executionLock = false;
  getBus().publish(id, 'reset', { atIso: new Date().toISOString() });
  getBus().publish(id, 'snapshot', { state: 'NORMAL', riskScore: 0 });
  // Phase 7: sequential awaited DB ops — eliminates the cold-start race where
  // hydrateFromDb's fire-and-forget persist could overwrite the reset state.
  if (dbAvailable()) {
    try {
      await db.agentEvent.deleteMany({ where: { sessionId: persistenceKey(id) } });
    } catch { /* best-effort */ }
  }
  await persistSnapshot(providerMode || 'DEMO', id);
}

export async function getLedger(sessionId?: string): Promise<{ id: string; proposalId: string; status: string; reference: string | null; executionTimeMs: number; createdAtIso: string }[]> {
  if (!dbAvailable()) {
    // On Vercel/serverless, return empty ledger — demo mode doesn't persist orders
    return [];
  }
  const key = persistenceKey(sessionId);
  try {
    const rows = await db.executionOrder.findMany({
      where: { sessionId: key },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    return rows.map((r) => ({
      id: r.id,
      proposalId: r.proposalId,
      status: r.status,
      reference: r.reference,
      executionTimeMs: r.executionTimeMs,
      createdAtIso: r.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error('[flightresist] getLedger failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export function buildSnapshot(providerInfo: ProviderInfo, sessionId?: string) {
  const s = getSession(sessionId);
  return {
    tripId: s.itinerary.tripId || TRIP_ID,
    state: s.state,
    itinerary: s.itinerary,
    riskScore: s.riskScore,
    disruption: s.disruption,
    analysis: s.analysis,
    execution: s.execution,
    provider: providerInfo,
    events: s.events,
    engineVersion: ENGINE_VERSION,
  };
}
