'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Boxes,
  BrainCircuit,
  Calculator,
  ChevronDown,
  GitBranch,
  Layers,
  Lock,
  Radar,
  Scale,
  ServerCog,
  Workflow,
} from 'lucide-react';
import type { ProviderMode } from '@/lib/flightresist/types';

interface Props {
  providerMode: ProviderMode;
}

const PIPELINE_STEPS: { label: string; detail: string; deterministic: boolean }[] = [
  { label: 'Trip State Engine', detail: '8-state machine, guarded transitions', deterministic: true },
  { label: 'Disruption Webhook', detail: 'validated inbound event', deterministic: true },
  { label: 'Trip Impact Graph', detail: '6 weighted nodes → risk /100', deterministic: true },
  { label: 'Candidate Search', detail: 'provider inventory (42 in demo)', deterministic: false },
  { label: 'Hard Constraints', detail: 'deadline · budget · MCT · baggage', deterministic: true },
  { label: 'Multi-Criteria Score', detail: 'R = .35a + .25c + .20p + .10b + .10r', deterministic: true },
  { label: 'LLM Reasoner', detail: 'plain-English trade-offs only', deterministic: false },
  { label: 'Human Approval', detail: 'explicit POST confirm — 1 tap', deterministic: true },
  { label: 'Provider Execution', detail: 'verify → order → pay → ticket', deterministic: false },
];

const DETERMINISTIC_DOTS: Record<string, string> = {
  'Trip State Engine': 'emerald',
  'Disruption Webhook': 'emerald',
  'Trip Impact Graph': 'emerald',
  'Candidate Search': 'amber',
  'Hard Constraints': 'emerald',
  'Multi-Criteria Score': 'emerald',
  'LLM Reasoner': 'fuchsia',
  'Human Approval': 'emerald',
  'Provider Execution': 'amber',
};

const DOT_TONE: Record<string, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  fuchsia: 'bg-fuchsia-400',
};

export function HowItWorks({ providerMode }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-b border-zinc-800/60 px-4 py-3 text-left transition-colors hover:bg-zinc-800/30"
      >
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">10 ·</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">How It Works</h2>
          <span className="hidden rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-px font-mono text-[11px] text-zinc-500 sm:inline">
            architecture for judges
          </span>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-5 p-4 sm:p-5">
              {/* ---- 9-step pipeline ---- */}
              <div>
                <div className="mb-2.5 flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-zinc-500" />
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    The recovery pipeline — 9 steps, one confirmation
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {PIPELINE_STEPS.map((step, i) => (
                    <motion.div
                      key={step.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
                      className="flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2.5 py-2"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800/80 font-mono text-[11px] font-bold text-zinc-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[DETERMINISTIC_DOTS[step.label]]}`} />
                          <span className="truncate text-[11px] font-semibold text-zinc-200">{step.label}</span>
                        </div>
                        <div className="truncate text-[11px] text-zinc-500">{step.detail}</div>
                      </div>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <ArrowRight className="hidden h-3 w-3 shrink-0 text-zinc-500 sm:last:hidden" />
                      )}
                    </motion.div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> deterministic (authoritative)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" /> LLM (explanation-only)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> provider I/O
                  </span>
                </div>
              </div>

              {/* ---- Safety invariant + scoring ---- */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-3">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-fuchsia-400" />
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-300/90">
                      Safety invariant
                    </h4>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                    Hard constraints and the multi-criteria score are computed by{' '}
                    <span className="font-semibold text-zinc-200">closed-form deterministic code</span>. The LLM
                    receives the computed values and is prompt-locked from recomputing them — it can never override
                    a safety rule or invent a number. If the LLM fails, a template fallback keeps the pipeline
                    moving.
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950/50 px-2 py-1.5 font-mono text-[11px] text-zinc-500">
                    <Calculator className="h-3 w-3 text-emerald-400" />
                    arithmetic lives in TypeScript · <BrainCircuit className="h-3 w-3 text-fuchsia-400" /> words live in the LLM
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                  <div className="flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-emerald-400" />
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">
                      Scoring &amp; risk model
                    </h4>
                  </div>
                  <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/50 px-2 py-2 font-mono text-[10px] leading-relaxed text-zinc-300">
                    R = 0.35·arrival + 0.25·connection
                    <br />
                    {'     '}+ 0.20·price + 0.10·baggage + 0.10·risk
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                    Trip risk ={' '}
                    <span className="font-mono text-zinc-300">round(100·Σ weightᵢ·pᵢ)</span> over the impact graph —
                    the mission commitment (the 08:30 signing) carries 58% of trip value, which is why Option B
                    protecting it dominates despite Option C arriving earlier.
                  </p>
                </div>
              </div>

              {/* ---- Provider abstraction ---- */}
              <div>
                <div className="mb-2.5 flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-zinc-500" />
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    Provider abstraction — same interface, swappable backends
                  </h3>
                </div>
                <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-800/40 px-3 py-2.5">
                    <Layers className="h-4 w-4 text-amber-400" />
                    <div>
                      <div className="font-mono text-[11px] font-bold text-zinc-200">BaseTravelProvider</div>
                      <div className="text-[11px] text-zinc-500">searchFlights · verifyFare · createAndPayOrder · getOrderStatus</div>
                    </div>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 shrink-0 self-center text-zinc-400 lg:block" />
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    <div
                      className={`rounded-lg border px-3 py-2.5 ${
                        providerMode === 'DEMO' ? 'border-amber-500/50 bg-amber-500/[0.07]' : 'border-zinc-800/70 bg-zinc-950/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-zinc-200">DemoProvider</span>
                        {providerMode === 'DEMO' && (
                          <span className="rounded bg-amber-400/15 px-1.5 py-px font-mono text-[10.5px] font-bold uppercase text-amber-300">
                            active
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                        Deterministic 42-candidate fixture, <span className="font-mono">SIM-*</span> references, never
                        fabricates a PNR.
                      </p>
                    </div>
                    <div
                      className={`rounded-lg border px-3 py-2.5 ${
                        providerMode === 'ATLAS_SANDBOX' ? 'border-emerald-500/50 bg-emerald-500/[0.07]' : 'border-zinc-800/70 bg-zinc-950/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-zinc-200">AtlasSandboxProvider</span>
                        {providerMode === 'ATLAS_SANDBOX' ? (
                          <span className="rounded bg-emerald-400/15 px-1.5 py-px font-mono text-[10.5px] font-bold uppercase text-emerald-300">
                            active
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-800 px-1.5 py-px font-mono text-[10.5px] font-bold uppercase text-zinc-500">
                            probe-gated
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                        Real <span className="font-mono">atlas-flight</span> CLI adapter — auto-activates the moment
                        the CLI + credentials appear.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-start gap-1.5 rounded border border-zinc-800 bg-zinc-950/40 px-2.5 py-2">
                  <Radar className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
                  <p className="text-[10px] leading-relaxed text-zinc-500">
                    Runtime probe result is displayed live in the header badge. Live Atlas counts would be computed
                    from actual API responses; demo counts come from the deterministic fixture.
                  </p>
                </div>
              </div>

              {/* ---- Stack strip ---- */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-800/60 pt-3">
                <ServerCog className="h-3.5 w-3.5 text-zinc-400" />
                {[
                  'Next.js 16 App Router',
                  'TypeScript 5 strict',
                  'SSE route handlers',
                  'Prisma + SQLite ledger',
                  'z-ai-web-dev-sdk (backend-only LLM)',
                  'framer-motion',
                  'zero external services required',
                ].map((t) => (
                  <span
                    key={t}
                    className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
