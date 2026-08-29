'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { AlertTriangle, BadgeCheck, ChevronDown, ChevronRight, ExternalLink, Keyboard, ListChecks, MailWarning, Plane, Plug, RotateCcw, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFlightResist } from '@/hooks/use-flightresist';
import { AgentStream } from '@/components/flightresist/agent-stream';
import { DecisionFunnel } from '@/components/flightresist/decision-funnel';
import { DemoChecklist } from '@/components/flightresist/demo-checklist';
import { DisruptionPanel } from '@/components/flightresist/disruption-panel';
import { ExecutionModal } from '@/components/flightresist/execution-modal';
import { HeaderBar } from '@/components/flightresist/header-bar';
import { HowItWorks } from '@/components/flightresist/how-it-works';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ImpactGraphView } from '@/components/flightresist/impact-graph-view';
import { LedgerTable } from '@/components/flightresist/ledger-table';
import { LlmPanel } from '@/components/flightresist/llm-panel';
import { OptionRadar } from '@/components/flightresist/option-radar';
import { OptionComparison } from '@/components/flightresist/option-comparison';
import { ItineraryStudioModal } from '@/components/flightresist/itinerary-studio-modal';
import { PrintSummary } from '@/components/flightresist/print-summary';
import { RecoveryOptions, type RecoveryOptionsHandle } from '@/components/flightresist/recovery-options';
import { SiteFooter } from '@/components/flightresist/site-footer';
import { StateStepper } from '@/components/flightresist/state-stepper';
import { TripOverview } from '@/components/flightresist/trip-overview';
import type { ExecutionResult, Itinerary, TripImpactGraph, TripState } from '@/lib/flightresist/types';
import { t } from '@/lib/i18n';

export function FlightResistCockpit() {
  const { trip, events, sse, busy, connectionWarning, triggerDisruption, confirmRecovery, resetSession, refresh } = useFlightResist();
  const { data: session, status: sessionStatus, update } = useSession();
  // Single normalized source of truth for email verification — the banner,
  // dashboard chip and any other indicator all gate on this one boolean.
  const emailVerified = session?.user?.emailVerified === true;
  const { toast } = useToast();
  const shouldReduceMotion = useReducedMotion();

  const handleInstantVerify = async () => {
    try {
      const res = await fetch('/api/auth/verify-email', { method: 'POST' });
      if (res.ok) {
        if (update) await update();
        toast({ title: 'Email Verified', description: 'Your account is now verified.' });
        setVerifyBannerDismissed(true);
      }
    } catch {
      toast({ title: 'Verification Error', description: 'Could not verify email.', variant: 'destructive' });
    }
  };

  const [selection, setSelection] = useState<{ key: string; id: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [modalStartSeq, setModalStartSeq] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  // Post-login dashboard strip: Atlas connection chip + dismissible
  // verify-email banner (local dismissal only — reappears next visit).
  const [atlasAvailable, setAtlasAvailable] = useState<boolean | null>(null);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Probe Atlas availability once signed in — powers the dashboard strip chip.
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    let cancelled = false;
    fetch('/api/atlas/status', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return { available: false };
        return (await res.json()) as { available: boolean };
      })
      .then((data) => {
        if (!cancelled) setAtlasAvailable(Boolean(data.available));
      })
      .catch(() => {
        if (!cancelled) setAtlasAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStatus]);
  const optionsAnchorRef = useRef<HTMLDivElement>(null);
  const recoveryOptionsRef = useRef<RecoveryOptionsHandle>(null);
  const lastAutoScrollKey = useRef<string | null>(null);
  const prevStateRef = useRef<TripState | null>(null);
  const shortcutsDialogRef = useRef<HTMLDivElement>(null);
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const [showTop, setShowTop] = useState(false);

  // --- Pipeline timeout detection for ANALYZING state ---
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisTimer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  // toast bridge from the data hook
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ title: string; description?: string }>).detail;
      toast({ title: detail.title, description: detail.description });
    };
    window.addEventListener('fr-toast', handler);
    return () => window.removeEventListener('fr-toast', handler);
  }, [toast]);

  // Demo narrator assist: when a fresh analysis reaches the approval gate,
  // smooth-scroll the recovery options into view (once per analysis, respects
  // reduced-motion, never fights an open modal).
  useEffect(() => {
    if (shouldReduceMotion) return;
    if (trip?.state !== 'AWAITING_APPROVAL' || !trip.analysis || modalOpen) return;
    const key = trip.analysis.analyzedAtIso;
    if (lastAutoScrollKey.current === key) return;
    lastAutoScrollKey.current = key;
    const anchor = optionsAnchorRef.current;
    if (!anchor) return;
    window.setTimeout(() => {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 450);
  }, [trip?.state, trip?.analysis, modalOpen, shouldReduceMotion]);

  // --- Ambient attention layer ---------------------------------------------
  // The browser tab itself becomes a passive status line: dynamic title,
  // background notifications, and a subtle chime at the approval gate.

  // --- Pipeline timeout detection: warn if ANALYZING hangs ---
  useEffect(() => {
    if (trip?.state !== 'ANALYZING') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the warning must clear synchronously the moment the pipeline leaves ANALYZING, alongside the timer cleanup below.
      setAnalysisWarning(null);
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      if (analysisTimer2Ref.current) clearTimeout(analysisTimer2Ref.current);
      return;
    }

    // 60s: gentle nudge
    analysisTimerRef.current = setTimeout(() => {
      setAnalysisWarning(t('error.analysis_slow'));
    }, 60_000);

    // 120s: suggest reset
    analysisTimer2Ref.current = setTimeout(() => {
      setAnalysisWarning(t('error.analysis_stuck'));
    }, 120_000);

    return () => {
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      if (analysisTimer2Ref.current) clearTimeout(analysisTimer2Ref.current);
    };
  }, [trip?.state]);

  // Dynamic tab title — mirrors the trip state machine in document.title.
  useEffect(() => {
    const titles: Record<string, string> = {
      NORMAL: t('app.title'),
      DISRUPTION_DETECTED: `⚠ ${t('state.disruption_detected')} — ${t('app.title')}`,
      ANALYZING: `⏳ ${t('state.analyzing')} — ${t('app.title')}`,
      RECOVERY_OPTIONS_READY: `✓ ${t('state.options_ready')} — ${t('app.title')}`,
      AWAITING_APPROVAL: `🔔 ${t('state.awaiting_approval')} — ${t('app.title')}`,
      EXECUTING: `✈ ${t('state.executing')}... — ${t('app.title')}`,
      RECOVERED: `✓ ${t('state.recovered')} — ${t('app.title')}`,
      FAILED: `❌ ${t('state.failed')} — ${t('app.title')}`,
    };
    document.title = titles[trip?.state ?? ''] ?? t('app.title');
  }, [trip?.state]);

  // Subtle two-tone chime (Web Audio, no audio file) for the approval gate.
  const playChime = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playTone(587, 0, 0.15); // D5
      playTone(880, 0.12, 0.2); // A5
      // Release the AudioContext once the chime has finished.
      window.setTimeout(() => void ctx.close().catch(() => {}), 500);
    } catch {
      /* Audio not available */
    }
  }, []);

  // Request notification permission on the first user interaction (once).
  useEffect(() => {
    const requestPermission = () => {
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
      document.removeEventListener('click', requestPermission);
    };
    document.addEventListener('click', requestPermission);
    return () => document.removeEventListener('click', requestPermission);
  }, []);

  // Meaningful state transitions: chime when options land, desktop
  // notification when they land while the tab is hidden.
  useEffect(() => {
    const state = trip?.state ?? null;
    if (prevStateRef.current === state) return;
    const prevState = prevStateRef.current;
    prevStateRef.current = state;

    // Subtle chime — once per transition into the approval gate.
    if (state === 'AWAITING_APPROVAL' && prevState !== null && prevState !== 'AWAITING_APPROVAL') {
      playChime();
    }

    // Notifications only matter while the tab is in the background.
    if (state === null || document.visibilityState === 'visible') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notifications: Record<string, { title: string; body: string } | undefined> = {
      AWAITING_APPROVAL: {
        title: `✓ ${t('notifications.options_ready_title')}`,
        body: t('notifications.options_ready_body'),
      },
      RECOVERED: {
        title: `✈ ${t('notifications.recovered_title')}`,
        body: t('notifications.recovered_body'),
      },
      FAILED: {
        title: `❌ ${t('notifications.failed_title')}`,
        body: t('notifications.failed_body'),
      },
    };

    const notif = notifications[state];
    if (notif) {
      const n = new Notification(notif.title, { body: notif.body, icon: '/favicon.svg' });
      n.onclick = () => window.focus();
    }
  }, [trip?.state, playChime]);

  const analysisKey = trip?.analysis?.analyzedAtIso ?? null;
  // Derived selection: defaults to the engine's recommendation for each new analysis.
  const selectedOptionId =
    analysisKey && trip?.analysis
      ? selection && selection.key === analysisKey
        ? selection.id
        : trip.analysis.recommendedId
      : null;

  const handleApprove = useCallback(async () => {
    if (!selectedOptionId) return;
    setExecResult(null);
    setModalStartSeq(events.at(-1)?.seq ?? 0);
    setModalOpen(true);
    setExecuting(true);
    const result = await confirmRecovery(selectedOptionId);
    setExecResult(result);
    setExecuting(false);
    if (result && result.status !== 'FAILED') {
      toast({
        title: t('recovery.booked_title', {
          reference: result.demoReference ?? result.pnr ?? result.orderId ?? '—',
        }),
        description: t('recovery.booked_body', {
          seconds: (result.executionTimeMs / 1000).toFixed(2),
          mode: result.providerMode === 'DEMO' ? 'demo' : 'live',
        }),
      });
    }
  }, [selectedOptionId, confirmRecovery, toast, events]);

  const handleTrigger = useCallback(
    async (scenario: 'cancellation' | 'delay', delayMinutes?: number) => {
      const ok = await triggerDisruption(scenario, delayMinutes);
      if (ok) {
        toast({
          title:
            scenario === 'delay'
              ? t('notifications.delay_detected', { minutes: delayMinutes ?? 45 })
              : t('notifications.disruption_detected'),
          description: t('notifications.trigger_description'),
        });
      }
    },
    [triggerDisruption, toast],
  );

  const handleReset = useCallback(async () => {
    await resetSession();
    setExecResult(null);
    setModalOpen(false);
    setSelection(null);
  }, [resetSession]);

  const handleSwitchToDemoAndSimulate = useCallback(async () => {
    try {
      await fetch('/api/user/mode', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'DEMO' }),
      });
      await resetSession();
      setModalOpen(false);
      setExecResult(null);
      setSelection(null);
      await triggerDisruption('cancellation');
      toast({
        title: 'Switched to Demo Mode',
        description: 'Executing deterministic demo recovery simulation (42 candidates, 3 finalists).',
      });
      refresh();
    } catch (err) {
      console.error('Failed to switch to demo mode', err);
      toast({
        title: 'Mode switch failed',
        description: 'Unable to switch to Demo Mode.',
        variant: 'destructive',
      });
    }
  }, [resetSession, triggerDisruption, toast, refresh]);

  const handleSwitchToDemo = useCallback(async () => {
    try {
      await fetch('/api/user/mode', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'DEMO' }),
      });
      setWarningDismissed(true);
      toast({
        title: 'Switched to Simulation Mode',
        description: 'Switched to deterministic simulation mode.',
      });
      refresh();
    } catch (err) {
      console.error('Failed to switch to demo mode', err);
      toast({
        title: 'Mode switch failed',
        description: 'Unable to switch to Simulation Mode.',
        variant: 'destructive',
      });
    }
  }, [toast, refresh]);

  const handleSelectPreset = useCallback(async (presetId: string) => {
    const res = await fetch('/api/trip/preset', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await refresh();
  }, [refresh]);

  const handleApplyCustomItinerary = useCallback(async (customItinerary: Itinerary) => {
    const res = await fetch('/api/trip/custom', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itinerary: customItinerary }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await refresh();
  }, [refresh]);

  // CSV export of the persisted ledger + agent trace (judge evidence).
  const handleExportCsv = useCallback(() => {
    if (!trip) return;
    const esc = (v: unknown) => {
      let s = String(v ?? '');
      // Prevent CSV formula injection
      if (/^[=+\-@\t\r]/.test(s)) {
        s = "'" + s;
      }
      s = s.replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const rows: string[] = [];
    rows.push('# FlightResist AI 2.0 run evidence');
    rows.push(`# exported_at,${esc(new Date().toISOString())}`);
    rows.push(`# trip_id,${esc(trip.trip_id)},state,${esc(trip.state)},risk,${trip.risk_score},provider,${esc(trip.provider_mode)}`);
    rows.push('');
    rows.push('## Execution ledger');
    rows.push('id,option,status,reference,execution_ms,created_at');
    for (const e of trip.ledger) {
      rows.push([e.id, e.proposalId, e.status, e.reference ?? '', e.executionTimeMs, e.createdAtIso].map(esc).join(','));
    }
    rows.push('');
    rows.push('## Agent event trace');
    rows.push('seq,phase,step,title,level,duration_ms,timestamp');
    for (const e of events) {
      rows.push([e.seq, e.phase, e.step, e.title, e.level, e.durationMs, e.timestamp].map(esc).join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flightresist-evidence-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: t('actions.export_evidence_title'), description: t('actions.export_evidence_body') });
  }, [trip, events, toast]);

  // Jump-to-Approval: show floating button when recovery-options is out of view
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the button must hide synchronously when the trip leaves the approval gate, before the observer is (re)attached.
    if (!trip || trip.state !== 'AWAITING_APPROVAL') { setShowJumpBtn(false); return; }
    const el = document.getElementById('recovery-options');
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowJumpBtn(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [trip?.state]);

  // Back-to-top: show after scrolling 500px
  useEffect(() => {
    const handleScroll = () => setShowTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Focus trap for keyboard shortcuts overlay
  useEffect(() => {
    if (!helpOpen) return;
    const dialog = shortcutsDialogRef.current;
    if (!dialog) return;

    const focusableEls = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];

    firstEl?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [helpOpen]);

  // Presenter keyboard shortcuts — live-demo reliability (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.closest('[role="log"]') ||
        target.closest('[aria-live]') ||
        target.closest('[role="dialog"]')
      ) return;
      const k = e.key.toLowerCase();
      if (k === 'd' && trip?.state === 'NORMAL' && !busy.trigger) {
        e.preventDefault();
        void handleTrigger('cancellation');
      } else if (k === 'e' && trip?.state === 'NORMAL' && !busy.trigger) {
        e.preventDefault();
        void handleTrigger('delay');
      } else if (k === 'a' && trip?.state === 'AWAITING_APPROVAL' && !busy.confirm && !executing) {
        e.preventDefault();
        recoveryOptionsRef.current?.openConfirm();
      } else if (k === 'r' && trip?.state !== 'NORMAL' && !busy.reset) {
        e.preventDefault();
        void handleReset();
      } else if (k === 'p') {
        e.preventDefault();
        window.print();
      } else if (k === 'm') {
        e.preventDefault();
        setStudioOpen((o) => !o);
      } else if (k === '?') {
        e.preventDefault();
        setHelpOpen((o) => !o);
      } else if (k === 'c') {
        e.preventDefault();
        setChecklistOpen((o) => !o);
      } else if (k === 'escape') {
        setHelpOpen(false);
        setChecklistOpen(false);
        setStudioOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trip?.state, busy, executing, handleTrigger, handleApprove, handleReset]);

  if (!trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        >
          <Plane className="h-10 w-10 text-amber-400" />
        </motion.div>
        <div className="text-center">
          <div className="text-sm font-bold">FLIGHTRESIST AI 2.0</div>
          <div className="mt-1 font-mono text-[11px] text-zinc-500">{t('app.loading')}</div>
        </div>
      </div>
    );
  }

  const analysis = trip.analysis;
  const recovered = trip.state === 'RECOVERED';
  const executedOption = recovered && trip.execution ? analysis?.options.find((o) => o.id === trip.execution?.proposalId) ?? null : null;

  const displayGraph: TripImpactGraph | null = executedOption
    ? executedOption.residualGraph
    : analysis?.impactGraph ?? null;

  const selectedOption = analysis?.options.find((o) => o.id === selectedOptionId) ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Pipeline analysis timeout warning */}
      {analysisWarning && (
        <div className="mx-auto max-w-5xl px-4 py-2">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-center gap-2">
            <span>⏳</span>
            <span>{analysisWarning}</span>
            {analysisWarning === t('error.analysis_stuck') && (
              <button
                onClick={() => void resetSession()}
                className="ml-auto underline text-amber-400 hover:text-amber-300"
              >
                {t('actions.reset')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Connection warning banner */}
      {connectionWarning && !warningDismissed && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-950/95 border-b border-amber-500/50 px-4 py-2 text-center text-xs text-amber-100 font-medium backdrop-blur-md flex flex-wrap items-center justify-center gap-3 shadow-lg shadow-black/60">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="max-w-3xl truncate">{connectionWarning}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleSwitchToDemo()}
              className="rounded bg-amber-400 hover:bg-amber-300 text-zinc-950 px-2.5 py-0.5 text-xs font-bold transition-all shadow-sm flex items-center gap-1"
            >
              <Zap className="h-3 w-3 fill-current" /> Switch to Simulation Mode
            </button>
            <button
              onClick={() => setWarningDismissed(true)}
              className="text-amber-300/80 hover:text-white p-0.5 rounded hover:bg-amber-900/50"
              aria-label="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ambient backdrop — canopy glow, fading engineering grid, vignette */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-clip print:hidden">
        <div className="absolute -top-40 left-1/2 h-[30rem] w-[54rem] -translate-x-1/2 rounded-full bg-amber-500/[0.05] blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-[26rem] w-[26rem] rounded-full bg-orange-600/[0.045] blur-3xl" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(0,0,0,0.032)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.032)_1px,transparent_1px)] dark:[background-image:linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_80%_62%_at_50%_0%,black_25%,transparent_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.08)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(0,0,0,0.42)_100%)]" />
      </div>

      {/* Interactive console — hidden when printing (the print summary replaces it) */}
      <div className="relative z-10 flex min-h-screen flex-col print:hidden">
        <HeaderBar
          trip={trip}
          sseConnected={sse.connected}
          onReset={() => void handleReset()}
          resetBusy={busy.reset}
          onExportCsv={handleExportCsv}
          onHelp={() => setHelpOpen((o) => !o)}
          onModeChanged={refresh}
          onOpenStudio={() => setStudioOpen(true)}
        />

        {/* Unverified email banner — slim, dismissible, signed-in only */}
        {sessionStatus === 'authenticated' && !emailVerified && !verifyBannerDismissed && (
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
            <div
              role="status"
              className="flex flex-wrap items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-[12.5px] text-amber-200"
            >
              <MailWarning className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{t('banner.verify_email')}</span>
              <button
                type="button"
                onClick={handleInstantVerify}
                className="rounded border border-amber-400/50 bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-400/35"
              >
                Verify Instantly
              </button>
              <button
                type="button"
                onClick={() => setVerifyBannerDismissed(true)}
                aria-label="Dismiss verification reminder"
                className="ml-auto rounded p-1 text-amber-300/70 transition-colors hover:bg-amber-500/10 hover:text-amber-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-5 sm:px-6">
          {/* Post-login dashboard strip — mode, account and Atlas at a glance */}
          {sessionStatus === 'authenticated' && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5 backdrop-blur-sm">
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-mono text-lg font-extrabold leading-none tracking-widest ${
                    trip.provider_mode !== 'DEMO' ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {trip.provider_mode !== 'DEMO' ? 'LIVE' : 'DEMO'}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  {trip.provider_mode !== 'DEMO' ? 'Live mode' : 'Demo mode'}
                </span>
              </div>
              <span className="hidden h-5 w-px bg-zinc-800 sm:block" />
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                  emailVerified
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                {emailVerified ? 'Email verified' : 'Email not verified'}
              </span>
              <span className="hidden h-5 w-px bg-zinc-800 sm:block" />
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] ${
                  atlasAvailable === null
                    ? 'border-zinc-700 bg-zinc-800/50 text-zinc-400'
                    : atlasAvailable
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-800/50 text-zinc-500'
                }`}
                title="Atlas CLI availability for Live mode (/api/atlas/status)"
              >
                <Plug className="h-3 w-3" />
                {atlasAvailable === null ? 'Atlas: checking…' : atlasAvailable ? 'Atlas Connected' : 'Atlas Not available'}
              </span>
            </div>
          )}

          {/* First-load entrance choreography: primary flow panels rise in fast,
              staggered — total under 0.7s so the live demo never waits. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4, ease: 'easeOut' }}
          >
            <StateStepper state={trip.state} failed={trip.state === 'FAILED'} />
          </motion.div>

          {/* Failed State Diagnostic Banner (Milestone 4 R4) */}
          <AnimatePresence initial={false}>
            {trip.state === 'FAILED' && (
              <motion.div
                key="failed-banner"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="rounded-xl border border-red-500/40 bg-gradient-to-r from-red-500/[0.08] via-zinc-950/60 to-zinc-950/60 p-4 backdrop-blur-sm shadow-lg shadow-red-950/20"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-red-400">
                          Recovery Execution Blocked / Failed
                        </span>
                        <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-300">
                          {trip.provider_mode}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-300 leading-relaxed max-w-2xl">
                        {trip.execution?.error ||
                          'Live sandbox recovery encountered unbookable reference inventory or payment check. Use the 1-click fallback below to simulate recovery in Demo Mode, or manage your account in the ATRIP workspace.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => void handleSwitchToDemoAndSimulate()}
                      className="h-8 gap-1.5 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 px-3 text-xs font-extrabold text-neutral-950 shadow-md shadow-amber-500/20 hover:brightness-105"
                    >
                      <Zap className="h-3 w-3 fill-current" />
                      ⚡ Switch to Demo Mode &amp; Simulate Recovery
                    </Button>
                    <a
                      href="https://resources.atriptech.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
                    >
                      <ExternalLink className="h-3 w-3" />
                      ↗ Open ATRIP Workspace
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleReset()}
                      className="h-8 gap-1.5 border-zinc-700 bg-zinc-800/80 text-xs text-zinc-300 hover:bg-zinc-700"
                    >
                      <RotateCcw className="h-3 w-3" />
                      ↺ Reset Session
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mission banner — first-20-second context for judges (Priority 1) */}
          <AnimatePresence initial={false}>
            {!recovered && trip.state === 'NORMAL' && (
              <motion.div
                key="mission-banner"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="rounded-xl border border-zinc-800/60 bg-gradient-to-r from-amber-500/[0.05] via-zinc-950/40 to-zinc-950/40 px-5 py-4 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                    Trip Recovery Intelligence
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-zinc-400">
                  When travel disruption occurs, FlightResist identifies what broke, traces what it affects,
                  evaluates recovery options against hard constraints, and recommends the option that best{' '}
                  <span className="font-semibold text-zinc-200">preserves the journey</span>.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> exact math, no AI guesses
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> you approve every booking
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" /> AI explains in plain English
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[10.5px] text-zinc-400">
                  <ChevronRight className="h-3 w-3 text-amber-400/60" />
                  <span>
                    Trigger a disruption below — or press{' '}
                    <kbd className="rounded border border-zinc-700 bg-zinc-800/60 px-1 py-px font-mono text-[11px] text-amber-300">D</kbd>{' '}
                    to simulate a cancellation
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Row: itinerary + disruption/risk */}
          <motion.div
            id="trip-overview"
            className="grid grid-cols-1 gap-4 lg:grid-cols-12"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45, ease: 'easeOut' }}
          >
            <div className="lg:col-span-7">
              <TripOverview
                itinerary={trip.itinerary}
                disruption={trip.disruption}
                recoveredLegs={executedOption?.candidate.legs ?? null}
                recoveredLabel={executedOption ? `Option ${executedOption.label} — ${executedOption.candidate.label}` : null}
                recoveredArrivalIso={executedOption?.candidate.arrIso ?? null}
                onOpenStudio={() => setStudioOpen(true)}
              />
            </div>
            <div id="disruption-panel" className="lg:col-span-5">
              <DisruptionPanel
                state={trip.state}
                riskScore={trip.risk_score}
                disruption={trip.disruption}
                recovered={recovered}
                onTrigger={(s, m) => void handleTrigger(s, m)}
                triggerBusy={busy.trigger}
                providerMode={trip.provider_mode}
              />
            </div>
          </motion.div>

          {/* Row: impact graph + agent stream */}
          <motion.div
            className="grid grid-cols-1 gap-4 lg:grid-cols-12"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.19, duration: 0.45, ease: 'easeOut' }}
          >
            <div id="impact-graph" className="lg:col-span-5">
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Impact Graph</span>
                  <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ImpactGraphView graph={displayGraph} residualMode={Boolean(executedOption)} />
                </CollapsibleContent>
              </Collapsible>
            </div>
            <div id="agent-stream" className="flex flex-col lg:col-span-7">
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Agent Stream</span>
                  <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <AgentStream events={events} state={trip.state} live={sse.connected} />
                </CollapsibleContent>
              </Collapsible>
            </div>
          </motion.div>

          {/* Funnel — below the fold: reveals on scroll */}
          <motion.div
            id="decision-funnel"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Decision Funnel</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <DecisionFunnel
                  constraints={analysis?.constraintResult ?? null}
                  options={analysis?.options ?? null}
                  origin={trip.itinerary.origin}
                  destination={trip.itinerary.destination}
                />
              </CollapsibleContent>
            </Collapsible>
          </motion.div>

          {/* Finalist radar — below the fold: reveals on scroll */}
          {analysis?.options && (
            <motion.div
              id="option-radar"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Option Radar</span>
                  <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <OptionRadar options={analysis.options} />
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}

          {/* Phase 5: Recovery Intelligence — Why each option won or lost */}
          {analysis?.options && (
            <motion.div
              id="option-comparison"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Option Comparison</span>
                  <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <OptionComparison options={analysis.options} />
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}

          {/* Options + reasoning — below the fold: reveals on scroll */}
          <div ref={optionsAnchorRef} id="recovery-options" className="scroll-mt-24" />
          <motion.div
            className="grid grid-cols-1 gap-4 lg:grid-cols-12"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="lg:col-span-7">
              <RecoveryOptions
                ref={recoveryOptionsRef}
                options={analysis?.options ?? null}
                state={trip.state}
                providerMode={trip.provider_mode === 'ATLAS_SANDBOX' ? 'ATLAS_SANDBOX' : 'DEMO'}
                selectedId={selectedOptionId ?? ''}
                onSelect={(id) => {
                  if (analysisKey) setSelection({ key: analysisKey, id });
                }}
                onApprove={() => void handleApprove()}
                approveBusy={busy.confirm || executing}
                onSwitchToDemo={handleSwitchToDemoAndSimulate}
              />
            </div>
            <div className="lg:col-span-5">
              <LlmPanel explanation={analysis?.explanation ?? null} state={trip.state} />
            </div>
          </motion.div>

          {/* Ledger — below the fold: reveals on scroll */}
          <motion.div
            id="ledger-table"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Execution Ledger</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <LedgerTable ledger={trip.ledger} />
              </CollapsibleContent>
            </Collapsible>
          </motion.div>

          {/* Architecture deep-dive for judges — below the fold */}
          <motion.div
            id="how-it-works"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">How It Works</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <HowItWorks providerMode={trip.provider_mode === 'ATLAS_SANDBOX' ? 'ATLAS_SANDBOX' : 'DEMO'} />
              </CollapsibleContent>
            </Collapsible>
          </motion.div>
        </main>

        {/* Floating Jump-to-Approval button */}
        {showJumpBtn && (
          <button
            onClick={() => document.getElementById('recovery-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="fixed bottom-20 right-6 z-40 flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-semibold text-sm rounded-full shadow-lg hover:bg-amber-400 transition-colors animate-pulse"
          >
            ↓ {t('nav.jump_to_approval')}
          </button>
        )}

        {/* Floating Back-to-Top button */}
        {showTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-40 p-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-full shadow-lg hover:bg-zinc-700 transition-colors"
            aria-label={t('nav.back_to_top')}
          >
            ↑
          </button>
        )}

        <SiteFooter engineVersion={trip.engine_version} />
      </div>

      <div className="print:hidden">
        <DemoChecklist open={checklistOpen} onClose={() => setChecklistOpen(false)} state={trip.state} />
        <ItineraryStudioModal
          open={studioOpen}
          onOpenChange={setStudioOpen}
          currentItinerary={trip.itinerary}
          onItineraryUpdated={refresh}
        />
        <ExecutionModal
          open={modalOpen}
          onOpenChange={(o) => {
            if (!executing) setModalOpen(o);
          }}
          option={selectedOption}
          provider={trip.provider}
          events={events}
          startSeq={modalStartSeq}
          result={execResult}
          executing={executing}
          onRetry={() => void handleApprove()}
          onSwitchToDemo={handleSwitchToDemoAndSimulate}
        />

        {/* Presenter shortcuts overlay */}
        <AnimatePresence>
        {helpOpen && (
          <motion.div
            key="help-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 dark:bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setHelpOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            ref={shortcutsDialogRef}
          >
            <motion.div
              className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-2xl"
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-zinc-100">Presenter Shortcuts</h3>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="ml-auto rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Close shortcuts"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { k: 'D', label: 'Trigger cancellation scenario (Typhoon / SQ856)' },
                  { k: 'E', label: 'Trigger delay scenario (CX520 +45m)' },
                  { k: 'M', label: 'Open Itinerary Studio & Mission Builder' },
                  { k: 'A', label: 'Approve & book the recommended plan' },
                  { k: 'R', label: 'Reset the demo session' },
                  { k: 'P', label: 'Print / save one-page run summary (PDF)' },
                  { k: 'C', label: 'Toggle the demo checklist (guided run sheet)' },
                  { k: '?', label: 'Toggle this overlay' },
                  { k: 'Esc', label: 'Close overlays' },
                ].map((s) => (
                  <div key={s.k} className="flex items-center gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
                    <kbd className="flex h-6 min-w-6 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/80 px-1.5 font-mono text-[11px] font-bold text-amber-300">
                      {s.k}
                    </kbd>
                    <span className="text-[12px] text-zinc-300">{s.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-zinc-400">
                Shortcuts follow your trip&apos;s progress: D/E only work before a disruption starts, A only
                works once your options are ready. They never fire while typing in an input.
              </p>
              <button
                type="button"
                onClick={() => {
                  setHelpOpen(false);
                  setChecklistOpen(true);
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] py-2 text-[11.5px] font-bold text-amber-300 transition-all hover:bg-amber-500/[0.12] active:scale-[0.98]"
              >
                <ListChecks className="h-3.5 w-3.5" />
                Open demo checklist — first time presenting?
              </button>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Itinerary Studio Modal */}
        <ItineraryStudioModal
          open={studioOpen}
          onOpenChange={setStudioOpen}
          currentItinerary={trip.itinerary}
          onItineraryUpdated={refresh}
        />
      </div>

      {/* Print-only one-page run summary (hidden on screen; header button triggers window.print) */}
      <div data-print-root>
        <PrintSummary trip={trip} />
      </div>
    </div>
  );
}
