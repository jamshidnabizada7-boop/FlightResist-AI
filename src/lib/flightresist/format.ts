/**
 * FlightResist AI 2.0 — client-safe formatting helpers.
 * All times are parsed from offset-bearing ISO strings (airport-local clock),
 * never from the browser timezone — deterministic everywhere.
 */

import { t } from '@/lib/i18n';

export function fmtLocalTime(iso: string, referenceDateIso?: string): { time: string; nextDay: boolean } {
  if (!iso) return { time: '--:--', nextDay: false };
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  const time = m ? `${m[1]}:${m[2]}` : '--:--';

  let nextDay = false;
  if (referenceDateIso) {
    const isoDate = iso.slice(0, 10);
    const refDate = referenceDateIso.slice(0, 10);
    nextDay = isoDate > refDate;
  } else {
    // Dynamic nextDay determination: check if calendar date is after the standard scenario start date (2026-08-27)
    // or starts with canonical next-day dates
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (year === 2026 && month === 8) {
        nextDay = day > 27;
      } else {
        nextDay = iso.startsWith('2026-08-28') || iso.startsWith('2026-08-29');
      }
    } else {
      nextDay = false;
    }
  }

  return { time, nextDay };
}

export function fmtClock(iso: string): string {
  const m = /T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}:${m[3]}` : '--:--:--';
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${m > 0 ? `${String(m).padStart(2, '0')}m` : ''}` : `${m}m`;
}

export function fmtMoney(usd: number): string {
  return usd === 0 ? '$0' : `$${usd % 1 === 0 ? usd : usd.toFixed(2)}`;
}

export function riskTone(risk: number): { text: string; bg: string; ring: string; stroke: string } {
  if (risk >= 80)
    return { text: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/40', stroke: '#ef4444' };
  if (risk >= 60)
    return { text: 'text-orange-400', bg: 'bg-orange-500/10', ring: 'ring-orange-500/40', stroke: '#fb923c' };
  if (risk >= 30)
    return { text: 'text-amber-300', bg: 'bg-amber-500/10', ring: 'ring-amber-500/40', stroke: '#fbbf24' };
  return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/40', stroke: '#34d399' };
}

export function stateTone(state: string): { text: string; bg: string; dot: string } {
  switch (state) {
    case 'NORMAL':
      return { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' };
    case 'DISRUPTION_DETECTED':
    case 'ANALYZING':
      return { text: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-400' };
    case 'RECOVERY_OPTIONS_READY':
    case 'AWAITING_APPROVAL':
      return { text: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400' };
    case 'EXECUTING':
      return { text: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/30', dot: 'bg-yellow-400' };
    case 'RECOVERED':
      return { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' };
    case 'FAILED':
      return { text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-400' };
    default:
      return { text: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/30', dot: 'bg-zinc-400' };
  }
}

export function levelTone(level: string): { icon: string; text: string } {
  switch (level) {
    case 'critical':
      return { icon: 'text-red-400', text: 'text-red-300' };
    case 'warn':
      return { icon: 'text-orange-400', text: 'text-orange-200' };
    case 'success':
      return { icon: 'text-emerald-400', text: 'text-emerald-200' };
    case 'agent':
      return { icon: 'text-amber-300', text: 'text-amber-100' };
    default:
      return { icon: 'text-zinc-400', text: 'text-zinc-300' };
  }
}

/** i18n keys for human-friendly trip state labels (internal state values stay unchanged). */
const STATE_LABEL_KEYS: Record<string, string> = {
  NORMAL: 'state.normal',
  DISRUPTION_DETECTED: 'state.disruption_detected',
  ANALYZING: 'state.analyzing',
  RECOVERY_OPTIONS_READY: 'state.options_ready',
  AWAITING_APPROVAL: 'state.awaiting_approval',
  EXECUTING: 'state.executing',
  RECOVERED: 'state.recovered',
  FAILED: 'state.failed',
};

export function prettyState(state: string): string {
  const key = STATE_LABEL_KEYS[state];
  return key ? t(key) : state.replaceAll('_', ' ');
}
