'use client';

import { useEffect, useState } from 'react';
import { animate, motion } from 'framer-motion';
import { Filter, Minus, Trophy } from 'lucide-react';
import type { ConstraintResult, ScoredOption } from '@/lib/flightresist/types';

interface Props {
  constraints: ConstraintResult | null;
  options: ScoredOption[] | null;
}

const REASON_LABELS: Record<string, string> = {
  misses_deadline: 'arrived too late',
  over_budget: 'over budget',
  unsafe_connection: 'too little time to change planes',
  baggage_incompatible: 'not enough baggage allowance',
};

export function DecisionFunnel({ constraints, options }: Props) {
  const total = constraints?.totalCandidates ?? 42;
  const recommended = options?.[0];

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">05 ·</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Decision Funnel</h2>
        </div>
        <span className="font-mono text-[11px] text-zinc-500">How we narrowed your options</span>
      </div>

      <div className="p-4 sm:p-5">
        {!constraints ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center">
            <Filter className="h-8 w-8 text-zinc-500" />
            <p className="max-w-[280px] text-xs leading-relaxed text-zinc-400">
              After a disruption, we search every available flight, remove the ones that don&apos;t fit
              your trip, and rank the rest to find your best options.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stage 0 — searched */}
            <FunnelBar
              label="Flights searched"
              rule="Searched flights SIN → NRT"
              count={total}
              max={total}
              tone="bg-gradient-to-r from-zinc-700 to-zinc-600"
              delay={0}
            />

            {constraints.funnel.map((stage, i) => (
              <div key={stage.reason}>
                <div className="mb-1.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">
                    <Minus className="h-2.5 w-2.5 text-red-400" />
                  </span>
                  <span className={stage.removed > 0 ? 'text-red-400' : 'text-zinc-500'}>
                    −{stage.removed} {REASON_LABELS[stage.reason] ?? stage.reason}
                  </span>
                  <span className="hidden text-zinc-400 sm:inline">· {stage.rule}</span>
                </div>
                <FunnelBar
                  label={`${stage.remaining} pass — ${stage.label}`}
                  rule={stage.rule}
                  count={stage.remaining}
                  max={total}
                  tone={
                    stage.remaining <= 3
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : stage.remaining <= 12
                        ? 'bg-gradient-to-r from-yellow-600 to-amber-600'
                        : 'bg-gradient-to-r from-zinc-600 to-zinc-500'
                  }
                  delay={(i + 1) * 0.12}
                />
              </div>
            ))}

            {/* Final ranking */}
            {recommended && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ delay: 0.55, duration: 0.45 }}
                className="mt-4 rounded-lg bg-gradient-to-r from-amber-500/60 via-amber-400/25 to-orange-500/60 p-px shadow-[0_0_28px_rgba(245,158,11,0.12)]"
              >
                <div className="flex items-center gap-3 rounded-[7px] bg-zinc-950/90 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 shadow-[0_0_18px_rgba(251,191,36,0.22)]">
                    <Trophy className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-zinc-100">
                      3 finalists ranked → Option {recommended.label} recommended (Score: {recommended.recoveryScore}/100)
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">
                      Final scores: {options?.map((o) => `Option ${o.label} — ${o.recoveryScore}/100`).join(' · ')}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-mono text-[10px] font-bold text-amber-300">
                    RECOMMENDED
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Purely presentational count-up (display animation only). */
function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.8,
      delay,
      ease: 'easeOut',
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, delay]);

  return <span className="tabular-nums">{n}</span>;
}

function FunnelBar({
  label,
  rule,
  count,
  max,
  tone,
  delay,
}: {
  label: string;
  rule: string;
  count: number;
  max: number;
  tone: string;
  delay: number;
}) {
  const scale = Math.max(0.06, count / max); // presentational fraction of the rail (transform-only fill)
  return (
    <div title={rule}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-[11.5px] font-medium text-zinc-300">{label}</span>
        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-zinc-100">
          <CountUp value={count} delay={delay + 0.1} />
        </span>
      </div>
      <div className="h-6 w-full overflow-hidden rounded-md bg-zinc-800/60">
        <motion.div
          className={`h-full w-full origin-left ${tone}`}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: scale }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ delay, duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
