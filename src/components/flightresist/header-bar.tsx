'use client';

import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
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
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

export function HeaderBar({ trip, sseConnected, onReset, resetBusy, onExportCsv, onHelp }: Props) {
  const tone = stateTone(trip.state);

  // Theme toggle — resolve after mount to avoid an SSR hydration mismatch
  // on the sun/moon icon.
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme !== 'light';

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
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold ${
              trip.provider_mode === 'DEMO'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
            title={
              trip.provider_mode === 'DEMO'
                ? 'Demo mode — flights are simulated for this demo'
                : 'Sandbox mode — practice bookings in a safe test environment'
            }
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                  trip.provider_mode === 'DEMO' ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  trip.provider_mode === 'DEMO' ? 'bg-amber-300' : 'bg-emerald-300'
                }`}
              />
            </span>
            {trip.provider_mode === 'DEMO' ? t('app.demo_mode') : t('app.sandbox_mode')}
          </span>

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
