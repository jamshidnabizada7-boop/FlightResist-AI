/**
 * FlightResist AI 2.0 — Trip Impact Graph
 *
 * Builds the downstream journey dependency graph and computes a deterministic
 * trip risk score (0..100):
 *
 *     risk = round(100 · Σ weightᵢ · probabilityᵢ)      (weights sum to 1.0)
 *
 * Calibrated node weights (mission-critical meeting dominates):
 *   flight continuity 0.08 · connection integrity 0.06 · arrival punctuality 0.12
 *   hotel check-in 0.10 · ground transfer 0.06 · mission commitment 0.58
 *
 * For the canonical demo disruption this yields exactly 87/100 (CRITICAL).
 * Re-evaluated per recovery candidate it yields residual risks A=71, B=18, C=11.
 */

import type {
  FlightCandidate,
  ImpactChainNarration,
  ImpactEdge,
  ImpactNode,
  Itinerary,
  DisruptionEvent,
  TripImpactGraph,
} from './types';

const WEIGHTS = {
  flight: 0.08,
  connection: 0.06,
  arrival: 0.12,
  hotel: 0.1,
  transfer: 0.06,
  meeting: 0.58,
} as const;

function nodeStatus(p: number): ImpactNode['status'] {
  if (p >= 0.9) return 'impacted';
  if (p >= 0.3) return 'at-risk';
  return 'safe';
}

function nodeSeverity(p: number): ImpactNode['severity'] {
  if (p >= 0.9) return 'critical';
  if (p >= 0.5) return 'high';
  if (p >= 0.2) return 'medium';
  return 'low';
}

function riskSeverity(score: number): TripImpactGraph['severity'] {
  if (score >= 80) return 'CRITICAL';
  if (score >= 40) return 'HIGH';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
}

function buildGraph(
  itinerary: Itinerary,
  probabilities: { flight: number; connection: number; arrival: number; hotel: number; transfer: number; meeting: number },
  summary: string,
): TripImpactGraph {
  const meeting = itinerary.commitments.find((c) => c.kind === 'MEETING');
  const hotel = itinerary.commitments.find((c) => c.kind === 'HOTEL');
  const transfer = itinerary.commitments.find((c) => c.kind === 'TRANSFER');
  const firstLeg = itinerary.legs[0] || { flightNumber: 'FL001', from: itinerary.origin, to: itinerary.destination, arrIso: '' };
  const secondLeg = itinerary.legs[1];
  const lastLeg = itinerary.legs[itinerary.legs.length - 1] || firstLeg;
  const destName = itinerary.destination;
  const missionVenue = itinerary.mission?.venue || itinerary.mission?.location || destName;

  const nodes: ImpactNode[] = [
    {
      id: 'nd-flight',
      kind: 'FLIGHT',
      label: `Flight ${probabilities.flight >= 0.99 ? firstLeg.flightNumber + ' cancelled' : firstLeg.flightNumber + ' continuity'}`,
      detail:
        probabilities.flight >= 0.99
          ? `${firstLeg.flightNumber} ${firstLeg.from}→${firstLeg.to} is cancelled — itinerary root cause.`
          : `Rebooked itinerary departs ${firstLeg.from} on protected inventory.`,
      weight: WEIGHTS.flight,
      probability: probabilities.flight,
      severity: nodeSeverity(probabilities.flight),
      status: nodeStatus(probabilities.flight),
    },
    {
      id: 'nd-connection',
      kind: 'CONNECTION',
      label: secondLeg ? `Connection ${secondLeg.flightNumber} (${secondLeg.from})` : 'Downstream connection',
      detail:
        probabilities.connection >= 0.99
          ? `Hub closure guarantees the ${secondLeg?.flightNumber || 'connecting'} misconnect — protected seat lost.`
          : probabilities.connection >= 0.3
            ? `Tight hub connection — misconnect exposure elevated.`
            : `Connection buffer within safe range (≥ MCT with margin).`,
      weight: WEIGHTS.connection,
      probability: probabilities.connection,
      severity: nodeSeverity(probabilities.connection),
      status: nodeStatus(probabilities.connection),
    },
    {
      id: 'nd-arrival',
      kind: 'ARRIVAL',
      label: `${destName} arrival punctuality`,
      detail:
        probabilities.arrival >= 0.99
          ? `Planned arrival ${fmtTime(lastLeg.arrIso)} is now unreachable.`
          : `Projected arrival slip within tolerance for downstream commitments.`,
      weight: WEIGHTS.arrival,
      probability: probabilities.arrival,
      severity: nodeSeverity(probabilities.arrival),
      status: nodeStatus(probabilities.arrival),
    },
    {
      id: 'nd-hotel',
      kind: 'HOTEL',
      label: hotel?.label ?? 'Hotel check-in',
      detail:
        probabilities.hotel >= 0.9
          ? 'Night-of-stay effectively lost — 0.9 probability of paid-room waste.'
          : probabilities.hotel >= 0.3
            ? 'Late-night check-in stress; room held but rest window compressed.'
            : 'Check-in window preserved.',
      weight: WEIGHTS.hotel,
      probability: probabilities.hotel,
      severity: nodeSeverity(probabilities.hotel),
      status: nodeStatus(probabilities.hotel),
    },
    {
      id: 'nd-transfer',
      kind: 'TRANSFER',
      label: transfer?.label ?? 'Airport transfer',
      detail:
        probabilities.transfer >= 0.9
          ? 'Prepaid chauffeur slot cannot be held — rebooking required.'
          : 'Transfer slot aligns with new arrival.',
      weight: WEIGHTS.transfer,
      probability: probabilities.transfer,
      severity: nodeSeverity(probabilities.transfer),
      status: nodeStatus(probabilities.transfer),
    },
    {
      id: 'nd-meeting',
      kind: 'MEETING',
      label: meeting?.label ?? itinerary.mission?.title ?? 'Mission commitment',
      detail:
        probabilities.meeting >= 0.9
          ? `Arrival cannot clear ${destName} and reach ${missionVenue} in time — mission at stake.`
          : probabilities.meeting >= 0.3
            ? 'Meeting reachable but buffer is thin.'
            : 'Meeting protected with healthy buffer.',
      weight: WEIGHTS.meeting,
      probability: probabilities.meeting,
      severity: nodeSeverity(probabilities.meeting),
      status: nodeStatus(probabilities.meeting),
    },
  ];

  const edges: ImpactEdge[] = [
    { from: 'nd-flight', to: 'nd-connection', label: 'removes' },
    { from: 'nd-connection', to: 'nd-arrival', label: 'delays' },
    { from: 'nd-arrival', to: 'nd-hotel', label: 'check-in window' },
    { from: 'nd-arrival', to: 'nd-transfer', label: 'pickup slot' },
    { from: 'nd-arrival', to: 'nd-meeting', label: 'mission buffer' },
  ];

  const riskScore = Math.round(
    100 *
      (WEIGHTS.flight * probabilities.flight +
        WEIGHTS.connection * probabilities.connection +
        WEIGHTS.arrival * probabilities.arrival +
        WEIGHTS.hotel * probabilities.hotel +
        WEIGHTS.transfer * probabilities.transfer +
        WEIGHTS.meeting * probabilities.meeting),
  );

  // Phase 5: deterministic chain narration
  const chainNarration = deriveChainNarration(nodes, riskScore);

  return {
    nodes,
    edges,
    riskScore,
    severity: riskSeverity(riskScore),
    summary,
    chainNarration,
  };
}

/** Graph for the disrupted itinerary (canonical demo target: 87/100 CRITICAL). */
export function buildDisruptionImpactGraph(itinerary: Itinerary, disruption: DisruptionEvent): TripImpactGraph {
  if (disruption.event === 'DELAY' && typeof disruption.delayMinutes === 'number' && disruption.delayMinutes > 0) {
    return buildDelayGraph(itinerary, disruption);
  }
  const meeting = itinerary.commitments.find((c) => c.kind === 'MEETING') || { label: itinerary.mission?.title || 'Contract signing' };
  return buildGraph(
    itinerary,
    {
      flight: 1.0, // cancellation is certain
      connection: 1.0, // hub closure → misconnect certain
      arrival: 1.0, // planned arrival unreachable
      hotel: 0.9,
      transfer: 1.0,
      meeting: 0.8,
    },
    `Disruption detected on ${disruption.flightNumber} (${disruption.reason}). Downstream graph shows 5 of 6 commitments impacted or at risk; the ${meeting.label} drives 58% of trip value.`,
  );
}

/**
 * Delay-scenario graph — different shape from the cancellation graph:
 * the delayed leg itself stays flyable, but the downstream connection,
 * transfer slot and evening buffer compress proportionally to the delay.
 * Canonical CX520 +45m scenario targets risk 41/100 (HIGH).
 */
function buildDelayGraph(itinerary: Itinerary, disruption: DisruptionEvent): TripImpactGraph {
  const delayMin = disruption.delayMinutes as number;
  const lastLeg = itinerary.legs[itinerary.legs.length - 1];
  const plannedArrMs = new Date(lastLeg.arrIso).getTime();
  const newArrMs = plannedArrMs + delayMin * 60000;
  const meeting = itinerary.commitments.find((c) => c.kind === 'MEETING');
  const meetingMs = meeting ? new Date(meeting.atIso).getTime() : plannedArrMs + 12 * 3600000;
  const transfer = itinerary.commitments.find((c) => c.kind === 'TRANSFER');
  const transferMs = transfer ? new Date(transfer.atIso).getTime() : plannedArrMs;

  const destTz = extractTzOffset(lastLeg.arrIso);

  // Deterministic compression model (fraction of the delay that hits each node).
  const pFlight = clamp(0.15 + delayMin / 600, 0.15, 0.7); // growing departure exposure
  const pConnection = clamp(0.2 + delayMin / 300, 0.2, 0.85);
  const pArrival = clamp(0.35 + delayMin / 240, 0.35, 0.95);
  
  // Hotel: arrival past 20:00 destination local time compresses the rest window; past 22:00 more; after midnight loses the night.
  const pHotel = isAfterLocalHour(newArrMs, destTz, 22) ? 0.9 : isAfterLocalHour(newArrMs, destTz, 20) ? 0.55 : 0.3;
  // Transfer: the prepaid chauffeur slot cannot be held past its pickup time.
  const pTransfer = newArrMs >= transferMs ? 0.75 : 0.25;
  // Meeting: mission buffer thins once the evening rest margin is eaten into.
  const pMeeting = newArrMs > meetingMs - 150 * 60000 ? 0.4 : (meetingMs - newArrMs < 6 * 3600000) ? 0.35 : 0.12;

  // New clock time: planned arrival minute + delay, rendered as HH:MM.
  const plannedMin = Number(/T(\d{2}):(\d{2})/.exec(lastLeg.arrIso)?.[1] ?? 0) * 60 + Number(/T(\d{2}):(\d{2})/.exec(lastLeg.arrIso)?.[2] ?? 0);
  const newTotal = plannedMin + delayMin;
  const newClock = `${String(Math.floor((newTotal / 60) % 24)).padStart(2, '0')}:${String(newTotal % 60).padStart(2, '0')}`;
  const nextDay = newTotal >= 1440;

  return buildGraph(
    itinerary,
    { flight: pFlight, connection: pConnection, arrival: pArrival, hotel: pHotel, transfer: pTransfer, meeting: pMeeting },
    `Delay detected on ${disruption.flightNumber} (+${delayMin}m — ${disruption.reason}). Arrival slips to ${newClock}${nextDay ? ' (+1d)' : ''}; connection, transfer and rest buffers compress but the mission remains recoverable.`,
  );
}

/**
 * Residual risk graph for a candidate recovery itinerary.
 * Deterministic formulas — same node weights as the disruption graph.
 * Canonical finalists evaluate to A=71, B=18, C=11.
 */
export function assessCandidateGraph(itinerary: Itinerary, candidate: FlightCandidate): TripImpactGraph {
  const arrMs = new Date(candidate.arrIso).getTime();
  const meeting = itinerary.commitments.find((c) => c.kind === 'MEETING');
  const meetingMs = meeting ? new Date(meeting.atIso).getTime() : new Date(itinerary.constraints.arrivalDeadlineIso).getTime();
  const meetingReadyMs = meetingMs - 150 * 60000;
  const idealTargetMs = new Date(itinerary.constraints.arrivalDeadlineIso).getTime();
  const destTz = extractTzOffset(candidate.arrIso);

  // --- deterministic per-node probabilities --------------------------------
  // Flight continuity risk from on-time performance of the weakest leg.
  const pFlight = clamp(0.5 * (1 - candidate.otp) + 0.04, 0.02, 0.5);

  // Connection integrity from layover buffer.
  const conn = candidate.minConnectionMin;
  const pConnection = conn === null ? 0.02 : conn >= 180 ? 0.06 : conn >= 90 ? 0.1 + (180 - conn) * 0.001 : 0.3;

  // Arrival punctuality from OTP.
  const pArrival = clamp((1 - candidate.otp) * 0.6, 0.02, 0.5);

  // Hotel: before ideal target → ok; late-night (after 22:00) → compressed rest;
  // arrival next morning → night lost.
  const pHotel = arrMs <= idealTargetMs ? (isAfterLocalHour(arrMs, destTz, 22) ? 0.25 : 0.1) : 0.9;

  // Transfer: prepaid car slot — arrivals after scheduled transfer need a rebook.
  const transfer = itinerary.commitments.find((c) => c.kind === 'TRANSFER');
  const transferSlotMs = transfer ? new Date(transfer.atIso).getTime() : arrMs - 60000;
  const pTransfer = arrMs <= transferSlotMs ? 0.1 : 0.85;

  // Mission: comfortable buffer / thin overnight buffer / can't make it.
  let pMeeting: number;
  if (arrMs <= meetingReadyMs) {
    pMeeting = isAfterLocalHour(arrMs, destTz, 22) ? 0.12 : 0.06;
  } else if (arrMs <= meetingMs) {
    pMeeting = 0.92; // lands before meeting starts but cannot reach venue in time
  } else {
    pMeeting = 1.0;
  }

  return buildGraph(
    itinerary,
    { flight: pFlight, connection: pConnection, arrival: pArrival, hotel: pHotel, transfer: pTransfer, meeting: pMeeting },
    `Residual risk if ${candidate.label} is booked: arrival ${fmtTime(candidate.arrIso)}.`,
  );
}

// ---------------------------------------------------------------------------
// Phase 5: deterministic chain narration (derived from graph nodes)
// ---------------------------------------------------------------------------

function deriveChainNarration(nodes: ImpactNode[], riskScore: number): ImpactChainNarration {
  const kindOrder = ['FLIGHT', 'CONNECTION', 'ARRIVAL', 'HOTEL', 'TRANSFER', 'MEETING'] as const;
  const impacted = nodes.filter((n) => n.status === 'impacted' || n.status === 'at-risk');
  const sorted = [...impacted].sort((a, b) => b.weight * b.probability - a.weight * a.probability);
  const primary = sorted[0] ?? null;

  const rootFailure = nodes.find((n) => n.kind === 'FLIGHT')?.detail ?? 'Primary flight disrupted';

  const cascade: string[] = [];
  for (const kind of kindOrder) {
    const node = nodes.find((n) => n.kind === kind);
    if (node && (node.status === 'impacted' || node.status === 'at-risk') && node.kind !== 'FLIGHT') {
      cascade.push(`${node.label}: ${node.detail}`);
    }
  }

  const primaryConsequence = primary
    ? `${primary.label} (w=${primary.weight.toFixed(2)}, p=${primary.probability.toFixed(2)}) — ${primary.detail}`
    : 'All downstream elements stable';

  const topContributors = sorted.slice(0, 3).map((n) => `${n.label} (${(n.weight * n.probability * 100).toFixed(0)}%)`);
  const riskExplanation =
    riskScore >= 60
      ? `Risk ${riskScore}/100 — driven by ${topContributors.join(', ')}. Causal chain reaches the mission objective.`
      : riskScore >= 30
        ? `Risk ${riskScore}/100 — ${topContributors.join(', ')} under pressure but mission window recoverable.`
        : `Risk ${riskScore}/100 — downstream impacts contained; ${topContributors[0] ?? 'minor adjustments'} manageable.`;

  return { rootFailure, cascade, primaryConsequence, riskExplanation };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** True if the instant is after HH:00 in tz, used for late-night rules. */
function isAfterLocalHour(ms: number, tz: number, hour: number): boolean {
  const local = new Date(ms + tz * 3600000);
  return local.getUTCHours() >= hour;
}

/** Airport-local HH:MM parsed straight from the offset-bearing ISO string (deterministic). */
export function fmtTime(isoStr: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(isoStr);
  return m ? `${m[1]}:${m[2]}` : isoStr;
}

/** Extract timezone offset in hours from ISO 8601 string (e.g. +09:00 -> 9, -04:00 -> -4) */
export function extractTzOffset(isoStr: string): number {
  if (!isoStr) return 0;
  const match = /([+-])(\d{2}):(\d{2})$/.exec(isoStr);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const mins = Number(match[3]);
  return sign * (hours + mins / 60);
}

