'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ListChecks,
  Radar,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react';
import { STATE_ORDER } from '@/lib/flightresist/state-machine';
import { stateStepIndex } from '@/lib/flightresist/state-machine';
import { prettyState } from '@/lib/flightresist/format';
import type { TripState } from '@/lib/flightresist/types';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NORMAL: ShieldCheck,
  DISRUPTION_DETECTED: AlertTriangle,
  ANALYZING: Radar,
  RECOVERY_OPTIONS_READY: ListChecks,
  AWAITING_APPROVAL: UserCheck,
  EXECUTING: Zap,
  RECOVERED: CheckCircle2,
};

interface Props {
  state: TripState;
  failed: boolean;
}

export function StateStepper({ state, failed }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const active = stateStepIndex(state);

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-3 backdrop-blur-sm sm:px-4">
      <div className="relative">
        <div className="flex items-stretch gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATE_ORDER.map((s, i) => {
            const Icon = ICONS[s] ?? CircleDashed;
            const done = i < active || (state === 'RECOVERED' && i === active);
            const isActive = i === active && state !== 'RECOVERED';
            const isFailedHere = failed && i === active;
            return (
              <div key={s} className="flex min-w-fit flex-1 items-center">
                <div className="flex min-w-fit flex-col items-center gap-1.5 px-1">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
                      isFailedHere
                        ? 'border-red-500/60 bg-red-500/15 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                        : done
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                          : isActive
                            ? 'border-amber-400/70 bg-amber-400/15 text-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.35)]'
                            : 'border-zinc-700/80 bg-zinc-800/40 text-zinc-400'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'animate-pulse' : ''}`} />
                  </div>
                  <span
                    className={`whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-wide sm:text-[10px] ${
                      isFailedHere
                        ? 'text-red-400'
                        : done
                          ? 'text-emerald-400/90'
                          : isActive
                            ? 'text-amber-300'
                            : 'text-zinc-400'
                    }`}
                  >
                    {prettyState(s)}
                  </span>
                  {isActive && (
                    <motion.div
                      className="h-1 w-1 rounded-full bg-amber-400"
                      animate={shouldReduceMotion ? {} : { scale: [1, 1.8, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                  )}
                </div>
                {i < STATE_ORDER.length - 1 && (
                  <div
                    className={`mx-0.5 h-px min-w-3 flex-1 transition-colors sm:mx-1 sm:min-w-4 ${
                      i < active ? 'bg-emerald-500/50' : 'bg-zinc-800'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        {/* scroll affordance fades (mobile only, where the rail overflows) */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#131316] to-transparent sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#131316] to-transparent sm:hidden" />
      </div>
    </div>
  );
}
