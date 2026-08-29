'use client';

import { motion } from 'framer-motion';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Keyboard,
  LogOut,
  Moon,
  Plane,
  Printer,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sun,
  TriangleAlert,
  UserRound,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  /** Trigger callback to open the Itinerary Studio modal. */
  onOpenStudio?: () => void;
}

/** GET /api/atlas/status payload. */
interface AtlasStatus {
  available: boolean;
  reason?: string;
  authenticated?: boolean;
  ticketingAvailable?: boolean;
  ticketingBlocker?: string;
  ticketingActivationUrl?: string;
}

export function HeaderBar({ trip, sseConnected, onReset, resetBusy, onExportCsv, onHelp, onModeChanged, onOpenStudio }: Props) {
  const tone = stateTone(trip.state);

  // Theme toggle — resolve after mount to avoid an SSR hydration mismatch
  // on the sun/moon icon.
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard next-themes mounted guard; the SSR-safe pattern requires one post-mount render flip.
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme !== 'light';

  // --- Provider mode selector (Task 32) ------------------------------------
  // User-selectable Demo/Live: persisted per user via PATCH /api/user/mode
  // and resolved server-side when a disruption is triggered. LIVE routes the
  // recovery pipeline through the real atlas-flight CLI; DEMO pins the
  // deterministic fixture.
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
  const { toast } = useToast();
  const [atlasStatus, setAtlasStatus] = useState<AtlasStatus | null>(null);
  const [modeOverride, setModeOverride] = useState<'DEMO' | 'LIVE' | null>(null);
  const [modeBusy, setModeBusy] = useState(false);
  const [liveBlockedOpen, setLiveBlockedOpen] = useState(false);
  // Profile menu dialogs (Deliverable 3): account details + mode settings.
  const [profileOpen, setProfileOpen] = useState(false);
  const [modeSettingsOpen, setModeSettingsOpen] = useState(false);

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
        // Commit the UI state first — the PATCH already persisted the
        // preference, so a session-refresh hiccup must not look like a
        // failed switch.
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
        // Best-effort: refresh the NextAuth JWT with the new mode so it
        // survives page reloads for the rest of this login session (the jwt
        // callback merges it into the token on `update`). A failure here
        // only delays the token copy — the DB is authoritative via
        // resolveUserMode — so swallow it instead of surfacing a wrong
        // "network error" toast.
        try {
          await updateSession({ preferredMode: next });
        } catch (err) {
          console.warn('Session token refresh after mode switch failed; DB preference is authoritative.', err);
        }
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
    [atlasStatus, mode, modeBusy, onModeChanged, toast, updateSession],
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

  // Account created date for the Profile dialog (only shown when known).
  const createdLabel = (() => {
    const iso = session?.user?.createdAt;
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
  })();

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
              PATCH /api/user/mode.

              NOTE: this Select is deliberately NOT wrapped in a Tooltip —
              nesting a Radix Select inside TooltipTrigger makes the
              hoverable TooltipContent (z-50) sit over the open dropdown
              portal and re-open on focus when the Select closes, which
              swallows pointer clicks on the options. The explanation lives
              in the trigger's title attribute instead. */}
          {sessionStatus === 'authenticated' ? (
            <Select value={mode} onValueChange={(v) => void handleModeChange(v)} disabled={modeBusy}>
              <SelectTrigger
                size="sm"
                aria-label="Provider mode — Demo or Live"
                title={
                  'Demo Mode — flights, fares and bookings are simulated (deterministic fixture). '
                  + 'Live Mode — real airline availability, fares and sandbox bookings via the Atlas CLI.'
                  + (atlasStatus && !atlasStatus.available
                    ? ' Live mode requires the Atlas CLI — unavailable on this deployment.'
                    : '')
                }
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
          ) : (
            /* Signed-out visitors get a read-only mode badge (PATCH
               /api/user/mode requires auth); mode mirrors the provider the
               server resolved for the current trip. */
            <span
              title="Sign in to switch between Demo and Live mode."
              className={
                mode === 'LIVE'
                  ? 'inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 font-mono text-[11px] font-semibold text-emerald-300'
                  : 'inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 font-mono text-[11px] font-semibold text-amber-300'
              }
            >
              <span className={`h-1.5 w-1.5 rounded-full ${mode === 'LIVE' ? 'bg-emerald-300' : 'bg-amber-300'}`} />
              {mode === 'LIVE' ? t('app.live_mode') : t('app.demo_mode')}
            </span>
          )}

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

          {onOpenStudio && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenStudio}
              title="Itinerary Studio & Mission Builder (M)"
              className="h-8 gap-1.5 border border-amber-500/40 bg-amber-500/10 text-[11px] font-semibold text-amber-300 transition-all hover:bg-amber-500/20 hover:text-amber-200 active:scale-[0.97] focus-visible:ring-amber-400/60"
            >
              <Plane className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Itinerary Studio</span>
            </Button>
          )}

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

          {/* User profile menu — signed-in identity, live mode state and
              sign-out. Only rendered for authenticated sessions. */}
          {sessionStatus === 'authenticated' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="User menu"
                  title="Account and sign out"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 transition-all hover:border-amber-400/50 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 active:scale-[0.97] data-[state=open]:border-amber-400/50 data-[state=open]:bg-zinc-800"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-600 text-[10px] font-extrabold text-neutral-950">
                      {(session?.user?.name || session?.user?.email || '?')
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase() ?? '')
                        .join('') || '?'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 border-zinc-700 bg-zinc-900 text-zinc-200"
              >
                <DropdownMenuLabel className="space-y-0.5">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {session?.user?.name || 'Unnamed user'}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs font-normal text-zinc-400">
                    <span className="truncate">{session?.user?.email}</span>
                    {session?.user?.emailVerified ? (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                        <BadgeCheck className="h-2.5 w-2.5" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-amber-300">
                        Unverified
                      </span>
                    )}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                  <span className="text-zinc-400">Provider mode</span>
                  <span
                    className={
                      mode === 'LIVE'
                        ? 'inline-flex items-center gap-1.5 font-mono font-bold text-emerald-300'
                        : 'inline-flex items-center gap-1.5 font-mono font-bold text-amber-300'
                    }
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${mode === 'LIVE' ? 'bg-emerald-300' : 'bg-amber-300'}`} />
                    {mode === 'LIVE' ? t('app.live_mode') : t('app.demo_mode')}
                  </span>
                </div>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onSelect={() => setProfileOpen(true)}
                  className="gap-2 text-sm text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  <UserRound className="h-4 w-4 text-zinc-400" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setModeSettingsOpen(true)}
                  className="gap-2 text-sm text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  <Settings2 className="h-4 w-4 text-zinc-400" />
                  Mode Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onSelect={() => void signOut({ callbackUrl: '/login' })}
                  className="gap-2 text-sm text-red-300 focus:bg-red-500/10 focus:text-red-200 [&_svg]:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Live-mode-blocked explainer — the user picked Live where the Atlas
          CLI cannot run (e.g. serverless deployments). Stays in Demo; nothing
          is persisted. Uses the server's own reason (CLI absent vs. secure
          store unavailable) instead of assuming one. */}
      <AlertDialog open={liveBlockedOpen} onOpenChange={setLiveBlockedOpen}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-start gap-2 text-amber-400">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              Live mode unavailable on this deployment
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-zinc-300">
                <p>
                  {atlasStatus?.available === false && atlasStatus.reason
                    ? atlasStatus.reason
                    : 'Live mode requires the Atlas CLI (atlas-flight), which cannot run on this deployment — only Demo mode is supported here, with simulated flights, fares and bookings. Use the self-hosted version for real flights.'}
                </p>
                {atlasStatus?.ticketingBlocker && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                    <span className="font-bold">Blocker: </span>
                    {atlasStatus.ticketingBlocker}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            {atlasStatus?.ticketingActivationUrl ? (
              <a
                href={atlasStatus.ticketingActivationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                ↗ Open ATRIP Workspace
              </a>
            ) : null}
            <AlertDialogAction className="bg-amber-500 text-neutral-950 hover:bg-amber-400">
              Stay in Demo Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile dialog (Deliverable 3) — account details for this session */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <UserRound className="h-4 w-4 text-amber-400" />
              Profile
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Account details for this session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Name</span>
              <span className="truncate text-[13px] text-zinc-200">{session?.user?.name || 'Unnamed user'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Email</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[13px] text-zinc-200">{session?.user?.email}</span>
                {session?.user?.emailVerified ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                    <BadgeCheck className="h-2.5 w-2.5" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-amber-300">
                    Unverified
                  </span>
                )}
              </span>
            </div>
            {createdLabel && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Account created</span>
                <span className="text-[13px] text-zinc-200">{createdLabel}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Mode preference</span>
              <span
                className={`inline-flex items-center gap-1.5 font-mono text-[12px] font-bold ${
                  mode === 'LIVE' ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${mode === 'LIVE' ? 'bg-emerald-300' : 'bg-amber-300'}`} />
                {mode === 'LIVE' ? t('app.live_mode') : t('app.demo_mode')}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mode Settings dialog (Deliverable 3) — the same handleModeChange
          flow as the header Select, so Live-blocked handling stays identical */}
      <Dialog open={modeSettingsOpen} onOpenChange={setModeSettingsOpen}>
        <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <Settings2 className="h-4 w-4 text-amber-400" />
              Mode Settings
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Choose how FlightResist recovers your trip when disruption hits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setModeSettingsOpen(false);
                void handleModeChange('DEMO');
              }}
              disabled={modeBusy}
              className={`w-full rounded-lg border p-3 text-left transition-all active:scale-[0.98] disabled:opacity-60 ${
                mode === 'DEMO'
                  ? 'border-amber-400/60 bg-amber-500/[0.08] shadow-[0_0_16px_rgba(251,191,36,0.08)]'
                  : 'border-zinc-800/70 bg-zinc-950/40 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${mode === 'DEMO' ? 'bg-amber-300' : 'bg-zinc-600'}`} />
                <span className={`text-[13px] font-bold ${mode === 'DEMO' ? 'text-amber-200' : 'text-zinc-200'}`}>
                  {t('app.demo_mode')}
                </span>
                {mode === 'DEMO' && (
                  <span className="ml-auto rounded border border-amber-400/50 bg-amber-400/10 px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-amber-300">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                Simulated flight data — deterministic fixture, safe for demos.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setModeSettingsOpen(false);
                void handleModeChange('LIVE');
              }}
              disabled={modeBusy}
              className={`w-full rounded-lg border p-3 text-left transition-all active:scale-[0.98] disabled:opacity-60 ${
                mode === 'LIVE'
                  ? 'border-emerald-400/60 bg-emerald-500/[0.08] shadow-[0_0_16px_rgba(52,211,153,0.08)]'
                  : 'border-zinc-800/70 bg-zinc-950/40 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${mode === 'LIVE' ? 'bg-emerald-300' : 'bg-zinc-600'}`} />
                <span className={`text-[13px] font-bold ${mode === 'LIVE' ? 'text-emerald-200' : 'text-zinc-200'}`}>
                  {t('app.live_mode')}
                </span>
                {mode === 'LIVE' && (
                  <span className="ml-auto rounded border border-emerald-400/50 bg-emerald-400/10 px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                Real flight data via the Atlas CLI — real availability, fares and sandbox bookings.
              </p>
            </button>
            {atlasStatus && !atlasStatus.available && (
              <p className="text-[11px] leading-snug text-zinc-500">
                Live mode requires the Atlas CLI — unavailable on this deployment.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
