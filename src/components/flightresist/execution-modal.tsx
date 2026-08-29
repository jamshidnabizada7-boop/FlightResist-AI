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

/** Step definitions — the demo-specific details are swapped for real Atlas
 *  wording when the provider runs live (mode = ATLAS_SANDBOX). */
function stepDefs(live: boolean): StepDef[] {
  return [
    { key: 'approval', title: 'Human approval received', detail: 'Explicit POST /api/recovery/confirm payload', icon: ShieldCheck, agent: 'SUPERVISOR' },
    { key: 'verify_fare', title: 'Verify fare', detail: 'provider.verifyFare(fare_key)', icon: BadgeCheck, agent: 'TOOLS' },
    { key: 'create_order', title: 'Create order', detail: 'provider.createAndPayOrder(…)', icon: Plane, agent: 'TOOLS' },
    {
      key: 'authorize_payment',
      title: 'Authorize payment',
      detail: live ? 'order pay — real payment through Atlas' : 'sandbox payment — demo wallet',
      icon: CreditCard,
      agent: 'TOOLS',
    },
    {
      key: 'issue_ticket',
      title: 'Issue ticket',
      detail: live ? 'airline PNR issued by the provider' : 'simulated e-ticket reference',
      icon: Ticket,
      agent: 'TOOLS',
    },
    { key: 'order_status', title: 'Confirm order status', detail: 'provider.getOrderStatus(order_id)', icon: BadgeCheck, agent: 'SUPERVISOR' },
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

  // Live (real Atlas flights) vs demo — prefer the executed result's recorded
  // mode, falling back to the active provider while execution is in flight.
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
    // step 0 done as soon as modal opens (approval = the tap)
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

  // presentational: how many steps are complete (drives the emerald progress rail)
  const doneCount = defs.reduce((acc, _, i) => acc + (stepState(i) === 'done' ? 1 : 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overflow-x-hidden border-border bg-background p-0 text-foreground shadow-2xl shadow-black/60">
        {/* amber accent hairline */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
        {/* header */}
        <div className="relative overflow-hidden border-b border-zinc-800 px-5 py-4">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold">
              <Zap className="h-5 w-5 text-amber-400" />
              {completed ? (failed ? 'Execution Failed' : 'Recovery Executed') : 'Executing Recovery'}
              {option && <span className="text-zinc-400">— Option {option.label}</span>}
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  isLive
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
                title={isLive ? 'Live mode — real booking through the Atlas provider' : 'Demo mode — simulated booking, no real payment'}
              >
                {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
                {isLive ? 'LIVE' : 'DEMO'}
              </span>
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] text-zinc-500">
              {provider.badge} · {provider.label}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* steps — timeline rail with emerald progress fill */}
        <div className="relative px-5 py-4">
          <div className="absolute bottom-5 left-[31.5px] top-5 w-px bg-zinc-800/80" />
          <motion.div
            className="absolute left-[31.5px] top-5 w-px origin-top bg-gradient-to-b from-emerald-400 to-emerald-500/50"
            style={{ height: 'calc(100% - 40px)' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: doneCount / 6 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          {defs.map((def, i) => {
            const st = stepState(i);
            const ev = liveSteps.get(i);
            const duration = stepDuration(i);
            return (
              <div key={def.key} className="relative flex items-center gap-3 py-1">
                <div
                  className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background transition-colors ${
                    st === 'done' ? 'border-emerald-500/50' : 'border-zinc-700/70'
                  }`}
                >
                  {st === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : executing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  ) : (
                    <CircleDashed className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    st === 'done'
                      ? 'border-emerald-500/25 bg-emerald-500/[0.05]'
                      : 'border-zinc-800/70 bg-zinc-900/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[12.5px] font-semibold ${st === 'done' ? 'text-zinc-200' : 'text-zinc-400'}`}>
                        {def.title}
                      </span>
                      <span
                        className={`rounded border px-1 py-px text-[10.5px] font-bold tracking-wider ${
                          def.agent === 'SUPERVISOR'
                            ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                            : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                        }`}
                      >
                        {def.agent}
                      </span>
                    </div>
                    <div className="truncate font-mono text-[10px] text-zinc-400">
                      {ev?.details ?? def.detail}
                    </div>
                  </div>
                  {st === 'done' && i > 0 && duration !== undefined && duration > 0 && (
                    <span className="inline-block min-w-[46px] shrink-0 rounded bg-zinc-800/80 px-1.5 py-0.5 text-center font-mono text-[10px] tabular-nums text-zinc-400">
                      {fmtDuration(duration)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* result panel */}
        {completed && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mx-5 mb-5 rounded-xl border p-4 ${
              failed ? 'border-red-500/40 bg-red-500/[0.06]' : 'border-emerald-500/40 bg-emerald-500/[0.06]'
            }`}
          >
            {failed ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-400" />
                    <span className="font-mono text-sm font-bold text-red-400">FAILED</span>
                  </div>
                  <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-red-300">
                    {isUnbookable
                      ? 'Unbookable Sandbox Offer'
                      : isBalanceCheck
                        ? 'Balance Check Required'
                        : 'Execution Error'}
                  </span>
                </div>

                <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3 text-[11.5px] leading-relaxed text-zinc-300">
                  <p className="font-medium text-red-200">
                    {isUnbookable
                      ? 'Live Sandbox Inventory Notice: The selected flight offer is reference-only comparison inventory. Direct live booking and automated ticketing require account ticketing activation in your ATRIP workspace.'
                      : isBalanceCheck
                        ? 'Payment Balance Check Required: Payment could not be confirmed because account balance may be insufficient. SKILL.md Safety Rule: Do NOT re-submit payment directly.'
                        : result.error}
                  </p>
                  {result.error && (isUnbookable || isBalanceCheck) && (
                    <p className="mt-1 font-mono text-[10px] text-zinc-400">
                      Technical detail: {result.error}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {onSwitchToDemo && (
                    <Button
                      onClick={() => {
                        onSwitchToDemo();
                        onOpenChange(false);
                      }}
                      className="h-9 gap-2 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 px-4 text-xs font-extrabold text-neutral-950 shadow-md shadow-amber-500/20 hover:brightness-105"
                    >
                      <Zap className="h-3.5 w-3.5 fill-current" />
                      ⚡ Switch to Demo Mode &amp; Simulate Recovery
                    </Button>
                  )}

                  {(isUnbookable || isBalanceCheck) && (
                    <a
                      href={orderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      ↗ Open ATRIP Workspace
                    </a>
                  )}

                  {!isBalanceCheck && !isUnbookable && (
                    <Button
                      onClick={onRetry}
                      className="h-9 gap-2 rounded-md border border-red-500/40 bg-red-500/10 text-xs font-bold text-red-300 transition-all hover:bg-red-500/20 active:scale-[0.97] focus-visible:ring-red-400/60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      RETRY EXECUTION
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {result.status} · {result.state}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                    total {fmtDuration(result.executionTimeMs)}
                  </span>
                </div>

                <div className="relative mt-3 overflow-hidden rounded-lg px-2 py-2 text-center">
                  <motion.div
                    aria-hidden
                    className={`pointer-events-none absolute left-1/2 top-1/2 h-20 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl ${
                      isLive ? 'bg-emerald-500/15' : 'bg-amber-500/15'
                    }`}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.85, 0.4] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="relative text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    {isLive
                      ? result.pnr
                        ? 'Live booking reference — real PNR from Atlas'
                        : 'Live booking reference'
                      : 'Simulated reference (demo mode)'}
                  </div>
                  <div
                    className={`relative mt-1 font-mono text-2xl font-extrabold tracking-[0.16em] ${
                      isLive ? 'fr-glow-emerald text-emerald-300' : 'fr-glow-amber text-amber-300'
                    }`}
                  >
                    {result.pnr ?? result.demoReference ?? '—'}
                  </div>
                  <div className="relative mt-1 font-mono text-[10.5px] tabular-nums text-zinc-500">
                    order {result.orderId} · fare {result.fareKey}
                  </div>
                </div>

                <div
                  className={`mt-3 rounded-lg border p-2.5 text-center ${
                    isLive
                      ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
                      : 'border-amber-500/25 bg-amber-500/[0.06]'
                  }`}
                >
                  <div
                    className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
                      isLive ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {provider.badge}
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-500">
                    {isLive
                      ? 'Live execution — real booking through the Atlas provider: real order id and real PNR returned by the provider.'
                      : 'Simulated execution — no real booking, no real payment, no fabricated PNR. A live Atlas sandbox would return a real order id + PNR here.'}
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* executing shimmer */}
        {executing && (
          <div className="mx-5 mb-5 flex items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3">
            <motion.div
              className="h-2 w-2 rounded-full bg-amber-400"
              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="font-mono text-[11px] text-amber-300">
              state: EXECUTING — provider transaction in flight…
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
