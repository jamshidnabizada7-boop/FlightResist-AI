/**
 * Print/PDF one-page run summary.
 *
 * Renders ONLY during printing (hidden on screen). Produces a clean,
 * judge-friendly evidence sheet: header + itinerary + disruption + funnel +
 * options + explanation + execution result. Triggered from the header
 * "Print Summary" button via window.print().
 */

import type { CurrentTrip } from '@/hooks/use-flightresist';
import { fmtLocalTime } from '@/lib/flightresist/format';

interface Props {
  trip: CurrentTrip;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[10px] leading-[1.5]">
      <span className="w-[118px] shrink-0 font-semibold text-[#555]">{label}</span>
      <span className="flex-1 text-black">{value}</span>
    </div>
  );
}

export function PrintSummary({ trip }: Props) {
  const a = trip.analysis;
  const exec = trip.execution;
  const disruption = trip.disruption;

  return (
    <div className="hidden print:block" aria-hidden="true">
      {/* Header */}
      <div className="mb-3 border-b-2 border-black pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[16px] font-extrabold tracking-tight text-black">
            FLIGHTRESIST AI 2.0 — Run Summary
          </h1>
          <span className="text-[11px] text-[#555]">{trip.engine_version}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[#555]">
          {trip.trip_id} · trip state {trip.state} · trip risk {trip.risk_score}/100 · {trip.provider.badge}
          {exec ? ` · executed ${exec.status} (${(exec.executionTimeMs / 1000).toFixed(2)}s)` : ''}
        </div>
      </div>

      {/* Itinerary */}
      <div className="mb-2">
        <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">
          1 · Itinerary (SIN → NRT)
        </div>
        {trip.itinerary.legs.map((l) => (
          <Row
            key={l.flightNumber}
            label={`${l.flightNumber} ${l.from}→${l.to}`}
            value={`${fmtLocalTime(l.depIso).time} → ${fmtLocalTime(l.arrIso).time} · ${l.airlineName} · ${
              disruption?.event === 'CANCELLATION' && disruption.flightNumber === l.flightNumber ? 'CANCELLED' : 'as booked'
            }`}
          />
        ))}
        <Row label="Mission" value={trip.itinerary.tripPurpose} />
        <Row
          label="Constraints"
          value={`budget Δ≤$${trip.itinerary.constraints.budgetUsd} · MCT ≥${trip.itinerary.constraints.mctMin}min · arrival ≤ ${fmtLocalTime(trip.itinerary.constraints.hardArrivalLimitIso).time} +1d JST · baggage ≥${trip.itinerary.constraints.baggagePieces}×${trip.itinerary.constraints.baggageWeightKg}kg`}
        />
      </div>

      {/* Disruption */}
      {disruption && (
        <div className="mb-2">
          <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">
            2 · Disruption
          </div>
          <Row
            label="Event"
            value={`${disruption.flightNumber} ${disruption.event}${disruption.delayMinutes ? ` +${disruption.delayMinutes}m` : ''} — ${disruption.reason}`}
          />
          <Row label="Trip impact" value={disruption.detail} />
          {a && (
            <Row
              label="Impact graph"
              value={`risk ${a.impactGraph.riskScore}/100 (${a.impactGraph.severity}) — ${a.impactGraph.nodes.filter((n) => n.status !== 'safe').length}/6 nodes impacted or at-risk`}
            />
          )}
        </div>
      )}

      {/* Funnel */}
      {a && (
        <div className="mb-2">
          <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">
            3 · Decision funnel (deterministic)
          </div>
          <Row
            label="Candidates"
            value={`${a.constraintResult.totalCandidates} searched → ${a.constraintResult.prunedSummary.over_budget} over budget · ${a.constraintResult.prunedSummary.unsafe_connection} unsafe connections · ${a.constraintResult.prunedSummary.baggage_incompatible} baggage-incompatible → ${a.constraintResult.survivors.length} finalists`}
          />
          <Row label="Scoring" value="R = .35·arrival + .25·connection + .20·price + .10·baggage + .10·risk" />
          {a.options.map((o) => (
            <Row
              key={o.id}
              label={`Option ${o.label} (${o.status})`}
              value={`${o.candidate.label} · arrives ${fmtLocalTime(o.candidate.arrIso).time}${fmtLocalTime(o.candidate.arrIso).nextDay ? '+1' : ''} JST · Δ$${o.metrics.fareDiffUsd} · R=${o.recoveryScore} · residual risk ${o.residualRisk}/100`}
            />
          ))}
        </div>
      )}

      {/* Explanation */}
      {a?.explanation && (
        <div className="mb-2">
          <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">
            4 · LLM explanation ({a.explanation.source}, {a.explanation.latencyMs}ms)
          </div>
          <Row label="Headline" value={a.explanation.headline} />
          <Row label="Summary" value={a.explanation.summary} />
        </div>
      )}

      {/* Execution */}
      {exec && (
        <div className="mb-2">
          <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">
            5 · Execution ({exec.status})
          </div>
          <Row
            label="Result"
            value={`order ${exec.orderId ?? '—'} · reference ${exec.demoReference ?? exec.pnr ?? '—'} · pnr ${exec.pnr ?? 'none (demo mode — never fabricated)'} · ${exec.executionTimeMs}ms`}
          />
          {exec.steps.map((s) => (
            <Row key={s.name} label={`  ${s.name}`} value={`${s.detail} (${s.durationMs}ms)`} />
          ))}
        </div>
      )}

      {/* Ledger */}
      {trip.ledger.length > 0 && (
        <div className="mb-2">
          <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">
            6 · Execution ledger (persisted)
          </div>
          {trip.ledger.map((e, i) => (
            <Row
              key={e.id}
              label={`  #${trip.ledger.length - i} ${e.proposalId}`}
              value={`${e.status} · ${e.reference ?? '—'} · ${(e.executionTimeMs / 1000).toFixed(2)}s · ${e.createdAtIso}`}
            />
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-[#999] pt-1 text-[10.5px] leading-[1.5] text-[#555]">
        FlightResist AI 2.0 — Autonomous Travel Recovery Intelligence · Alibaba Cloud × Atlas Agentic AI Hackathon 2026 ·
        All scores/counts computed deterministically; LLM is explanation-only · Simulated references are SIM-* prefixed —
        no PNR/payment fabrication. Printed {new Date().toISOString()}
      </div>
    </div>
  );
}
