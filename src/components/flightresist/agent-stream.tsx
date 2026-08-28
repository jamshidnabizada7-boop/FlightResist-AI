'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Info,
  Sparkles,
  Terminal,
  TriangleAlert,
  X,
} from 'lucide-react';
import { fmtClock, fmtDuration, levelTone } from '@/lib/flightresist/format';
import type { AgentEvent, AgentEventLevel, TripState } from '@/lib/flightresist/types';
import type { TraceActor } from '@/lib/flightresist/agents';

const LEVEL_ICONS: Record<AgentEventLevel, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warn: TriangleAlert,
  critical: AlertTriangle,
  agent: Sparkles,
};

const PHASE_COLORS: Record<string, string> = {
  SENTINEL: 'text-emerald-400/80 border-emerald-500/30',
  DISRUPTION: 'text-red-400/80 border-red-500/30',
  ANALYSIS: 'text-orange-400/80 border-orange-500/30',
  SEARCH: 'text-amber-300/80 border-amber-500/30',
  CONSTRAINTS: 'text-yellow-300/80 border-yellow-500/30',
  OPTIMIZATION: 'text-lime-300/80 border-lime-500/30',
  REASONING: 'text-fuchsia-300/80 border-fuchsia-500/30',
  APPROVAL: 'text-teal-300/80 border-teal-500/30',
  EXECUTION: 'text-orange-300/80 border-orange-500/30',
  RECOVERY: 'text-emerald-300/80 border-emerald-500/30',
};

/** Phase 4: color coding for agent responsibility badges. */
const AGENT_COLORS: Record<TraceActor, string> = {
  SUPERVISOR: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  IMPACT_REASONER: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  TRADE_OFF_EXPLAINER: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  TOOL_ORCHESTRATOR: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  DETERMINISTIC_ENGINE: 'bg-zinc-500/15 text-zinc-400 border-zinc-600/30',
  OPTIMIZER: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

/** Short human-readable labels for agent badges. */
const AGENT_SHORT: Record<TraceActor, string> = {
  SUPERVISOR: 'Coordinator',
  IMPACT_REASONER: 'Impact Analyzer',
  TRADE_OFF_EXPLAINER: 'Explainer',
  TOOL_ORCHESTRATOR: 'Search Engine',
  DETERMINISTIC_ENGINE: 'Engine',
  OPTIMIZER: 'Option Ranker',
};

/** Friendly display names for trace phases (raw phase values are unchanged). */
const PHASE_LABELS: Record<string, string> = {
  SENTINEL: 'Monitoring',
  DISRUPTION: 'Disruption Found',
  ANALYSIS: 'Analyzing Impact',
  SEARCH: 'Searching Flights',
  CONSTRAINTS: 'Checking Safety',
  OPTIMIZATION: 'Ranking Options',
  REASONING: 'Explaining Choices',
  APPROVAL: 'Your Approval',
  EXECUTION: 'Booking',
  RECOVERY: 'Recovered',
};

interface Props {
  events: AgentEvent[];
  state: TripState;
  live: boolean;
}

export function AgentStream({ events, state, live }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null);

  // Phases actually present in the trace (filter chips rendered from data).
  const phases = useMemo(() => {
    const seen: string[] = [];
    for (const e of events) if (!seen.includes(e.phase)) seen.push(e.phase);
    return seen;
  }, [events]);

  const visible = useMemo(
    () => (phaseFilter === null ? events : events.filter((e) => e.phase === phaseFilter)),
    [events, phaseFilter],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const running = state === 'ANALYZING' || state === 'EXECUTING' || state === 'DISRUPTION_DETECTED';

  return (
    <section aria-labelledby="agent-stream-heading" className="flex flex-col overflow-hidden rounded-xl border border-border bg-zinc-950/90 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-900/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">04 ·</span>
          <h2 id="agent-stream-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-300">Agent Reasoning Trace</h2>
          <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-px font-mono text-[10px] text-zinc-400">
            {live ? 'Live' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {running && (
            <motion.span
              className="flex items-center gap-1 text-amber-300"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <Activity className="h-3 w-3" /> RUNNING
            </motion.span>
          )}
          <span className={`tabular-nums ${live ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {phaseFilter ? `${visible.length}/${events.length}` : `${events.length}`} events
          </span>
        </div>
      </div>

      {/* Phase filter chips (judge Q&A aid) */}
      {phases.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800/50 bg-zinc-900/40 px-3 py-1.5">
          <Filter className="mr-0.5 h-3 w-3 text-zinc-400" />
          <button
            type="button"
            onClick={() => setPhaseFilter(null)}
            aria-pressed={phaseFilter === null}
            className={`rounded border px-1.5 py-px font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              phaseFilter === null
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                : 'border-zinc-700/70 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            all
          </button>
          {phases.map((p) => {
            const active = phaseFilter === p;
            const count = events.filter((e) => e.phase === p).length;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPhaseFilter(active ? null : p)}
                aria-pressed={active}
                className={`rounded border px-1.5 py-px font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                    : 'border-zinc-700/70 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {(PHASE_LABELS[p] ?? p).toLowerCase()} <span className="text-zinc-400">{count}</span>
              </button>
            );
          })}
          {phaseFilter && (
            <button
              type="button"
              onClick={() => setPhaseFilter(null)}
              aria-label="Clear phase filter"
              className="ml-auto flex h-4 w-4 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className="fr-scroll min-h-[220px] max-h-[420px] flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
        role="log"
        aria-live="polite"
        aria-label="Agent reasoning event stream"
      >
        {events.length === 0 && !running && (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-zinc-400">
            <Terminal className="h-8 w-8 text-zinc-800" />
            <p className="text-[11px]">Waiting for a disruption…</p>
            <p className="text-[10px] text-zinc-500">Watching your trip SIN → NRT · nothing to report yet</p>
          </div>
        )}

        {events.length > 0 && visible.length === 0 && (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 text-center text-zinc-400">
            <Filter className="h-5 w-5 text-zinc-500" />
            <p className="text-[10.5px]">No events in “{phaseFilter ? PHASE_LABELS[phaseFilter] ?? phaseFilter : ''}”</p>
          </div>
        )}

        {visible.map((e) => {
          const Icon = LEVEL_ICONS[e.level] ?? Info;
          const tone = levelTone(e.level);
          return (
            <motion.div
              key={e.seq}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`group mb-1 flex gap-2.5 rounded-md px-1.5 py-1 ${
                e.seq % 2 === 0 ? 'bg-zinc-900/40' : ''
              }`}
            >
              <span className="w-7 shrink-0 pt-0.5 text-right text-zinc-400 tabular-nums">
                {String(e.seq).padStart(2, '0')}
              </span>
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone.icon}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    className={`rounded border px-1 py-px text-[10.5px] font-bold uppercase tracking-wider ${PHASE_COLORS[e.phase] ?? 'border-zinc-700 text-zinc-400'}`}
                  >
                    {PHASE_LABELS[e.phase] ?? e.phase}
                  </span>
                  {e.agent && (
                    <span
                      className={`rounded border px-1 py-px text-[10.5px] font-bold tracking-wider ${AGENT_COLORS[e.agent] ?? 'border-zinc-700 text-zinc-500'}`}
                      title={e.agent}
                    >
                      {AGENT_SHORT[e.agent] ?? e.agent}
                    </span>
                  )}
                  <span className={`text-[11.5px] font-semibold ${tone.text}`}>{e.title}</span>
                </div>
                <p className="mt-0.5 break-words text-[10.5px] leading-snug text-zinc-500">{e.details}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
                {e.durationMs > 0 && (
                  <span
                    className={`inline-block min-w-[44px] rounded px-1 py-px text-center text-[11px] tabular-nums ${
                      e.durationMs >= 1000 ? 'bg-amber-500/10 text-amber-300' : 'bg-zinc-800/80 text-zinc-400'
                    }`}
                  >
                    {fmtDuration(e.durationMs)}
                  </span>
                )}
                <span className="text-[11px] text-zinc-500 tabular-nums">{fmtClock(e.timestamp)}</span>
              </div>
            </motion.div>
          );
        })}

        {running && (
          <div className="flex items-center gap-2 pl-1 pt-1 text-amber-300/80">
            <span className="fr-cursor inline-block h-3 w-2 bg-amber-400/90" />
            <span className="text-[10.5px]">agent working…</span>
          </div>
        )}
      </div>
    </section>
  );
}
