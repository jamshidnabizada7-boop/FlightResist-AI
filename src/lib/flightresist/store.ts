/**
 * FlightResist AI 2.0 — Session Store
 * In-memory live truth on globalThis (survives HMR) + write-through Prisma
 * persistence (survives restarts) + append-only agent event log.
 */

import { db } from '@/lib/db';
import { getBus } from './bus';
import { ITINERARY, TRIP_ID } from './itinerary';
import { assertTransition } from './state-machine';
import type {
  AgentEvent,
  AgentEventLevel,
  DisruptionEvent,
  ExecutionResult,
  ProviderInfo,
  RecoveryAnalysis,
  TripState,
} from './types';
import type { TraceActor } from './agents';

export const ENGINE_VERSION = '2.0.0-deterministic-core';

type EventPhase = AgentEvent['phase'];

interface LiveSession {
  state: TripState;
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
}

const globalForStore = globalThis as unknown as {
  __flightresistSession?: LiveSession;
};

function freshSession(): LiveSession {
  return {
    state: 'NORMAL',
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
  };
}

export function getSession(): LiveSession {
  if (!globalForStore.__flightresistSession) {
    globalForStore.__flightresistSession = freshSession();
  }
  return globalForStore.__flightresistSession;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function persistSnapshot(providerMode: string): Promise<void> {
  const s = getSession();
  try {
    await db.tripSession.upsert({
      where: { id: TRIP_ID },
      create: {
        id: TRIP_ID,
        state: s.state,
        providerMode,
        riskScore: s.riskScore,
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
export async function hydrateFromDb(providerMode: string): Promise<void> {
  const s = getSession();
  if (s.initialized) return;
  s.initialized = true;
  try {
    const row = await db.tripSession.findUnique({ where: { id: TRIP_ID } });
    if (row && row.state !== 'NORMAL') {
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
        where: { sessionId: TRIP_ID },
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
  } catch (err) {
    console.error('[flightresist] hydrateFromDb failed:', err instanceof Error ? err.message : err);
  }
  // Phase 7: await persist — eliminates race with forceReset on cold start.
  await persistSnapshot(providerMode);
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
): AgentEvent {
  const s = getSession();
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
  getBus().publish('agent', event);

  void db.agentEvent
    .create({
      data: {
        sessionId: TRIP_ID,
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

  return event;
}

export function setState(to: TripState, providerMode: string): void {
  const s = getSession();
  const from = s.state;
  if (from === to) return;
  assertTransition(from, to);
  s.state = to;
  getBus().publish('state', { from, to, atIso: new Date().toISOString() });
  getBus().publish('snapshot', { state: to, riskScore: s.riskScore });
  void persistSnapshot(providerMode);
}

/** Operator-level override (session reset) — bypasses transition table on purpose.
 *  Phase 7: now async — awaits DB operations so the caller can be certain
 *  the reset is durable before issuing the next request. */
export async function forceReset(providerMode: string): Promise<void> {
  const s = getSession();
  s.state = 'NORMAL';
  s.riskScore = 0;
  s.disruption = null;
  s.analysis = null;
  s.execution = null;
  s.events = [];
  s.seq = 0;
  s.analysisRunning = false;
  s.executionLock = false;
  getBus().publish('reset', { atIso: new Date().toISOString() });
  getBus().publish('snapshot', { state: 'NORMAL', riskScore: 0 });
  // Phase 7: sequential awaited DB ops — eliminates the cold-start race where
  // hydrateFromDb's fire-and-forget persist could overwrite the reset state.
  try {
    await db.agentEvent.deleteMany({ where: { sessionId: TRIP_ID } });
  } catch { /* best-effort */ }
  await persistSnapshot(providerMode);
}

export async function getLedger(): Promise<{ id: string; proposalId: string; status: string; reference: string | null; executionTimeMs: number; createdAtIso: string }[]> {
  const rows = await db.executionOrder.findMany({
    where: { sessionId: TRIP_ID },
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
}

export function buildSnapshot(providerInfo: ProviderInfo) {
  const s = getSession();
  return {
    tripId: TRIP_ID,
    state: s.state,
    itinerary: ITINERARY,
    riskScore: s.riskScore,
    disruption: s.disruption,
    analysis: s.analysis,
    execution: s.execution,
    provider: providerInfo,
    events: s.events,
    engineVersion: ENGINE_VERSION,
  };
}
