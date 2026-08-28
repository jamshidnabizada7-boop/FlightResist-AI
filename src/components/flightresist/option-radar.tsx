'use client';

import { motion } from 'framer-motion';
import { Radar as RadarIcon, Target } from 'lucide-react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { ScoredOption } from '@/lib/flightresist/types';

interface Props {
  options: ScoredOption[];
}

function scoreLabel(score: number): { text: string; className: string } {
  if (score >= 80) return { text: 'Excellent', className: 'text-emerald-400' };
  if (score >= 60) return { text: 'Good', className: 'text-amber-400' };
  return { text: 'Fair', className: 'text-red-400' };
}

const SERIES = [
  { key: 'B', color: '#fbbf24', label: 'Option B' }, // amber — recommended
  { key: 'C', color: '#a1a1aa', label: 'Option C' }, // zinc — secondary
  { key: 'A', color: '#f87171', label: 'Option A' }, // red — rejected
] as const;

const DIMENSIONS: { field: keyof ScoredOption['scores']; label: string }[] = [
  { field: 'arrival', label: 'Arrival' },
  { field: 'connection', label: 'Connection' },
  { field: 'price', label: 'Price' },
  { field: 'baggage', label: 'Baggage' },
  { field: 'risk', label: 'Risk' },
];

export function OptionRadar({ options }: Props) {
  if (!options || options.length === 0) return null;

  const byLabel = new Map(options.map((o) => [o.label, o]));
  const data = DIMENSIONS.map((d) => {
    const row: Record<string, string | number> = { dimension: d.label };
    for (const s of SERIES) {
      const opt = byLabel.get(s.key);
      row[s.key] = Math.round(opt?.scores[d.field] ?? 0);
    }
    return row;
  });

  const recommended = options.find((o) => o.status === 'RECOMMENDED');

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <RadarIcon className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">06 ·</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Finalist Comparison</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-2 p-4 sm:p-5 lg:grid-cols-12">
        <div className="h-[240px] w-full lg:col-span-5">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="76%">
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'var(--font-geist-mono)' }}
              />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 8 }} stroke="#27272a" />
              {SERIES.map((s) => {
                const opt = byLabel.get(s.key);
                const isRec = opt?.status === 'RECOMMENDED';
                return (
                  <Radar
                    key={s.key}
                    name={s.label}
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={isRec ? 2 : 1.25}
                    fill={s.color}
                    fillOpacity={isRec ? 0.3 : 0.08}
                    strokeDasharray={opt?.status === 'ALTERNATIVE' ? '4 3' : undefined}
                    dot={false}
                    isAnimationActive
                    animationDuration={700}
                  />
                );
              })}
              <Tooltip
                cursor={false}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border bg-zinc-950/95 px-3 py-2 shadow-xl backdrop-blur-sm">
                      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {String(label)} score
                      </div>
                      {payload.map((p) => {
                        const s = SERIES.find((x) => x.key === p.dataKey);
                        const val = Number(p.value ?? 0);
                        return (
                          <div key={String(p.dataKey)} className="flex items-center gap-2 py-px">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s?.color }} />
                            <span className="font-mono text-[11px] text-zinc-300">{String(p.name)}</span>
                            <span className="ml-auto pl-3 font-mono text-[11px] font-bold tabular-nums text-zinc-100">
                              {val}/100
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2 lg:col-span-7">
          <p className="text-[11.5px] leading-relaxed text-zinc-400">
            Each option is scored 0–100 on five factors.{' '}
            <span className="font-semibold text-amber-300">Option B</span> offers the best balance of connection
            comfort and price while keeping arrival risk low;{' '}
            <span className="font-semibold text-zinc-300">Option C</span> arrives earliest but uses almost the whole
            rebooking budget; <span className="font-semibold text-red-400">Option A</span> is free but arrives too
            late for the meeting.
          </p>
          <div className="grid gap-1.5">
            {options.map((o) => {
              const s = SERIES.find((x) => x.key === o.label);
              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s?.color }} />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-zinc-200">
                    {o.candidate.label}
                  </span>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-px font-mono text-[10px] font-bold ${
                      o.status === 'RECOMMENDED'
                        ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                        : o.status === 'ALTERNATIVE'
                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                          : 'border-zinc-600/60 bg-zinc-700/20 text-zinc-300'
                    }`}
                  >
                    Score: {o.recoveryScore}/100
                    <span className={`ml-1 ${scoreLabel(o.recoveryScore).className}`}>
                      · {scoreLabel(o.recoveryScore).text}
                    </span>
                  </span>
                  <span className="w-full font-mono text-[10px] tabular-nums text-zinc-500">
                    arrival {Math.round(o.scores.arrival)} · connection {Math.round(o.scores.connection)} · price{' '}
                    {Math.round(o.scores.price)} · baggage {Math.round(o.scores.baggage)} · risk{' '}
                    {Math.round(o.scores.risk)}
                  </span>
                </motion.div>
              );
            })}
          </div>
          {recommended && (
            <div className="flex items-center gap-1.5 rounded border border-amber-500/25 bg-amber-500/[0.05] px-2.5 py-1.5">
              <Target className="h-3 w-3 shrink-0 text-amber-400" />
              <span className="text-[10px] text-zinc-500">
                Option {recommended.label} scores{' '}
                <span className="font-mono text-zinc-400">{recommended.recoveryScore}/100</span> — ahead of the
                next best option at{' '}
                <span className="font-mono text-zinc-400">{Math.round(options[1]?.recoveryScore ?? 0)}/100</span>
              </span>
            </div>
          )}
          {/* Status legend (color-blind aid): mapping is conveyed by text+shape, not color alone */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Series status legend">
            {SERIES.map((s) => {
              const opt = byLabel.get(s.key);
              return (
                <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <span
                    className={`h-2 w-2 rounded-full ${opt?.status === 'ALTERNATIVE' ? 'opacity-60' : ''}`}
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  <span className="font-mono font-bold uppercase">{s.key}</span>
                  <span>
                    {opt?.status === 'RECOMMENDED'
                      ? '— recommended (solid fill)'
                      : opt?.status === 'ALTERNATIVE'
                        ? '— alternative (dashed line)'
                        : '— secondary (thin outline)'}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
