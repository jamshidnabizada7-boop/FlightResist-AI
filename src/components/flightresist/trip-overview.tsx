'use client';

import { motion } from 'framer-motion';
import {
  Banknote,
  Briefcase,
  CheckCircle2,
  Clock,
  Gauge,
  Luggage,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  RotateCw,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fmtLocalTime, fmtMinutes } from '@/lib/flightresist/format';
import type { DisruptionEvent, FlightLeg, Itinerary } from '@/lib/flightresist/types';
import { airportTz, timezoneFullName, toLocalTime } from '@/lib/flightresist/time-utils';
import { GLOBAL_AIRPORTS } from '@/lib/flightresist/airports-data';

interface Props {
  itinerary: Itinerary;
  disruption: DisruptionEvent | null;
  /** Legs of the executed recovery option (post-recovery before/after strip). */
  recoveredLegs?: FlightLeg[] | null;
  recoveredLabel?: string | null;
  recoveredArrivalIso?: string | null;
  /** Trigger callback to open the Itinerary Studio modal. */
  onOpenStudio?: () => void;
}

function LegStatus({ leg, disruption }: { leg: Itinerary['legs'][number]; disruption: DisruptionEvent | null }) {
  if (disruption?.flightNumber === leg.flightNumber) {
    return (
      <Badge className="border-red-500/40 bg-red-500/10 text-[10px] font-bold text-red-400 hover:bg-red-500/10">
        CANCELLED
      </Badge>
    );
  }
  const isDownstream = disruption !== null && leg.flightNumber !== disruption.flightNumber;
  if (isDownstream) {
    return (
      <Badge className="border-orange-500/40 bg-orange-500/10 text-[10px] font-bold text-orange-300 hover:bg-orange-500/10">
        MISCONNECT RISK
      </Badge>
    );
  }
  return (
    <Badge className="border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10">
      CONFIRMED
    </Badge>
  );
}

/** Small timezone abbreviation label; hovering shows the full timezone name. */
function TzLabel({ code }: { code: string }) {
  const abbr = airportTz(code);
  if (!abbr) return null;
  return (
    <span className="text-[10px] font-semibold text-zinc-500" title={timezoneFullName(code)}>
      {abbr}
    </span>
  );
}

export function TripOverview({
  itinerary,
  disruption,
  recoveredLegs,
  recoveredLabel,
  recoveredArrivalIso,
  onOpenStudio,
}: Props) {
  const c = itinerary.constraints;
  const firstLeg = itinerary.legs[0];
  const lastLeg = itinerary.legs[itinerary.legs.length - 1];

  const originCity = GLOBAL_AIRPORTS[itinerary.origin]?.city || itinerary.origin;
  const destCity = GLOBAL_AIRPORTS[itinerary.destination]?.city || itinerary.destination;
  const transitHubs = itinerary.legs.slice(0, -1).map((l) => l.to);
  const transitLabel = transitHubs.length > 0 ? `via ${transitHubs.join(', ')}` : 'nonstop';

  const depTime = firstLeg ? fmtLocalTime(firstLeg.depIso) : { time: '08:00', nextDay: false };
  const arrTime = lastLeg ? fmtLocalTime(lastLeg.arrIso) : { time: '19:45', nextDay: false };

  // Calculate total elapsed journey duration
  let durationLabel = `${itinerary.legs.length} legs`;
  if (firstLeg && lastLeg) {
    const totalMin = Math.round(
      (new Date(lastLeg.arrIso).getTime() - new Date(firstLeg.depIso).getTime()) / 60000
    );
    if (totalMin > 0) {
      durationLabel = `${Math.floor(totalMin / 60)}h ${totalMin % 60}m · ${itinerary.legs.length} ${
        itinerary.legs.length === 1 ? 'leg' : 'legs'
      }`;
    }
  }

  // Cancelled legs render struck-through once the disruption lands.
  const isCancelledLeg = (fn: string) => disruption?.flightNumber === fn && disruption?.event === 'CANCELLATION';

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">01 ·</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Active Itinerary</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-500">{itinerary.tripId}</span>
          {onOpenStudio && (
            <button
              type="button"
              onClick={onOpenStudio}
              className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300 transition-all hover:bg-amber-400/20 active:scale-95"
            >
              Itinerary Studio
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Route header */}
        <div className="mb-5 flex items-center justify-center gap-3 sm:gap-6">
          <div className="text-center">
            <div className="font-mono text-2xl font-bold tabular-nums text-zinc-100 sm:text-3xl">{itinerary.origin}</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">{originCity}</div>
          </div>
          <div className="relative flex-1 px-2">
            <div className="flex items-center gap-1.5">
              <PlaneTakeoff className="h-4 w-4 shrink-0 text-zinc-400" />
              <div className="relative h-px flex-1 bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700">
                <motion.span
                  className={`absolute -top-[3px] h-[7px] w-[7px] rounded-full ${disruption ? 'bg-red-400' : 'bg-amber-400'}`}
                  animate={disruption ? { opacity: [1, 0.2, 1] } : { x: ['0%', '100%'] }}
                  transition={disruption ? { duration: 1.2, repeat: Infinity } : { duration: 4, repeat: Infinity, ease: 'linear' }}
                  style={disruption ? undefined : { left: 0 }}
                />
              </div>
              <span className="hidden rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline">
                {transitLabel}
              </span>
              <PlaneLanding className="h-4 w-4 shrink-0 text-zinc-400" />
            </div>
            <div className="mt-1 text-center font-mono text-[10px] text-zinc-500">
              {durationLabel} · dep {depTime.time} <TzLabel code={itinerary.origin} /> → arr {arrTime.time}
              {arrTime.nextDay ? ' +1d' : ''} <TzLabel code={itinerary.destination} />
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl font-bold tabular-nums text-zinc-100 sm:text-3xl">{itinerary.destination}</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">{destCity}</div>
          </div>
        </div>

        {/* Legs */}
        <div className="space-y-3">
          {itinerary.legs.map((leg, i) => {
            const dep = fmtLocalTime(leg.depIso);
            const arr = fmtLocalTime(leg.arrIso);
            const nextLeg = itinerary.legs[i + 1];
            let layoverMin = 0;
            if (nextLeg) {
              layoverMin = Math.round(
                (new Date(nextLeg.depIso).getTime() - new Date(leg.arrIso).getTime()) / 60000
              );
            }
            return (
              <div key={`${leg.flightNumber}-${i}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3">
                  <div className="min-w-[110px]">
                    <div className={`font-mono text-sm font-bold text-zinc-100 ${isCancelledLeg(leg.flightNumber) ? 'line-through decoration-red-400/70' : ''}`}>{leg.flightNumber}</div>
                    <div className="text-[10px] text-zinc-500">{leg.airlineName}</div>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-sm">
                    <span className="text-zinc-100">
                      {dep.time} <TzLabel code={leg.from} />
                    </span>
                    <span className="text-zinc-400">→</span>
                    <span className="text-zinc-100">
                      {arr.time}
                      {arr.nextDay && <sup className="ml-0.5 text-[11px] text-amber-400">+1</sup>} <TzLabel code={leg.to} />
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {leg.from}→{leg.to}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      ({toLocalTime(leg.depIso)} → {toLocalTime(leg.arrIso)} your time)
                    </span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden font-mono text-[10px] text-zinc-500 sm:inline">
                      {fmtMinutes(leg.durationMin)} · {leg.aircraft}
                    </span>
                    <LegStatus leg={leg} disruption={disruption} />
                  </div>
                </div>
                {nextLeg && (
                  <div className="flex items-center justify-center py-1">
                    <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 font-mono text-[10px] text-zinc-500">
                      layover {leg.to} · {Math.floor(layoverMin / 60)}h {layoverMin % 60}m (
                      {layoverMin >= c.mctMin ? `≥ MCT ${c.mctMin}m ✓` : `< MCT ${c.mctMin}m ✗`}
                      )
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Before → After: executed recovery routing strip */}
        {recoveredLegs && recoveredLegs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <RotateCw className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  Recovered routing — executed
                </span>
              </div>
              {recoveredArrivalIso && (
                <span className="font-mono text-[10px] text-zinc-400">
                  arrives {itinerary.destination}{' '}
                  <span className="font-bold text-emerald-300">
                    {fmtLocalTime(recoveredArrivalIso).time}
                    {fmtLocalTime(recoveredArrivalIso).nextDay ? ' +1d' : ''}
                  </span>{' '}
                  <TzLabel code={itinerary.destination} />{' '}
                  <span className="text-zinc-500">({toLocalTime(recoveredArrivalIso)} your time)</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5">
              {recoveredLegs.map((leg, i) => (
                <div key={`${leg.flightNumber}-${i}`} className="flex items-start gap-2">
                  {i > 0 && <span className="mt-1 text-zinc-400">›</span>}
                  <span className="flex flex-col gap-0.5">
                    <span className="rounded-md border border-emerald-500/25 bg-zinc-950/50 px-2 py-1 font-mono text-[10.5px] text-zinc-200">
                      <span className="font-bold text-emerald-300">{leg.flightNumber}</span>{' '}
                      {leg.from} {fmtLocalTime(leg.depIso).time} <TzLabel code={leg.from} /> → {leg.to}{' '}
                      {fmtLocalTime(leg.arrIso).time} <TzLabel code={leg.to} />
                      {fmtLocalTime(leg.arrIso).nextDay && (
                        <sup className="ml-0.5 text-[10.5px] text-amber-400">+1</sup>
                      )}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      ({toLocalTime(leg.depIso)} → {toLocalTime(leg.arrIso)} your time)
                    </span>
                  </span>
                </div>
              ))}
            </div>
            {recoveredLabel && (
              <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-zinc-400">
                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                {recoveredLabel}
              </div>
            )}
          </motion.div>
        )}

        {/* Passenger + purpose */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Passenger</div>
            <div className="mt-1 text-sm font-semibold text-zinc-200">{itinerary.passenger.name}</div>
            <div className="font-mono text-[11px] text-zinc-500">
              {itinerary.passenger.ticketReference} · {itinerary.passenger.loyalty}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                <Briefcase className="h-3 w-3" /> Mission
              </div>
              {itinerary.mission?.dealValue && (
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-300">
                  ${(itinerary.mission.dealValue / 1000000).toFixed(0)}M Deal Value
                </span>
              )}
            </div>
            <div className="mt-1 text-[12px] leading-snug text-zinc-300">{itinerary.tripPurpose}</div>
          </div>
        </div>

        {/* Hard constraints */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            <Gauge className="h-3 w-3" /> Traveler constraints (hard rules for the engine)
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Banknote className="h-3 w-3" /> Budget ceiling
              </div>
              <div className="font-mono text-sm font-bold text-amber-300">${c.budgetUsd}</div>
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Timer className="h-3 w-3" /> MCT floor
              </div>
              <div className="font-mono text-sm font-bold text-zinc-200">{c.mctMin} min</div>
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Clock className="h-3 w-3" /> Required arrival
              </div>
              <div className="font-mono text-sm font-bold text-zinc-200">
                {fmtLocalTime(c.hardArrivalLimitIso).time}
                <span className="text-[10px] text-zinc-500"> +1d</span> <TzLabel code={itinerary.destination} />
              </div>
              <div className="text-[10px] text-zinc-500">({toLocalTime(c.hardArrivalLimitIso)} your time)</div>
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Luggage className="h-3 w-3" /> Baggage min
              </div>
              <div className="font-mono text-sm font-bold text-zinc-200">
                {c.baggagePieces}×{c.baggageWeightKg}kg
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
