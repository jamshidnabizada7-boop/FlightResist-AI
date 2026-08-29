'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  ExternalLink,
  Loader2,
  Plane,
  RotateCcw,
  ShieldCheck,
  Ticket,
  XCircle,
  Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fmtDuration } from '@/lib/flightresist/format';
import type { AgentEvent, ExecutionResult, ProviderInfo, ScoredOption } from '@/lib/flightresist/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: ScoredOption | null;
  provider: ProviderInfo;
  events: AgentEvent[];
  /** Seq of the last event before execution started (live steps have seq > startSeq). */
  startSeq: number;
  result: ExecutionResult | null;
  executing: boolean;
  onRetry: () => void;
  onSwitchToDemo?: () => void;
}

interface StepDef {
  key: string;
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  agent: string;
}

/** Step definitions with clean, professional labels */
function stepDefs(live: boolean): StepDef[] {
  return [
    { key: 'approval', title: 'Supervisor Approval', detail: 'Explicit POST payload validated', icon: ShieldCheck, agent: 'SUPERVISOR' },
    { key: 'verify_fare', title: 'Fare Verification', detail: 'Real-time fare validity locked', icon: BadgeCheck, agent: 'TOOLS' },
    { key: 'create_order', title: 'Order Creation', detail: 'Passenger details & route bound', icon: Plane, agent: 'TOOLS' },
    {
      key: 'authorize_payment',
      title: 'Payment Authorization',
      detail: live ? 'Live Atlas settlement authorized' : 'Sandbox wallet authorized',
      icon: CreditCard,
      agent: 'TOOLS',
    },
    {
      key: 'issue_ticket',
      title: 'e-Ticket Issuance',
      detail: live ? 'Airline GDS PNR issued' : 'Simulated booking reference generated',
      icon: Ticket,
      agent: 'TOOLS',
    },
    { key: 'order_status', title: 'State Finalization', detail: 'Immutably logged to audit ledger', icon: BadgeCheck, agent: 'SUPERVISOR' },
  ];
}

const EVENT_TO_STEP: Record<string, number> = {
  verify_fare: 1,
  create_order: 2,
  authorize_payment: 3,
  issue_ticket: 4,
  order_status: 5,
};

export function ExecutionModal({
  open,
  onOpenChange,
  option,
  provider,
  events,
  startSeq,
  result,
  executing,
  onRetry,
  onSwitchToDemo,
}: Props) {
  const liveSteps = useMemo(() => {
    const map = new Map<number, AgentEvent>();
    for (const e of events) {
      if (e.seq <= startSeq) continue;
      const idx = EVENT_TO_STEP[e.step];
      if (idx !== undefined) map.set(idx, e);
    }
    return map;
  }, [events, startSeq]);

  const isLive = (result?.providerMode ?? provider.mode) === 'ATLAS_SANDBOX';
  const defs = useMemo(() => stepDefs(isLive), [isLive]);

  const completed = result !== null && !executing;
  const failed = result?.status === 'FAILED';

  const isUnbookable = Boolean(
    result?.error?.includes('UNBOOKABLE_OFFER') ||
    result?.error?.includes('reference-only') ||
    result?.error?.includes('activation') ||
    result?.error?.includes('ticketing blocked')
  );
  const isBalanceCheck = Boolean(
    result?.error?.includes('PAYMENT_BALANCE_CHECK_REQUIRED') ||
    result?.error?.includes('balance check') ||
    result?.error?.includes('411')
  );
  const orderUrlMatch = result?.error?.match(/https?:\/\/[^\s)]+/);
  const orderUrl = orderUrlMatch ? orderUrlMatch[0] : 'https://resources.atriptech.com';

  const stepState = (i: number): 'done' | 'active' | 'pending' => {
    if (completed) {
      if (failed && i >= 3) return liveSteps.has(i) ? 'done' : 'pending';
      return 'done';
    }
    if (liveSteps.has(i)) return 'done';
    if (i === 0) return 'done';
    return 'pending';
  };

  const stepDuration = (i: number): number | undefined => {
    if (i === 0) return 0;
    const live = liveSteps.get(i);
    if (live && live.durationMs > 0) return live.durationMs;
    if (!result) return undefined;
    const agg = result.steps.find((s) =>
      i === 1
        ? s.name === 'Verify fare'
        : i <= 4
          ? s.name.startsWith('Create order')
          : s.name.startsWith('Order status'),
    );
    return agg?.durationMs;
  };

  const doneCount = defs.reduce((acc, _, i) => acc + (stepState(i) === 'done' ? 1 : 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto overflow-x-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/95 p-0 text-foreground shadow-2xl shadow-black/80 backdrop-blur-xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-track]:bg-transparent">
        {/* Top Glowing Ambient Hairline */}
        <div className={`h-1 w-full bg-gradient-to-r ${isLive ? 'from-emerald-500 via-teal-400 to-emerald-600' : 'from-amber-500 via-orange-400 to-amber-600'}`} />

        {/* Header Section */}
        <div className="relative border-b border-zinc-800/80 px-6 py-4">
          <div className={`pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl ${isLive ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`} />
          <DialogHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-extrabold tracking-tight">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${isLive ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' : 'border-amber-500/40 bg-amber-500/15 text-amber-400'}`}>
                  <Zap className="h-4 w-4 fill-current" />
                </div>
                <span>
                  {completed ? (failed ? 'Recovery Execution Failed' : 'Recovery Booked & Confirmed') : 'Autonomous Execution in Flight'}
                </span>
                {option && (
                  <span className="text-sm font-semibold text-zinc-400">
                    · Option {option.label}
                  </span>
                )}
              </DialogTitle>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-extrabold uppercase tracking-wider ${
                    isLive
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                  {isLive ? 'Live Atlas GDS' : 'Simulation Mode'}
                </span>
              </div>
            </div>

            <DialogDescription className="font-mono text-xs text-zinc-400">
              Autonomous Agentic Pipeline · Multi-Step Airline Rebooking &amp; Settlement
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* SUCCESS HERO: High-Impact Boarding Pass & Confirmation Card */}
          {completed && !failed && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 via-zinc-900/60 to-zinc-950 p-5 shadow-xl shadow-emerald-950/20 backdrop-blur-md"
            >
              {/* Background ambient radial glow */}
              <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-80 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-2xl" />

              <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-300">
                    {result.status} · {result.state}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                  <span>Execution Duration:</span>
                  <span className="rounded bg-zinc-800/80 px-2 py-0.5 font-bold tabular-nums text-emerald-300">
                    {fmtDuration(result.executionTimeMs)}
                  </span>
                </div>
              </div>

              {/* Main Reference Code Display */}
              <div className="relative py-4 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  {isLive ? 'Official Airline GDS Booking Reference (PNR)' : 'Simulated Recovery Confirmation Code'}
                </div>
                <div className="mt-1 font-mono text-3xl sm:text-4xl font-extrabold tracking-[0.18em] text-amber-300 drop-shadow-[0_0_24px_rgba(251,191,36,0.35)]">
                  {result.pnr ?? result.demoReference ?? 'CONFIRMED'}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-xs text-zinc-400">
                  <span>Order ID: <strong className="text-zinc-200">{result.orderId}</strong></span>
                  <span>·</span>
                  <span>Fare Key: <strong className="text-zinc-200">{result.fareKey}</strong></span>
                </div>
              </div>

              <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2.5 text-center">
                <p className="font-mono text-[11px] text-zinc-400">
                  {isLive
                    ? '✓ Real GDS ticket issued through Atlas Travel API. Order record immutably sealed in database.'
                    : '✓ Autonomous recovery simulation completed. All audit events and ledger transactions committed.'}
                </p>
              </div>
            </motion.div>
          )}

          {/* FAILURE STATE */}
          {completed && failed && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-red-500/40 bg-red-950/30 p-5 backdrop-blur-md space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-400" />
                  <span className="font-mono text-sm font-bold text-red-300">EXECUTION BLOCKED / FAILED</span>
                </div>
                <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase text-red-300">
                  {isUnbookable ? 'Unbookable Sandbox Offer' : isBalanceCheck ? 'Balance Check Required' : 'Execution Error'}
                </span>
              </div>

              <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-xs leading-relaxed text-zinc-300">
                <p className="font-medium text-red-200">
                  {isUnbookable
                    ? 'Live Sandbox Inventory Notice: The selected flight offer is comparison-only inventory. Live automated ticketing requires account activation in your ATRIP workspace.'
                    : isBalanceCheck
                      ? 'Payment Balance Check Required: Atlas balance verification required before proceeding.'
                      : result.error}
                </p>
                {result.error && (isUnbookable || isBalanceCheck) && (
                  <p className="mt-2 font-mono text-[11px] text-zinc-400">Technical payload: {result.error}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {onSwitchToDemo && (
                  <Button
                    onClick={() => {
                      onSwitchToDemo();
                      onOpenChange(false);
                    }}
                    className="h-9 gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-4 text-xs font-extrabold text-zinc-950 shadow-md shadow-amber-500/20 hover:brightness-105"
                  >
                    <Zap className="h-3.5 w-3.5 fill-current" />
                    Switch to Simulation Mode &amp; Re-run
                  </Button>
                )}
                {(isUnbookable || isBalanceCheck) && (
                  <a
                    href={orderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open ATRIP Workspace
                  </a>
                )}
                {!isBalanceCheck && !isUnbookable && (
                  <Button
                    onClick={onRetry}
                    className="h-9 gap-2 rounded-lg border border-red-500/40 bg-red-500/10 text-xs font-bold text-red-300 hover:bg-red-500/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry Execution
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* EXECUTING SHIMMER (When in flight) */}
          {executing && (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4">
              <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
              <span className="font-mono text-xs sm:text-sm font-bold text-amber-200">
                Executing multi-step airline settlement transaction…
              </span>
            </div>
          )}

          {/* AGENTIC STEP TIMELINE (Compact Grid / Two-Column Layout) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              <span>Agentic Verification Pipeline</span>
              <span className="text-emerald-400 font-bold">{doneCount} / 6 Verified</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {defs.map((def, i) => {
                const st = stepState(i);
                const ev = liveSteps.get(i);
                const duration = stepDuration(i);
                return (
                  <div
                    key={def.key}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-all ${
                      st === 'done'
                        ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                        : executing && i === doneCount
                          ? 'border-amber-500/50 bg-amber-500/[0.08] shadow-[0_0_12px_rgba(245,158,11,0.1)]'
                          : 'border-zinc-800/80 bg-zinc-900/30 opacity-70'
                    }`}
                  >
                    <div className="mt-0.5 flex shrink-0 items-center justify-center">
                      {st === 'done' ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                      ) : executing && i === doneCount ? (
                        <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                      ) : (
                        <CircleDashed className="h-4 w-4 text-zinc-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`truncate text-xs font-bold ${st === 'done' ? 'text-zinc-200' : 'text-zinc-400'}`}>
                          {def.title}
                        </span>
                        {st === 'done' && duration !== undefined && duration > 0 && (
                          <span className="rounded bg-zinc-800/80 px-1.5 py-px font-mono text-[10px] tabular-nums text-zinc-400">
                            {fmtDuration(duration)}
                          </span>
                        )}
                      </div>
                      <p className="truncate font-mono text-[10px] text-zinc-400">
                        {ev?.details ?? def.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

