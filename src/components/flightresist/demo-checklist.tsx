'use client';

/**
 * Demo checklist — a guided, state-aware run sheet for first-time presenters.
 * Opened from the help overlay ("Open demo checklist"). Each step shows what
 * to do, what to say (narration), and what to look for (proof), with a live
 * checkmark when the app state confirms the step is done.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Circle, ListChecks, Plane, X } from 'lucide-react';
import type { TripState } from '@/lib/flightresist/types';

interface Props {
  open: boolean;
  onClose: () => void;
  state: TripState;
}

interface Step {
  title: string;
  action: string;
  narration: string;
  proof: string;
  /** The app state(s) in which this step is considered complete. */
  doneWhen: TripState[];
}

const STEPS: Step[] = [
  {
    title: 'Set the scene (~30s)',
    action: 'Point at the itinerary: Wei Chen flies SIN → NRT via HKG to sign a ¥2.1B contract at 08:30 tomorrow morning.',
    narration: '"A typhoon is about to cancel his first leg — watch what an autonomous agent does about it."',
    proof: 'Header shows All Clear · risk 0 · Demo Mode.',
    doneWhen: ['NORMAL'],
  },
  {
    title: 'Trigger the disruption',
    action: 'Press D (or the big amber button) to cancel SQ856. Press E instead for the milder +45m delay scenario.',
    narration: '"One webhook is all it takes — the sentinel detects it and the pipeline takes over."',
    proof: 'State jumps to ANALYZING; the agent trace starts streaming live events.',
    doneWhen: ['DISRUPTION_DETECTED', 'ANALYZING'],
  },
  {
    title: 'Watch the impact graph (~10s)',
    action: 'Point at the risk gauge climbing to 87/100 CRITICAL and the six dependency nodes.',
    narration: '"The engine weighs the whole trip — the 08:30 signing alone carries 58% of the value."',
    proof: 'Gauge reads 87 CRITICAL; meeting node shows impacted.',
    doneWhen: ['ANALYZING', 'RECOVERY_OPTIONS_READY', 'AWAITING_APPROVAL', 'EXECUTING', 'RECOVERED', 'FAILED'],
  },
  {
    title: 'Walk the funnel',
    action: 'Scroll to the decision funnel: 42 candidates → 12 over budget → 18 unsafe connections → 9 baggage-incompatible → 3 finalists.',
    narration: '"Four hard constraints, enforced deterministically — no LLM arithmetic anywhere in this funnel."',
    proof: 'Funnel bars animate 42 → 30 → 12 → 3; radar compares the finalists.',
    doneWhen: ['RECOVERY_OPTIONS_READY', 'AWAITING_APPROVAL', 'EXECUTING', 'RECOVERED', 'FAILED'],
  },
  {
    title: 'Read the AI reasoning',
    action: 'Show the trade-off panel: the LLM explains Option B in plain English.',
    narration: '"The LLM only explains the numbers the deterministic engine already computed — it can never override them."',
    proof: 'Panel shows headline + tradeoffs, source badge "LLM · Z.AI SDK".',
    doneWhen: ['AWAITING_APPROVAL', 'EXECUTING', 'RECOVERED', 'FAILED'],
  },
  {
    title: 'The 1-tap approval',
    action: 'Press A (or tap APPROVE & EXECUTE). The modal runs: verify fare → order → pay → ticket.',
    narration: '"Nothing executes without one explicit human confirmation — that is the safety gate."',
    proof: 'Modal shows live steps with real millisecond durations.',
    doneWhen: ['EXECUTING', 'RECOVERED'],
  },
  {
    title: 'Show the result',
    action: 'Point at SIM-REV-89211, the recovered routing strip, risk dropping to 18, and the ledger row.',
    narration: '"Recovery executed in about two seconds — and this CSV/PDF evidence is all real session data."',
    proof: 'State RECOVERED · gauge 18 · routing strip shows TR976 › BR2198.',
    doneWhen: ['RECOVERED'],
  },
  {
    title: 'Leave-behind + reset',
    action: 'Press P for the one-page PDF summary, or export the JSON/CSV evidence. Then press R to reset for the next run.',
    narration: '"Everything a judge needs to verify the run is in those artifacts."',
    proof: 'Header buttons: Run Report · Evidence CSV · Summary.',
    doneWhen: ['RECOVERED'],
  },
];

const STAGE_INDEX: Record<TripState, number> = {
  NORMAL: 0,
  DISRUPTION_DETECTED: 1,
  ANALYZING: 1,
  RECOVERY_OPTIONS_READY: 3,
  AWAITING_APPROVAL: 4,
  EXECUTING: 5,
  RECOVERED: 6,
  FAILED: 5,
};

export function DemoChecklist({ open, onClose, state }: Props) {
  const currentStage = STAGE_INDEX[state] ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="demo-checklist"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 dark:bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Demo checklist"
        >
          <motion.div
            className="flex max-h-[86vh] w-full max-w-lg flex-col rounded-xl border border-border bg-background shadow-2xl"
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center gap-2 border-b border-zinc-800/70 bg-gradient-to-r from-amber-500/[0.07] via-transparent to-transparent px-5 py-4">
              <ListChecks className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-zinc-100">Demo Checklist</h3>
              <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-px font-mono text-[11px] text-zinc-400">
                live · state-aware
              </span>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="Close demo checklist"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* progress */}
            <div className="border-b border-zinc-800/70 px-5 py-2.5">
              <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                <span>
                  step {Math.min(currentStage + 1, STEPS.length)} / {STEPS.length}
                </span>
                <span className="uppercase tracking-wider">
                  current state:{' '}
                  <span className="text-amber-300">{state.replaceAll('_', ' ').toLowerCase()}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                  animate={{ width: `${((currentStage + 1) / STEPS.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* steps */}
            <div className="fr-scroll flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-2.5">
                {STEPS.map((step, i) => {
                  const done = i < currentStage;
                  const active = i === currentStage;
                  return (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: active || done ? 1 : 0.55, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className={`rounded-lg border p-3 transition-colors ${
                        active
                          ? 'border-amber-400/50 bg-amber-500/[0.06] shadow-[0_0_16px_rgba(251,191,36,0.07)]'
                          : done
                            ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                            : 'border-zinc-800/70 bg-zinc-950/40 hover:border-zinc-700/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : active ? (
                          <Plane className="h-4 w-4 shrink-0 text-amber-300" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-zinc-400" />
                        )}
                        <span
                          className={`text-[12.5px] font-bold ${
                            active ? 'text-amber-200' : done ? 'text-emerald-200/90' : 'text-zinc-300'
                          }`}
                        >
                          {i + 1}. {step.title}
                        </span>
                        {active && (
                          <span className="ml-auto rounded bg-amber-400/15 px-1.5 py-px font-mono text-[10.5px] font-bold uppercase tracking-wider text-amber-300">
                            you are here
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1.5 pl-6">
                        <div className="flex gap-2">
                          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
                          <p className="text-[11.5px] leading-snug text-zinc-300">{step.action}</p>
                        </div>
                        <div className="flex gap-2 rounded border border-fuchsia-500/15 bg-fuchsia-500/[0.04] px-2 py-1.5">
                          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-fuchsia-300/70">say</span>
                          <p className="text-[11px] italic leading-snug text-zinc-400">{step.narration}</p>
                        </div>
                        <div className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
                          <p className="font-mono text-[10px] leading-snug text-zinc-500">{step.proof}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* footer */}
            <div className="border-t border-zinc-800/70 px-5 py-3">
              <p className="text-[10.5px] leading-relaxed text-zinc-400">
                The checklist tracks the live trip state — checkmarks advance as you run the demo. Close it any
                time; the demo runs identically with or without it.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
