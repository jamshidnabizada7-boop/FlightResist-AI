'use client';

import { motion } from 'framer-motion';
import { BrainCircuit, Database, Lock, Sparkles } from 'lucide-react';
import type { LlmExplanation, TripState } from '@/lib/flightresist/types';

interface Props {
  explanation: LlmExplanation | null;
  state: TripState;
}

const VERDICT_STYLE: Record<string, string> = {
  RECOMMENDED: 'border-amber-400/50 bg-amber-400/15 text-amber-300',
  SECONDARY: 'border-zinc-600/60 bg-zinc-700/30 text-zinc-300',
  ALTERNATIVE: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
};

export function LlmPanel({ explanation, state }: Props) {
  const reasoning = state === 'ANALYZING';

  return (
    <section
      className={`rounded-xl border bg-zinc-900/60 backdrop-blur-sm ${
        reasoning ? 'fr-thinking border-fuchsia-500/30' : 'border-zinc-800/80'
      }`}
    >
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-fuchsia-400" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">08 ·</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">AI Trade-off Reasoning</h2>
          <span className="ml-1 text-[10px] text-zinc-500">— AI-generated plain English summary</span>
        </div>
        {explanation && (
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
                explanation.source === 'LLM'
                  ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-400'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              {explanation.source === 'LLM' ? 'Qwen 2.5 · Alibaba Cloud' : 'TEMPLATE REASONER'}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-zinc-500">{explanation.latencyMs}ms</span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {!explanation ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center gap-3 text-center">
            {reasoning ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <BrainCircuit className="h-8 w-8 text-fuchsia-400/80" />
                </motion.div>
                <p className="text-xs text-zinc-400">LLM reasoner composing plain-English trade-offs…</p>
                <div className="w-full max-w-sm space-y-2">
                  <div className="fr-skeleton h-2 rounded" />
                  <div className="fr-skeleton h-2 w-4/5 rounded" />
                  <div className="fr-skeleton h-2 w-3/5 rounded" />
                </div>
              </>
            ) : (
              <>
                <BrainCircuit className="h-8 w-8 text-zinc-500" />
                <p className="max-w-[300px] text-xs leading-relaxed text-zinc-400">
                  After the deterministic engine ranks the finalists, the LLM reasoner explains the
                  recommendation in plain English — it can never alter a score.
                </p>
              </>
            )}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.5 }}>
            <h3 className="text-[15px] font-bold leading-snug text-zinc-100">{explanation.headline}</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-400">{explanation.summary}</p>

            <div className="mt-4 space-y-2">
              {explanation.tradeoffs.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                  className="flex items-start gap-2.5 rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2.5"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[11px] font-extrabold ${
                      VERDICT_STYLE[t.verdict.toUpperCase()] ?? VERDICT_STYLE.SECONDARY
                    }`}
                  >
                    {t.option}
                  </span>
                  <p className="text-[11.5px] leading-snug text-zinc-300">{t.text}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-2.5">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
              <p className="text-[10.5px] leading-relaxed text-zinc-500">
                <span className="font-semibold text-fuchsia-300/90">Explanation-only layer.</span>{' '}
                {explanation.confidenceNote} Model: {explanation.model}.
              </p>
            </div>

            {/* Phase 5: deterministic fact payload evidence */}
            {explanation.factPayload && (
              <div className="mt-3 rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3">
                <div className="flex items-center gap-1.5">
                  <Database className="h-3 w-3 text-emerald-400/70" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500/80">Deterministic fact payload</span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500">
                  <span>recommended: <span className="text-amber-300">Option {explanation.factPayload.recommended}</span></span>
                  <span>score: <span className="text-amber-300">R={explanation.factPayload.score}</span></span>
                  <span>fare_diff: <span className="text-zinc-300">${explanation.factPayload.fareDiff}</span></span>
                  <span>delay: <span className="text-zinc-300">+{explanation.factPayload.delayHours}h</span></span>
                  <span>meeting: <span className={explanation.factPayload.meetingPreserved ? 'text-emerald-400' : 'text-red-400'}>{String(explanation.factPayload.meetingPreserved)}</span></span>
                  <span>budget: <span className={explanation.factPayload.budgetPass ? 'text-emerald-400' : 'text-red-400'}>{String(explanation.factPayload.budgetPass)}</span></span>
                  <span>connection: <span className={explanation.factPayload.connectionPass ? 'text-emerald-400' : 'text-red-400'}>{String(explanation.factPayload.connectionPass)}</span></span>
                  <span>risk: <span className="text-zinc-300">{explanation.factPayload.residualRisk}/100</span></span>
                </div>
                {explanation.factPayload.impactsResolved.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-zinc-400">resolved: {explanation.factPayload.impactsResolved.join(', ')}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
