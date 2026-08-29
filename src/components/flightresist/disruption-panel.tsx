'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Clock3, CloudLightning, Radar, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { fmtLocalTime, riskTone } from '@/lib/flightresist/format';
import { t } from '@/lib/i18n';
import type { DisruptionEvent, TripState } from '@/lib/flightresist/types';

export type ScenarioId = 'cancellation' | 'delay';

interface Props {
  state: TripState;
  riskScore: number;
  disruption: DisruptionEvent | null;
  recovered: boolean;
  onTrigger: (scenario: ScenarioId, delayMinutes?: number) => void;
  triggerBusy: boolean;
  /** Provider actually resolved for the current trip (e.g. 'DEMO' | 'ATLAS_SANDBOX'). */
  providerMode: string;
}

function RiskGauge({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const tone = riskTone(value);

  useEffect(() => {
    const from = Number.isFinite(displayRef.current) ? displayRef.current : 0;
    const controls = animate(from, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1], // expo-out: fast sweep, gentle settle — reads as "landing"
      onUpdate: (v) => {
        if (Number.isFinite(v)) {
          displayRef.current = v;
          setDisplay(Math.round(v));
        }
      },
    });
    return () => controls.stop();
  }, [value]);

  // Semicircle arc geometry
  const R = 74;
  const CX = 90;
  const CY = 88;
  const circumference = Math.PI * R; // half circle
  const clamped = Math.min(100, Math.max(0, Number.isFinite(display) ? display : 0));
  const progress = circumference * (1 - clamped / 100);

  // Decorative tick-mark ring outside the arc (major tick every 25%)
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const angle = Math.PI * (1 - i / 20);
    const major = i % 5 === 0;
    const rOuter = 87;
    const rInner = major ? 81 : 84;
    return {
      x1: CX + Math.cos(angle) * rInner,
      y1: CY - Math.sin(angle) * rInner,
      x2: CX + Math.cos(angle) * rOuter,
      y2: CY - Math.sin(angle) * rOuter,
      major,
    };
  });

  return (
    <div className="relative mx-auto w-[180px] max-w-full">
      <svg viewBox="0 0 180 100" className="w-full">
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.major ? '#52525b' : '#3f3f46'}
            strokeWidth={t.major ? 1.5 : 1}
            opacity={t.major ? 0.7 : 0.45}
          />
        ))}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#27272a"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          style={{ filter: `drop-shadow(0 0 6px ${tone.stroke}59)` }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className={`font-mono text-4xl font-extrabold tabular-nums ${tone.text}`}>{clamped}</div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">/ 100 trip risk</div>
      </div>
    </div>
  );
}

const SCENARIO_CARDS: {
  id: ScenarioId;
  title: string;
  detail: string;
  tag: string;
  tagClass: string;
  icon: React.ComponentType<{ className?: string }>;
  kbd: string;
}[] = [
  {
    id: 'cancellation',
    title: 'Typhoon cancels SQ856',
    detail: 'Primary leg cancelled — hub closed, connection missed. Risk 87 CRITICAL.',
    tag: 'CRITICAL',
    tagClass: 'border-red-500/50 bg-red-500/10 text-red-400',
    icon: CloudLightning,
    kbd: 'D',
  },
  {
    id: 'delay',
    title: 'CX520 delayed +45m',
    detail: 'Connection slips — transfer and rest buffers compress. Risk 41 HIGH.',
    tag: 'HIGH',
    tagClass: 'border-orange-500/50 bg-orange-500/10 text-orange-300',
    icon: Clock3,
    kbd: 'E',
  },
];

/** Priority 2+7: visual risk transition 0→87→18 */
function RiskJourney({ residualRisk }: { residualRisk: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="w-full rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3"
    >
      <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Risk journey</div>
      <div className="flex items-center gap-1.5">
        <div className="flex flex-col items-center">
          <span className="font-mono text-lg font-extrabold tabular-nums text-emerald-400">0</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">normal</span>
        </div>
        <ArrowRight className="h-3 w-3 shrink-0 text-zinc-500" />
        <div className="flex flex-col items-center">
          <span className="font-mono text-lg font-extrabold tabular-nums text-red-400">87</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-red-400/70">critical</span>
        </div>
        <ArrowRight className="h-3 w-3 shrink-0 text-zinc-500" />
        <div className="flex flex-col items-center">
          <span className="font-mono text-lg font-extrabold tabular-nums text-emerald-400">{residualRisk}</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-400/70">recovered</span>
        </div>
      </div>
    </motion.div>
  );
}

/** Mode Status Panel — which data source the Sentinel is running against.
 *  Truth comes from trip.provider_mode; in Live mode we additionally probe
 *  GET /api/atlas/status to distinguish "really connected" from "selected but
 *  unavailable". */
function ModeStatusPanel({ providerMode }: { providerMode: string }) {
  const [atlasAvailable, setAtlasAvailable] = useState<boolean | null>(null);

  useEffect(() => {
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
  }, []);

  const live = providerMode !== 'DEMO';

  let dot = 'bg-amber-300';
  let cls = 'border-amber-500/30 bg-amber-500/[0.06] text-amber-200';
  let label = t('mode.demo_active');
  if (live) {
    if (atlasAvailable === true) {
      dot = 'bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.7)]';
      cls = 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200';
      label = t('mode.live_active');
    } else if (atlasAvailable === false) {
      dot = 'bg-red-400';
      cls = 'border-red-500/30 bg-red-500/[0.05] text-zinc-300';
      label = t('mode.live_unavailable');
    } else {
      dot = 'animate-pulse bg-zinc-500';
      cls = 'border-zinc-700/60 bg-zinc-950/40 text-zinc-400';
      label = t('mode.checking_atlas');
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${cls}`}
    >
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="text-[11px] leading-snug">{label}</span>
    </div>
  );
}

export function DisruptionPanel({ state, riskScore, disruption, recovered, onTrigger, triggerBusy, providerMode }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const tone = riskTone(riskScore);
  const isNormal = state === 'NORMAL';
  const [scenario, setScenario] = useState<ScenarioId>('cancellation');
  const [delayMinutes, setDelayMinutes] = useState(45);
  const selected = SCENARIO_CARDS.find((s) => s.id === scenario) ?? SCENARIO_CARDS[0];

  // Planned CX520 arrival 19:45 JST + delay → new clock time (client preview only).
  const newArrClock = (() => {
    const total = 19 * 60 + 45 + delayMinutes;
    const h = Math.floor((total / 60) % 24);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${total >= 1440 ? ' +1d' : ''}`;
  })();

  return (
    <section aria-labelledby="disruption-panel-heading" className="flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${isNormal ? 'text-zinc-500' : 'text-amber-400'}`} />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">02 ·</span>
          <h2 id="disruption-panel-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-300">{t('disruption.title')}</h2>
        </div>
        <span className="font-mono text-[11px] text-zinc-500">
          {isNormal ? 'monitoring' : recovered ? 'recovered' : 'engaged'}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-4 p-4 sm:p-5">
        {isNormal ? (
          <>
            <div className="relative flex h-24 w-24 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full border border-emerald-500/30"
                animate={shouldReduceMotion ? {} : { scale: [1, 1.35], opacity: [0.7, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border border-emerald-500/20"
                animate={shouldReduceMotion ? {} : { scale: [1, 1.35], opacity: [0.7, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.7 }}
              />
              <motion.div
                animate={shouldReduceMotion ? {} : { rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              >
                <Radar className="h-10 w-10 text-emerald-400" />
              </motion.div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-emerald-400">All systems nominal</div>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
                Sentinel is watching SQ856 / CX520. Pick a disruption scenario to watch the
                autonomous recovery pipeline take over.
              </p>
            </div>

            {/* Scenario selector */}
            <div className="w-full max-w-xs space-y-2" role="radiogroup" aria-label="Disruption scenario">
              {SCENARIO_CARDS.map((s) => {
                const active = s.id === scenario;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setScenario(s.id)}
                    className={`w-full rounded-lg border p-2.5 text-left transition-all active:scale-[0.98] focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-300/70 ${
                      active
                        ? 'border-amber-400/60 bg-amber-500/[0.08] shadow-[0_0_16px_rgba(251,191,36,0.08)]'
                        : 'border-zinc-800/70 bg-zinc-950/40 hover:border-zinc-700'
                    }`}
                  >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                          active ? 'bg-amber-400/15 text-amber-300' : 'bg-zinc-800/70 text-zinc-500'
                        }`}
                      >
                        <s.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className={`truncate text-[12px] font-semibold ${active ? 'text-amber-200' : 'text-zinc-300'}`}>
                        {s.title}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <kbd
                        className={`hidden h-5 w-5 items-center justify-center rounded border font-mono text-[10px] font-bold sm:flex ${
                          active ? 'border-amber-400/50 bg-amber-400/10 text-amber-300' : 'border-zinc-700 bg-zinc-800/60 text-zinc-500'
                        }`}
                      >
                        {s.kbd}
                      </kbd>
                      <span className={`rounded border px-1.5 py-px font-mono text-[11px] font-bold ${s.tagClass}`}>
                        {s.tag}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-snug text-zinc-500">{s.detail}</p>
                  </button>
                );
              })}
            </div>

            {/* Delay-duration slider (delay scenario only) */}
            {scenario === 'delay' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="w-full max-w-xs overflow-hidden"
              >
                <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                      <Clock3 className="h-3 w-3 text-orange-400" /> Delay duration
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-orange-300">+{delayMinutes}m</span>
                  </div>
                  <Slider
                    value={[delayMinutes]}
                    min={15}
                    max={1440}
                    step={15}
                    onValueChange={(v) => setDelayMinutes(v[0] ?? 45)}
                    aria-label="Delay duration in minutes"
                    className="mt-2.5 [&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-amber-500 [&_[data-slot=slider-range]]:to-orange-500 [&_[data-slot=slider-thumb]]:border-orange-400 [&_[data-slot=slider-thumb]]:ring-orange-400/40"
                  />
                  <div className="mt-1 flex justify-between font-mono text-[11px] text-zinc-400">
                    <span>15m</span>
                    <span>180m</span>
                    <span>1440m (24h)</span>
                  </div>
                  <p className="mt-1.5 text-center font-mono text-[10px] text-zinc-500">
                    new arrival ≈ <span className="font-bold text-orange-300">{newArrClock}</span> · risk computed by the engine
                  </p>
                </div>
              </motion.div>
            )}

            <div className="w-full max-w-sm space-y-3">
              <Button
                onClick={() => onTrigger(scenario, scenario === 'delay' ? delayMinutes : undefined)}
                disabled={triggerBusy}
                className="group relative h-12 w-full overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 text-xs sm:text-sm font-extrabold uppercase tracking-wide text-zinc-950 shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/35 hover:brightness-105 active:scale-[0.98] focus-visible:ring-amber-300/70 disabled:opacity-60"
              >
                <div className="absolute inset-0 bg-white/15 opacity-0 transition-opacity group-hover:opacity-100" />
                <Zap className={`mr-2 h-4 w-4 shrink-0 fill-current ${triggerBusy ? 'animate-pulse' : 'transition-transform group-hover:scale-110'}`} />
                <span className="truncate">
                  {triggerBusy
                    ? t('disruption.simulating')
                    : `${t('disruption.trigger')} — ${
                        selected.id === 'delay' ? t('disruption.scenario.delay') : t('disruption.scenario.typhoon')
                      }`}
                </span>
              </Button>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 backdrop-blur-sm text-center">
                <div className="flex items-center justify-center gap-1.5 font-mono text-[10.5px] font-semibold text-amber-400/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {scenario === 'cancellation' ? 'Typhoon Trami Scenario · SQ856' : `Feeder Delay Scenario · +${delayMinutes}m`}
                </div>
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-zinc-400">
                  {scenario === 'cancellation' ? (
                    <>
                      Sentinel webhook → Impact Graph → Atlas search → 42 candidates → 1-tap booking
                    </>
                  ) : (
                    <>
                      Late inbound flight → MCT buffer evaluation → mission risk recalculation
                    </>
                  )}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <RiskGauge value={riskScore} />
            <div className="text-center">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${tone.ring} ${tone.bg} ${tone.text}`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {riskScore >= 80 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW'}{' '}
                {recovered ? '→ STABILIZED' : 'RISK'}
              </span>
            </div>
            {disruption && (
              <div className="w-full rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-sm font-bold ${disruption.event === 'DELAY' ? 'text-orange-300' : 'text-red-400'}`}
                  >
                    {disruption.flightNumber} {disruption.event}
                    {disruption.event === 'DELAY' && disruption.delayMinutes ? ` +${disruption.delayMinutes}m` : ''}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                    {disruption.event === 'DELAY' && <Clock3 className="h-3 w-3 text-orange-400" />}
                    {fmtLocalTime(disruption.detectedAtIso).time} SIN
                  </span>
                </div>
                <div className="mt-1 text-xs font-medium text-zinc-300">{disruption.reason}</div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">{disruption.detail}</p>
              </div>
            )}
            {recovered && (
              <>
                {/* Mission Restored banner — Priority 7 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="fr-recovered-pulse w-full rounded-lg border border-emerald-500/40 bg-emerald-500/[0.08] p-4 text-center"
                >
                  <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />
                  <div className="mt-2 font-mono text-lg font-extrabold uppercase tracking-widest text-emerald-300">
                    Mission Restored
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-200/80">
                    Recovery executed — residual risk {riskScore}/100
                  </div>
                </motion.div>
                {/* Risk journey: 0 → 87 → 18 — Priority 2 */}
                <RiskJourney residualRisk={riskScore} />
              </>
            )}
          </>
        )}
      </div>

      {/* Mode Status Panel — which data source the Sentinel runs against */}
      <div className="border-t border-zinc-800/60 px-4 py-3 sm:px-5">
        <ModeStatusPanel providerMode={providerMode} />
      </div>
    </section>
  );
}
