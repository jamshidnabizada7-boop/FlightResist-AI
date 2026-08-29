'use client';

import { forwardRef, useImperativeHandle, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Banknote,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Luggage,
  MinusCircle,
  Plane,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fmtLocalTime, fmtMinutes } from '@/lib/flightresist/format';
import type { ProviderMode, ScoredOption, TripState } from '@/lib/flightresist/types';
import { RECOVERY_WEIGHTS } from '@/lib/flightresist/types';
import { toLocalTime } from '@/lib/flightresist/time-utils';
import { t } from '@/lib/i18n';

export interface RecoveryOptionsHandle {
  openConfirm: () => void;
}

function scoreLabel(score: number): { text: string; className: string } {
  if (score >= 80) return { text: t('score.excellent'), className: 'text-emerald-400' };
  if (score >= 60) return { text: t('score.good'), className: 'text-amber-400' };
  return { text: t('score.fair'), className: 'text-red-400' };
}

interface Props {
  options: ScoredOption[] | null;
  state: TripState;
  /** Server-resolved provider mode — drives live vs demo copy in the approval flow. */
  providerMode: ProviderMode;
  selectedId: string;
  onSelect: (id: string) => void;
  onApprove: () => void;
  approveBusy: boolean;
  onSwitchToDemo?: () => void;
}

const STATUS_STYLE: Record<ScoredOption['status'], { badge: string; ring: string }> = {
  RECOMMENDED: {
    badge: 'border-amber-400/50 bg-amber-400/15 text-amber-300',
    ring: 'ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/10',
  },
  SECONDARY: {
    badge: 'border-zinc-600/60 bg-zinc-700/20 text-zinc-300',
    ring: 'ring-1 ring-zinc-700/60',
  },
  REJECTED: {
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
    ring: 'ring-1 ring-sky-500/25',
  },
  ALTERNATIVE: {
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
    ring: 'ring-1 ring-sky-500/25',
  },
};

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const pct = Math.round(value);
  const tone = pct >= 75 ? 'bg-emerald-400' : pct >= 45 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className={`h-full w-full origin-left rounded-full ${tone}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: 0.7, delay: 0.25 }}
        />
      </div>
      <span className="w-7 shrink-0 text-right font-mono text-[10px] tabular-nums text-zinc-400">{Math.round(value)}</span>
      <span className="w-8 shrink-0 text-right font-mono text-[11px] text-zinc-400">×{weight}</span>
    </div>
  );
}

function OptionCard({
  option,
  selected,
  onSelect,
  index,
}: {
  option: ScoredOption;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const style = STATUS_STYLE[option.status];
  const dep = fmtLocalTime(option.candidate.depIso);
  const arr = fmtLocalTime(option.candidate.arrIso);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ delay: index * 0.12, duration: 0.4 }}
      className={`group relative flex w-full flex-col rounded-xl p-4 text-left backdrop-blur-sm transition-all hover:shadow-lg hover:shadow-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] ${
        selected
          ? 'border-2 border-amber-400 bg-amber-500/5 ring-2 ring-amber-400/30'
          : 'border bg-zinc-900/70 border-zinc-800/80 hover:border-amber-500/30 hover:-translate-y-0.5'
      } ${style.ring} ${option.status === 'RECOMMENDED' ? 'md:-top-1 md:hover:-top-1.5' : ''}`}
    >
      {option.status === 'RECOMMENDED' && (
        <div className="fr-sweep absolute -top-2.5 left-4 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-950 shadow-md shadow-amber-500/30">
          <Trophy className="h-3 w-3" /> {t('recovery.recommended')}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md font-mono text-sm font-extrabold ${
              option.status === 'RECOMMENDED'
                ? 'bg-amber-400/15 text-amber-300'
                : option.status === 'ALTERNATIVE'
                  ? 'bg-sky-500/10 text-sky-400'
                  : 'bg-zinc-700/40 text-zinc-300'
            }`}
          >
            {option.label}
          </span>
          <span className="text-[12px] font-semibold text-zinc-200">{option.candidate.label}</span>
        </div>
        <Badge className={`shrink-0 text-[11px] font-bold ${style.badge}`}>{option.status}</Badge>
      </div>

      {/* Routing */}
      <div className="mt-3 space-y-1">
        {option.candidate.legs.map((leg) => (
          <div key={leg.flightNumber} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-zinc-400">
            <span className="font-bold text-zinc-300">{leg.flightNumber}</span>
            <span>
              {leg.from} {fmtLocalTime(leg.depIso).time} <ArrowRight className="inline h-3 w-3 text-zinc-400" />{' '}
              {leg.to} {fmtLocalTime(leg.arrIso).time}
              {fmtLocalTime(leg.arrIso).nextDay && <sup className="text-amber-400">+1</sup>}
            </span>
            <span className="text-[11px] text-zinc-500">({toLocalTime(leg.depIso)} your time)</span>
          </div>
        ))}
      </div>

      {/* Big arrival */}
      <div className="mt-3 flex items-end justify-between gap-2 border-t border-zinc-800/70 pt-3">
        <div>
          <div className="font-mono text-xl font-bold tabular-nums text-zinc-100">
            {arr.time}
            {arr.nextDay && <sup className="ml-0.5 text-[10px] text-amber-400">+1d</sup>}
          </div>
          <div className="text-[10px] text-zinc-500">arrives NRT · dep {dep.time} SIN</div>
          <div className="text-[11px] text-zinc-500">({toLocalTime(option.candidate.arrIso)} your time)</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold tabular-nums text-amber-300">
            {option.recoveryScore}
            <span className="text-sm font-semibold text-amber-300/60">/100</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-zinc-500" title="Recovery score: how well this option restores your original trip plan (0-100)">recovery score</span>
            <span className={`font-semibold ${scoreLabel(option.recoveryScore).className}`}>
              · {scoreLabel(option.recoveryScore).text}
            </span>
          </div>
        </div>
      </div>

      {/* Metric chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip icon={Clock} tone={option.metrics.delayHours <= 4 ? 'good' : option.metrics.delayHours <= 8 ? 'warn' : 'bad'}>
          +{option.metrics.delayHours}h delay
        </Chip>
        <Chip
          icon={Banknote}
          tone={option.metrics.fareDiffUsd <= 60 ? 'good' : option.metrics.fareDiffUsd <= 120 ? 'warn' : 'bad'}
          title="Fare difference from original booking"
        >
          {option.metrics.fareDiffUsd > 0 ? `+$${option.metrics.fareDiffUsd} USD` : '$0 USD'} fare
        </Chip>
        <Chip icon={Timer} tone="neutral">
          {option.metrics.connectionMin === null ? 'nonstop' : `${fmtMinutes(option.metrics.connectionMin)} layover`}
        </Chip>
        <Chip icon={Luggage} tone="neutral">
          {option.candidate.baggagePieces}×{option.candidate.baggageWeightKg}kg
        </Chip>
        <Chip icon={Briefcase} tone={option.metrics.makesMeeting ? 'good' : 'bad'}>
          {option.metrics.makesMeeting ? 'meeting protected' : 'meeting missed'}
        </Chip>
        <Chip icon={Plane} tone={option.residualRisk <= 25 ? 'good' : option.residualRisk <= 50 ? 'warn' : 'bad'}>
          {t('recovery.remaining_risk', { risk: option.residualRisk })}
        </Chip>
        {option.candidate.metadata?.priceStatus === 'reference' && (
          <Chip icon={Banknote} tone="warn" title="Reference price — flight search and comparison only">
            reference fare
          </Chip>
        )}
      </div>

      {/* Score breakdown */}
      <div className="mt-3 space-y-1.5 border-t border-zinc-800/70 pt-3">
        <ScoreBar label="Arrival" value={option.scores.arrival} weight={RECOVERY_WEIGHTS.arrival} />
        <ScoreBar label="Connect" value={option.scores.connection} weight={RECOVERY_WEIGHTS.connection} />
        <ScoreBar label="Price" value={option.scores.price} weight={RECOVERY_WEIGHTS.price} />
        <ScoreBar label="Baggage" value={option.scores.baggage} weight={RECOVERY_WEIGHTS.baggage} />
        <ScoreBar label="Risk" value={option.scores.risk} weight={RECOVERY_WEIGHTS.risk} />
      </div>

      {/* Reason */}
      <div className="mt-3 flex items-start gap-1.5 border-t border-zinc-800/70 pt-3 text-[11px] leading-snug text-zinc-400">
        {option.status === 'ALTERNATIVE' ? (
          <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
        ) : (
          <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        )}
        {option.reason}
      </div>

      {/* selection indicator */}
      <div
        className={`mt-3 flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
          selected
            ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
            : 'border-zinc-800 text-zinc-500 group-hover:text-zinc-400'
        }`}
      >
        {selected ? `✓ ${t('recovery.selected')}` : t('recovery.select')}
      </div>
    </motion.button>
  );
}

function Chip({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    bad: 'border-red-500/30 bg-red-500/10 text-red-400',
    neutral: 'border-zinc-700/70 bg-zinc-800/50 text-zinc-400',
  } as const;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${tones[tone]}`}
    >
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}

export const RecoveryOptions = forwardRef<RecoveryOptionsHandle, Props>(
function RecoveryOptions({ options, state, providerMode, selectedId, onSelect, onApprove, approveBusy, onSwitchToDemo }, ref) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const live = providerMode === 'ATLAS_SANDBOX';

  useImperativeHandle(ref, () => ({
    openConfirm: () => {
      if (state === 'AWAITING_APPROVAL' && !approveBusy) setConfirmOpen(true);
    },
  }), [state, approveBusy]);
  if (!options) {
    return (
      <section aria-label="Recovery options unavailable" className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 backdrop-blur-sm">
        <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center">
          <Plane className="h-8 w-8 text-zinc-500" />
          <p className="max-w-[320px] text-xs leading-relaxed text-zinc-400">
            Your recovery options (A / B / C, each with a clear score) appear here once the search
            finishes.
          </p>
        </div>
      </section>
    );
  }

  const canApprove = state === 'AWAITING_APPROVAL';

  return (
    <section aria-labelledby="recovery-options-heading" className="space-y-4">
      <h2 id="recovery-options-heading" className="sr-only">{t('recovery.title')}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {options.map((o, i) => (
          <OptionCard
            key={o.id}
            option={o}
            index={i}
            selected={selectedId === o.id}
            onSelect={() => onSelect(o.id)}
          />
        ))}
      </div>

      {/* Approval gate — Priority 5: central interaction */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.06] via-zinc-900/60 to-zinc-900/60 p-5"
      >
        {canApprove && (() => {
          const selectedOption = options.find((o) => o.id === selectedId);
          const isReferenceOffer = Boolean(
            selectedOption?.candidate.metadata?.priceStatus === 'reference' ||
            selectedOption?.candidate.metadata?.bookable === false
          );
          const ticketingBlocker = selectedOption?.candidate.metadata?.ticketingBlocker;

          if (live && isReferenceOffer) {
            return (
              <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-4 text-left">
                <div className="flex items-start gap-3">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
                        Live Sandbox Notice — Reference Inventory
                      </span>
                      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-amber-300">
                        Price Compare Only
                      </span>
                    </div>
                    <p className="text-[11.5px] text-zinc-300 leading-relaxed">
                      Option {selectedOption?.label} is real-time comparison inventory from the Atlas sandbox.
                      Direct automated ticketing is locked until ATRIP ticketing activation is completed.
                    </p>
                    {ticketingBlocker && (
                      <div className="font-mono text-[10.5px] text-amber-200">
                        Blocker: {ticketingBlocker}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {onSwitchToDemo && (
                        <Button
                          size="sm"
                          onClick={onSwitchToDemo}
                          className="h-8 gap-1.5 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 px-3 text-xs font-bold text-neutral-950 shadow-md shadow-amber-500/20 hover:brightness-105"
                        >
                          <Zap className="h-3 w-3 fill-current" />
                          ⚡ Switch to Demo Mode &amp; Simulate Recovery
                        </Button>
                      )}
                      <a
                        href="https://resources.atriptech.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
                      >
                        <ExternalLink className="h-3 w-3" />
                        ↗ Open ATRIP Workspace
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {canApprove && (() => {
          const rec = options.find((o) => o.id === selectedId);
          if (!rec?.why) return null;
          return (
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
                  Recommended Recovery — Option {rec.label}
                </span>
                <span className="ml-auto flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                  {t('recovery.score', { score: rec.recoveryScore })}
                  <span className={`font-semibold ${scoreLabel(rec.recoveryScore).className}`}>
                    · {scoreLabel(rec.recoveryScore).text}
                  </span>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
                {rec.why.whyRecommended.slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                    <span className="text-[11px] text-zinc-300">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2 text-[13px] font-bold text-zinc-100">
              <Lock className="h-4 w-4 text-amber-400" />
              Human Approval Gate
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">
              {canApprove
                ? `Nothing gets booked without you. One tap confirms Option ${options.find((o) => o.id === selectedId)?.label ?? '—'}.`
                : state === 'RECOVERED'
                  ? 'Recovery already booked — reset the demo to run again.'
                  : 'Available once your options are ready for your approval.'}
            </p>
            {canApprove && (
              <div className="mt-2 flex items-center gap-1.5 rounded border border-zinc-700/60 bg-zinc-900/50 px-2 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-mono text-[10px] font-semibold text-amber-300">
                  {t('recovery.approval_waiting')}
                </span>
              </div>
            )}
          </div>
          <Button
            size="lg"
            onClick={() => setConfirmOpen(true)}
            disabled={!canApprove || approveBusy}
            className="relative h-12 w-full gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-8 text-sm font-extrabold text-neutral-950 shadow-lg shadow-amber-500/30 transition-all hover:shadow-xl hover:shadow-amber-500/45 hover:brightness-105 active:scale-[0.98] focus-visible:ring-amber-300/70 sm:w-auto disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-400 disabled:shadow-none fr-sweep"
          >
            {approveBusy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950/40 border-t-neutral-950" />
                {t('recovery.confirming')}
              </>
            ) : (
              <>
                <Trophy className="h-4 w-4" />
                {t('recovery.confirm')}
              </>
            )}
          </Button>
        </div>

        {/* Confirmation dialog before execution */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="border-border bg-background text-foreground">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex flex-wrap items-center gap-2 text-amber-300">
                <Trophy className="h-5 w-5" />
                {t('confirm_dialog.title')}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                    live
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
                  {live ? t('app.live_mode') : t('app.demo_mode')}
                </span>
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-zinc-300">
                  {(() => {
                    const opt = options.find((o) => o.id === selectedId);
                    if (!opt) return <p>No option selected.</p>;
                    const route = opt.candidate.legs
                      .map((l) => `${l.flightNumber} ${l.from}→${l.to}`)
                      .join(' · ');
                    const dep = fmtLocalTime(opt.candidate.depIso);
                    const arr = fmtLocalTime(opt.candidate.arrIso);
                    return (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/15 font-mono text-xs font-extrabold text-amber-300">
                              {opt.label}
                            </span>
                            <span className="text-sm font-semibold text-zinc-100">{opt.candidate.label}</span>
                            <Badge className={`ml-auto text-[11px] font-bold ${STATUS_STYLE[opt.status].badge}`}>
                              {opt.status}
                            </Badge>
                          </div>
                          <div className="mt-2 font-mono text-xs text-zinc-400">{route}</div>
                          <div className="mt-1 flex items-center gap-3 font-mono text-xs text-zinc-400">
                            <span>Dep {dep.time}</span>
                            <ArrowRight className="h-3 w-3 text-zinc-400" />
                            <span>Arr {arr.time}{arr.nextDay && <sup className="text-amber-400">+1d</sup>}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-500">
                            ({toLocalTime(opt.candidate.depIso)} → {toLocalTime(opt.candidate.arrIso)} your time)
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-amber-300">
                              {opt.recoveryScore}
                              <span className="text-[11px] font-semibold text-amber-300/60">/100</span>
                            </span>
                            <span className="text-xs text-zinc-500">recovery score</span>
                            <span className={`text-xs font-semibold ${scoreLabel(opt.recoveryScore).className}`}>
                              · {scoreLabel(opt.recoveryScore).text}
                            </span>
                          </div>
                        </div>
                        {live ? (
                          opt.candidate.metadata?.priceStatus === 'reference' || opt.candidate.metadata?.bookable === false ? (
                            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-left">
                              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                              <div className="space-y-1">
                                <p className="text-[12px] leading-relaxed text-zinc-300">
                                  <span className="font-bold text-amber-300">Reference Inventory Notice:</span>{' '}
                                  Option {opt.label} is real-time comparison inventory. Live booking in the sandbox requires ticketing activation.
                                </p>
                                {onSwitchToDemo && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmOpen(false);
                                      onSwitchToDemo();
                                    }}
                                    className="text-[11px] font-bold text-amber-400 underline hover:text-amber-300"
                                  >
                                    ⚡ Switch to Demo Mode &amp; Simulate Recovery instead
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2">
                              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                              <p className="text-[12px] leading-relaxed text-zinc-300">
                                <span className="font-bold text-emerald-300">Live mode:</span>{' '}
                                {t('confirm_dialog.live_warning')} We will rebook you on Option {opt.label} and
                                mark your trip as <span className="font-bold text-zinc-100">recovered</span>.
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/[0.04] px-3 py-2">
                            <span className="mt-0.5 text-amber-400">⚠</span>
                            <p className="text-[12px] leading-relaxed text-zinc-300">
                              {t('confirm_dialog.warning')} We will rebook you on Option {opt.label} and
                              mark your trip as <span className="font-bold text-zinc-100">recovered</span>.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">
                {t('confirm_dialog.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onApprove}
                className="bg-gradient-to-r from-amber-400 to-orange-500 font-extrabold text-neutral-950 hover:brightness-105"
              >
                <Trophy className="mr-1.5 h-4 w-4" />
                {t('confirm_dialog.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </section>
  );
});
