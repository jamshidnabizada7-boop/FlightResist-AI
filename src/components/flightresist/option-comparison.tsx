'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, MinusCircle, Sparkles, XCircle } from 'lucide-react';
import type { ScoredOption } from '@/lib/flightresist/types';

interface Props {
  options: ScoredOption[];
}

const STATUS_ICON = {
  RECOMMENDED: { Icon: Sparkles, tone: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30' },
  SECONDARY: { Icon: AlertTriangle, tone: 'text-zinc-400', bg: 'bg-zinc-700/10 border-zinc-600/30' },
  ALTERNATIVE: { Icon: MinusCircle, tone: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
} as const;

function scoreLabel(score: number): { text: string; className: string } {
  if (score >= 80) return { text: 'Excellent', className: 'text-emerald-400' };
  if (score >= 60) return { text: 'Good', className: 'text-amber-400' };
  return { text: 'Fair', className: 'text-red-400' };
}

function WhyBlock({ option, index }: { option: ScoredOption; index: number }) {
  const why = option.why;
  if (!why) return null;

  const { Icon, tone, bg } = STATUS_ICON[option.status];
  const isRec = option.status === 'RECOMMENDED';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ delay: index * 0.12, duration: 0.4 }}
      className={`rounded-xl border p-4 ${isRec ? 'border-amber-400/40 bg-amber-500/[0.06] shadow-[0_0_24px_rgba(251,191,36,0.08)]' : bg}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <span className={`font-mono text-sm font-extrabold ${tone}`}>
          Option {option.label}
        </span>
        <span
          className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
            isRec
              ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
              : option.status === 'ALTERNATIVE'
                ? 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                : 'border-zinc-600/60 bg-zinc-700/20 text-zinc-300'
          }`}
        >
          {option.status} — Score: {option.recoveryScore}/100
          <span className={`ml-0.5 ${scoreLabel(option.recoveryScore).className}`}>
            ({scoreLabel(option.recoveryScore).text})
          </span>
        </span>
      </div>

      {/* Verdict */}
      <p className={`mt-2 text-[12px] font-semibold leading-snug ${isRec ? 'text-amber-200' : option.status === 'ALTERNATIVE' ? 'text-sky-300' : 'text-zinc-300'}`}>
        {why.verdict}
      </p>

      {/* Key metrics strip for recommended — Priority 4 */}
      {isRec && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
            score: {option.recoveryScore}
          </span>
          <span className="rounded border border-zinc-700/60 bg-zinc-800/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            remaining risk: {option.residualRisk}/100
          </span>
          {option.metrics.makesMeeting && (
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
              meeting preserved
            </span>
          )}
        </div>
      )}

      {/* Recommended reasons */}
      {why.whyRecommended.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-500/80">Why it won</div>
          {why.whyRecommended.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400/70" />
              <span className="text-[11px] leading-snug text-zinc-300">{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rejection reasons */}
      {why.whyRejected.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-red-500/80">Why it lost</div>
          {why.whyRejected.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5">
              <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400/70" />
              <span className="text-[11px] leading-snug text-zinc-300">{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Trade-offs */}
      {why.tradeoffs.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-500/80">Trade-offs</div>
          {why.tradeoffs.map((t, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/60" />
              <span className="text-[11px] leading-snug text-zinc-400">{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* Preserved journey elements */}
      {why.preservedJourneyElements.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-sky-500/80">Journey preserved</div>
          {why.preservedJourneyElements.map((p, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-sky-400/60" />
              <span className="text-[11px] leading-snug text-zinc-400">{p}</span>
            </div>
          ))}
        </div>
      )}

      {/* Remaining risks */}
      {why.remainingRisks.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-orange-500/80">Remaining risks</div>
          {why.remainingRisks.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-orange-400/60" />
              <span className="text-[11px] leading-snug text-zinc-400">{r}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function OptionComparison({ options }: Props) {
  // Only show if options have `why` populated
  if (!options || options.length === 0 || !options.some((o) => o.why)) return null;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">07 ·</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">
            Why Each Option Won or Lost
          </h2>
        </div>
      </div>

      <div className="p-4">
        <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">
          <span className="font-semibold text-zinc-400">Factual analysis based on exact calculations.</span>{' '}
          FlightResist protects the <span className="font-semibold text-zinc-300">journey</span>, not just the booking.
          Every fact below comes from the system&apos;s own calculations — the AI assistant simply puts
          them into plain English.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {options.map((o, i) => (
            <WhyBlock key={o.id} option={o} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
