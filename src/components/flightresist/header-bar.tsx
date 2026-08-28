'use client';

import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Keyboard,
  Moon,
  Plane,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { CurrentTrip } from '@/hooks/use-flightresist';
import { prettyState, stateTone } from '@/lib/flightresist/format';
import { t } from '@/lib/i18n';

interface Props {
  trip: CurrentTrip;
  sseConnected: boolean;
  onReset: () => void;
  resetBusy: boolean;
  onExportCsv: () => void;
  onHelp: () => void;
  /** Refresh trip state after a mode switch (provider info may change). */
  onModeChanged?: () => void;
}

/** GET /api/atlas/status payload. */
interface AtlasStatus {
  available: boolean;
  reason?: string;
}

export function HeaderBar({ trip, sseConnected, onReset, resetBusy, onExportCsv, onHelp, onModeChanged }: Props) {
  const tone = stateTone(trip.state);

  // Theme toggle — resolve after mount to avoid an SSR hydration mismatch
  // on the sun/moon icon.
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme !== 'light';

  // --- Provider mode selector (Task 32) ------------------------------------
  // User-selectable Demo/Live: persisted per user via PATCH /api/user/mode
  // and resolved server-side when a disruption is triggered. LIVE routes the
  // recovery pipeline through the real atlas-flight CLI; DEMO pins the
  // deterministic fixture.
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();
  const [atlasStatus, setAtlasStatus] = useState<AtlasStatus | null>(null);
  const [modeOverride, setModeOverride] = useState<'DEMO' | 'LIVE' | null>(null);
  const [modeBusy, setModeBusy] = useState(false);
  const [liveBlockedOpen, setLiveBlockedOpen] = useState(false);

  // Probe Atlas availability once on mount — the selector uses it to warn
  // before the user can pick a Live mode this deployment cannot serve.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/atlas/status', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return { available: false, reason: `HTTP ${res.status}` };
        return (await res.json()) as AtlasStatus;
      })
      .then((data) => {
        if (!cancelled) setAtlasStatus(data);
      })
      .catch(() => {
        if (!cancelled) setAtlasStatus({ available: false, reason: 'Atlas status check failed.' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Effective mode: the user's in-flight switch wins, next their stored
  // session preference, and until the session resolves we mirror the provider
  // the server actually resolved for this trip (no wrong-mode flash).
  const sessionMode: 'DEMO' | 'LIVE' = session?.user?.preferredMode === 'LIVE' ? 'LIVE' : 'DEMO';
  const tripMode: 'DEMO' | 'LIVE' = trip.provider_mode !== 'DEMO' ? 'LIVE' : 'DEMO';
  const mode: 'DEMO' | 'LIVE' = modeOverride ?? (sessionStatus === 'authenticated' ? sessionMode : tripMode);

  const handleModeChange = useCallback(
    async (next: string) => {
      if (next !== 'DEMO' && next !== 'LIVE') return;
      if (next === mode || modeBusy) return;

      // Live needs the Atlas CLI — if this deployment cannot run it, explain
      // instead of saving a preference the recovery pipeline must reject.
      if (next === 'LIVE' && atlasStatus && !atlasStatus.available) {
        setLiveBlockedOpen(true);
        return;
      }

      setModeBusy(true);
      try {
        const res = await fetch('/api/user/mode', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: next }),
        });
        const data = (await res.json().catch(() => ({}))) as { mode?: string; error?: string };
        if (!res.ok || data.mode !== next) {
          toast({
            title: 'Mode switch failed',
            description: data.error ?? `HTTP ${res.status}`,
            variant: 'destructive',
          });
          return;
        }
        setModeOverride(next);
        // Refresh trip state so downstream views re-sync with the new mode.
        onModeChanged?.();
        toast({
          title: next === 'LIVE' ? 'Live mode armed' : 'Demo mode armed',
          description:
            next === 'LIVE'
              ? 'The next disruption will be recovered against real airline availability via the Atlas CLI.'
              : 'The next disruption will be recovered against the deterministic demo fixture.',
        });
      } catch {
        toast({
          title: 'Network error',
          description: 'Could not reach the server to switch modes.',
          variant: 'destructive',
        });
      } finally {
        setModeBusy(false);
      }
    },
    [atlasStatus, mode, modeBusy, onModeChanged, toast],
  );

  const downloadReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      engine_version: trip.engine_version,
      session: {
        trip_id: trip.trip_id,
        state: trip.state,
        risk_score: trip.risk_score,
        provider_mode: trip.provider_mode,
        provider: trip.provider,
      },
      itinerary: trip.itinerary,
      disruption: trip.disruption,
      analysis: trip.analysis,
      execution: trip.execution,
      ledger: trip.ledger,
      events: trip.events,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flightresist-run-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-zinc-950/90 backdrop-blur-sm sm:backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-500/25 ring-1 ring-amber-300/30">
            <ShieldCheck className="h-5 w-5 text-neutral-950" />
            <Plane className="absolute -right-1 -top-1 h-4 w-4 rotate-45 text-amber-300" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-zinc-50 sm:text-lg">
              FLIGHTRESIST <span className="text-amber-400">AI 2.0</span>
            </h1>
            <p className="hidden text-[11px] text-zinc-500 sm:block">
              Autonomous Travel Recovery Assistant
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Provider mode selector (Task 32) — user-selectable Demo/Live.
              LIVE routes the recovery pipeline through the real atlas-flight
              CLI; DEMO pins the deterministic fixture. The pulsing status dot
              rides inside each option label, so it renders in both the open
              dropdown and the closed trigger (Radix clones the selected
              label into the trigger). The choice persists per user via
              PATCH /api/user/mode. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex">
                <Select value={mode} onValueChange={(v) => void handleModeChange(v)} disabled={modeBusy}>
                  <SelectTrigger
                    size="sm"
                    aria-label="Provider mode — Demo or Live"
                    className={
                      mode === 'LIVE'
                        ? "h-8 border-emerald-500/50 bg-emerald-500/10 px-2.5 font-mono text-[11px] font-extrabold tracking-wide text-emerald-300 shadow-none ring-1 ring-emerald-400/20 hover:bg-emerald-500/15 focus-visible:ring-emerald-400/60 [&_svg:not([class*='text-'])]:text-emerald-400/70"
                        : "h-8 border-amber-500/40 bg-amber-500/10 px-2.5 font-mono text-[11px] font-semibold text-amber-300 shadow-none hover:bg-amber-500/15 focus-visible:ring-amber-400/60 [&_svg:not([class*='text-'])]:text-amber-400/70"
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEMO" className="text-amber-700 dark:text-amber-300">
                      <span className="relative mr-1.5 flex h-1.5 w-1.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" />
                      </span>
                      {t('app.demo_mode')}
                    </SelectItem>
                    <SelectItem value="LIVE" className="text-emerald-700 dark:text-emerald-300">
                      <span className="relative mr-1.5 flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      </span>
                      {t('app.live_mode')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="end"
              className="max-w-[300px] space-y-1.5 border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left text-zinc-200 [&>svg]:bg-zinc-900 [&>svg]:fill-zinc-900"
            >
              <p className="text-[11px] leading-snug">
                <span className="font-semibold text-amber-300">Demo Mode</span>
                <span className="text-zinc-400"> — flights, fares and bookings are simulated (deterministic fixture).</span>
              </p>
              <p className="text-[11px] leading-snug">
                <span className="font-semibold text-emerald-300">Live Mode</span>
                <span className="text-zinc-400"> — real airline availability, fares and sandbox bookings via the Atlas CLI.</span>
              </p>
              {atlasStatus && !atlasStatus.available && (
                <p className="border-t border-zinc-800 pt-1.5 text-[10px] leading-snug text-amber-400/90">
                  Live mode requires the Atlas CLI — unavailable on this deployment.
                </p>
              )}
            </TooltipContent>
          </Tooltip>

          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${tone.bg} ${tone.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${trip.state === 'EXECUTING' || trip.state === 'ANALYZING' ? 'animate-pulse' : ''}`} />
            {prettyState(trip.state)}
          </span>

          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] ${
              sseConnected
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-500'
            }`}
            title={sseConnected ? 'Live updates connected' : 'Live updates offline'}
          >
            {sseConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {sseConnected ? t('app.connected') : t('app.disconnected')}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={downloadReport}
            className="h-8 gap-1.5 border border-zinc-800 text-[11px] text-zinc-300 transition-all hover:bg-zinc-800/60 hover:text-zinc-100 active:scale-[0.97] focus-visible:ring-amber-400/60"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Run Report</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onExportCsv}
            className="h-8 gap-1.5 border border-zinc-800 text-[11px] text-zinc-300 transition-all hover:bg-zinc-800/60 hover:text-zinc-100 active:scale-[0.97] focus-visible:ring-amber-400/60"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Evidence CSV</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            aria-label="Print run summary"
            title="Print / save one-page run summary (P)"
            className="h-8 gap-1.5 border border-zinc-800 text-[11px] text-zinc-300 transition-all hover:bg-zinc-800/60 hover:text-zinc-100 active:scale-[0.97] focus-visible:ring-amber-400/60"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Summary</span>
            <kbd className="hidden font-mono text-[10px] text-zinc-500 lg:inline">P</kbd>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onHelp}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="h-8 gap-1.5 border border-zinc-800 text-[11px] text-zinc-300 transition-all hover:bg-zinc-800/60 hover:text-zinc-100 active:scale-[0.97] focus-visible:ring-amber-400/60"
          >
            <Keyboard className="h-3.5 w-3.5" />
            <kbd className="hidden font-mono text-[10px] text-zinc-500 sm:inline">?</kbd>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="h-8 gap-1.5 border border-zinc-800 text-[11px] text-zinc-300 transition-all hover:bg-zinc-800/60 hover:text-zinc-100 active:scale-[0.97] focus-visible:ring-amber-400/60"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={resetBusy || trip.state === 'NORMAL'}
            title="Reset demo session (R)"
            className="h-8 gap-1.5 border border-zinc-800 text-[11px] text-zinc-300 transition-all hover:bg-zinc-800/60 hover:text-zinc-100 active:scale-[0.97] focus-visible:ring-amber-400/60 disabled:opacity-40"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${resetBusy ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reset</span>
            <kbd className="hidden font-mono text-[10px] text-zinc-500 lg:inline">R</kbd>
          </Button>
        </div>
      </div>

      {/* Live-mode-blocked explainer — the user picked Live where the Atlas
          CLI cannot run (e.g. Vercel serverless). Stays in Demo; nothing is
          persisted. */}
      <AlertDialog open={liveBlockedOpen} onOpenChange={setLiveBlockedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              Live mode unavailable on this deployment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Live mode requires the Atlas CLI (atlas-flight), which is not installed on this
              deployment (Vercel) — only Demo mode is supported here, with simulated flights,
              fares and bookings. Use the self-hosted version for real flights.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-amber-500 text-neutral-950 hover:bg-amber-400">
              Stay in Demo Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* engine heartbeat line */}
      <motion.div
        className="h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </header>
  );
}
