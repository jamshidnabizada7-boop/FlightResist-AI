/**
 * FlightResist AI 2.0 — Deterministic Why Engine (Phase 5)
 *
 * Generates structured causal facts for each finalist option and
 * a compact fact payload for the LLM reasoner.  ALL values derive from
 * the deterministic optimizer, constraint engine, and impact graph —
 * no LLM, no randomness, no invention.
 *
 * The LLM receives ONLY the fact payload produced here; it may explain
 * and compare but never calculate or rank.
 */

import { ORIGINAL_ARRIVAL_ISO, NRT_TO_MEETING_MIN } from './itinerary';
import type {
  FlightCandidate,
  ImpactChainNarration,
  Itinerary,
  LlmFactPayload,
  OptionWhy,
  ScoredOption,
  TripImpactGraph,
} from './types';

// ---------------------------------------------------------------------------
// Option Why — structured deterministic facts per option
// ---------------------------------------------------------------------------

const round1 = (v: number) => Math.round(v * 10) / 10;

export function buildOptionWhy(
  option: ScoredOption,
  bestOption: ScoredOption,
  itinerary: Itinerary,
): OptionWhy {
  const c = option.candidate;
  const best = bestOption.candidate;
  const m = option.metrics;

  const originalArrMs = new Date(ORIGINAL_ARRIVAL_ISO).getTime();
  const arrMs = new Date(c.arrIso).getTime();
  const meeting = itinerary.commitments.find((cm) => cm.kind === 'MEETING');
  const meetingMs = meeting ? new Date(meeting.atIso).getTime() : 0;
  const meetingReadyMs = meetingMs - NRT_TO_MEETING_MIN * 60000;
  const budgetLeft = itinerary.constraints.budgetUsd - c.fareDiffUsd;
  const meetsBudget = c.fareDiffUsd <= itinerary.constraints.budgetUsd;
  const meetsMct = c.minConnectionMin === null || c.minConnectionMin >= itinerary.constraints.mctMin;
  const meetsBaggage = c.baggagePieces >= itinerary.constraints.baggagePieces && c.baggageWeightKg >= itinerary.constraints.baggageWeightKg;

  const whyRecommended: string[] = [];
  const whyRejected: string[] = [];
  const tradeoffs: string[] = [];
  const preserved: string[] = [];
  const risks: string[] = [];

  // -- Build universal facts ------------------------------------------------

  // Meeting preservation
  if (m.makesMeeting) {
    const bufferHrs = Math.max(1, Math.round((meetingReadyMs - arrMs) / 3600000));
    if (meeting) {
      preserved.push(`${meeting.label} — ${bufferHrs}h buffer`);
      whyRecommended.push(`Preserves ${meeting.label} with ${bufferHrs}h margin`);
    }
  } else {
    whyRejected.push(`Arrival ${fmtArr(c.arrIso)} cannot clear NRT → Marunouchi in time for ${meeting?.label ?? 'meeting'}`);
    risks.push('Mission objective lost — contract signing missed');
  }

  // Budget
  if (meetsBudget) {
    preserved.push(`Within $${itinerary.constraints.budgetUsd} rebooking budget ($${Math.max(0, Math.round(budgetLeft))} headroom)`);
  } else {
    whyRejected.push(`+$${c.fareDiffUsd} fare difference exceeds $${itinerary.constraints.budgetUsd} budget by $${c.fareDiffUsd - itinerary.constraints.budgetUsd}`);
  }

  // Connection
  if (meetsMct) {
    if (c.minConnectionMin === null) preserved.push('Direct flight — no connection risk');
    else preserved.push(`Connection ≥ ${itinerary.constraints.mctMin}min (${c.minConnectionMin}min layover)`);
  } else {
    whyRejected.push(`Unsafe connection: ${c.minConnectionMin}min < ${itinerary.constraints.mctMin}min MCT`);
    risks.push('Tight connection — misconnect risk elevated');
  }

  // Baggage
  if (meetsBaggage) {
    preserved.push(`Baggage ${c.baggagePieces}×${c.baggageWeightKg}kg meets requirement`);
  } else {
    whyRejected.push(`Baggage incompatible: ${c.baggagePieces}×${c.baggageWeightKg}kg < required ${itinerary.constraints.baggagePieces}×${itinerary.constraints.baggageWeightKg}kg`);
  }

  // Arrival delay
  const delayH = round1(Math.max(0, (arrMs - originalArrMs) / 3600000));
  if (delayH <= 3) {
    whyRecommended.push(`Minimal arrival delay: +${delayH}h`);
  } else if (delayH <= 8) {
    tradeoffs.push(`+${delayH}h arrival delay vs original plan`);
  } else {
    whyRejected.push(`Excessive arrival delay: +${delayH}h`);
  }

  // Residual risk
  if (option.residualRisk <= 25) {
    whyRecommended.push(`Low residual trip risk: ${option.residualRisk}/100`);
  } else if (option.residualRisk <= 50) {
    tradeoffs.push(`Moderate residual risk: ${option.residualRisk}/100`);
  } else {
    risks.push(`High residual risk: ${option.residualRisk}/100`);
  }

  // Hotel / transfer preservation from residual graph
  const hotelNode = option.residualGraph.nodes.find((n) => n.kind === 'HOTEL');
  const transferNode = option.residualGraph.nodes.find((n) => n.kind === 'TRANSFER');
  if (hotelNode?.status === 'safe') preserved.push('Hotel check-in preserved');
  else if (hotelNode?.status === 'at-risk') tradeoffs.push('Hotel check-in at risk — late arrival may compress rest');
  if (transferNode?.status === 'safe') preserved.push('Airport transfer preserved');
  else if (transferNode?.status === 'at-risk') tradeoffs.push('Prepaid transfer slot may need rebooking');

  // -- Compare to best option (trade-offs for non-recommended) ---------------
  if (option.id !== bestOption.id) {
    const scoreDelta = round1(bestOption.recoveryScore - option.recoveryScore);
    const fareDelta = c.fareDiffUsd - best.fareDiffUsd;
    tradeoffs.push(`R=${option.recoveryScore} vs recommended R=${bestOption.recoveryScore} (Δ${scoreDelta})`);
    if (fareDelta > 0) tradeoffs.push(`+$${fareDelta} more expensive than recommended option`);
    else if (fareDelta < 0) tradeoffs.push(`$${Math.abs(fareDelta)} cheaper but weaker overall score`);
  }

  // -- Status-specific verdict -----------------------------------------------
  let verdict: string;
  if (option.status === 'RECOMMENDED') {
    const topStrengths = whyRecommended.slice(0, 2).join(', ');
    verdict = `Best journey preservation: ${topStrengths}`;
  } else if (option.status === 'SECONDARY') {
    verdict = `Strong alternative but ${tradeoffs.length > 0 ? tradeoffs[0] : 'dominated on multiple criteria'}`;
  } else if (option.status === 'ALTERNATIVE') {
    verdict = whyRejected.length > 0
      ? `Viable alternative: ${whyRejected[0]}`
      : `Weakest recovery score R=${option.recoveryScore} but still passes all hard constraints`;
  } else {
    verdict = whyRejected.length > 0
      ? `Rejected: ${whyRejected[0]}`
      : `Weakest recovery score R=${option.recoveryScore}`;
  }

  return {
    whyRejected,
    whyRecommended,
    tradeoffs,
    preservedJourneyElements: preserved,
    remainingRisks: risks,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Impact Chain Narration — what broke → what cascaded → what matters
// ---------------------------------------------------------------------------

export function buildChainNarration(graph: TripImpactGraph): ImpactChainNarration {
  // Sort by weight descending to find the heaviest impacted node
  const impacted = graph.nodes.filter((n) => n.status === 'impacted' || n.status === 'at-risk');
  const sorted = [...impacted].sort((a, b) => b.weight * b.probability - a.weight * a.probability);
  const primary = sorted[0] ?? null;

  const rootFailure = graph.nodes.find((n) => n.kind === 'FLIGHT')?.detail ?? 'Primary flight disrupted';

  const cascade: string[] = [];
  // Walk through nodes in causal order (graph already orders: FLIGHT→CONNECTION→ARRIVAL→HOTEL→TRANSFER→MEETING)
  const kindOrder = ['FLIGHT', 'CONNECTION', 'ARRIVAL', 'HOTEL', 'TRANSFER', 'MEETING'];
  for (const kind of kindOrder) {
    const node = graph.nodes.find((n) => n.kind === kind);
    if (node && (node.status === 'impacted' || node.status === 'at-risk')) {
      cascade.push(`${node.label}: ${node.detail}`);
    }
  }

  const primaryConsequence = primary
    ? `${primary.label} (w=${primary.weight.toFixed(2)}, p=${primary.probability.toFixed(2)}) — ${primary.detail}`
    : 'All downstream elements stable';

  // Build risk explanation
  const topContributors = sorted.slice(0, 3).map((n) => `${n.label} (${(n.weight * n.probability * 100).toFixed(0)}%)`);
  const riskExplanation =
    graph.riskScore >= 60
      ? `Risk ${graph.riskScore}/100 — driven by ${topContributors.join(', ')}. Causal chain from cancellation reaches the mission objective.`
      : graph.riskScore >= 30
        ? `Risk ${graph.riskScore}/100 — ${topContributors.join(', ')} under pressure but mission window recoverable.`
        : `Risk ${graph.riskScore}/100 — downstream impacts contained; ${topContributors[0] ?? 'minor adjustments'} manageable.`;

  return { rootFailure, cascade, primaryConsequence, riskExplanation };
}

// ---------------------------------------------------------------------------
// LLM Fact Payload — compact deterministic payload for the LLM reasoner
// ---------------------------------------------------------------------------

export function buildFactPayload(
  options: ScoredOption[],
  graph: TripImpactGraph,
  itinerary: Itinerary,
): LlmFactPayload {
  const recommended = options.find((o) => o.status === 'RECOMMENDED') ?? options[0];
  const rc = recommended.candidate;

  const originalArrMs = new Date(ORIGINAL_ARRIVAL_ISO).getTime();
  const arrMs = new Date(rc.arrIso).getTime();
  const delayHours = round1(Math.max(0, (arrMs - originalArrMs) / 3600000));
  const meetsBudget = rc.fareDiffUsd <= itinerary.constraints.budgetUsd;
  const meetsMct = rc.minConnectionMin === null || rc.minConnectionMin >= itinerary.constraints.mctMin;

  // Impacts resolved = nodes that go from impacted in disruption graph to safe in residual
  const impactsResolved: string[] = [];
  const impactsRemaining: string[] = [];
  for (const node of recommended.residualGraph.nodes) {
    if (node.status === 'safe') impactsResolved.push(node.label);
    else impactsRemaining.push(`${node.label} (${node.status})`);
  }

  return {
    recommended: recommended.label,
    score: recommended.recoveryScore,
    fareDiff: rc.fareDiffUsd,
    delayHours,
    meetingPreserved: recommended.metrics.makesMeeting,
    budgetPass: meetsBudget,
    connectionPass: meetsMct,
    residualRisk: recommended.residualRisk,
    alternatives: options
      .filter((o) => o.id !== recommended.id)
      .map((o) => ({
        label: o.label,
        score: o.recoveryScore,
        fareDiff: o.candidate.fareDiffUsd,
        delayHours: o.metrics.delayHours,
        makesMeeting: o.metrics.makesMeeting,
        residualRisk: o.residualRisk,
        status: o.status,
      })),
    impactsResolved,
    impactsRemaining,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtArr(iso: string): string {
  const m = /T(\d{2}:\d{2})/.exec(iso);
  const day = iso.startsWith('2026-08-28') ? ' (+1d)' : '';
  return (m ? m[1] : iso) + day;
}
