/**
 * FlightResist AI 2.0 — State Machine
 *
 * NORMAL → DISRUPTION_DETECTED → ANALYZING → RECOVERY_OPTIONS_READY
 *        → AWAITING_APPROVAL → EXECUTING → RECOVERED
 *                             ↘ FAILED (retry path re-arms AWAITING_APPROVAL)
 */

import type { TripState } from './types';

export const STATE_ORDER: TripState[] = [
  'NORMAL',
  'DISRUPTION_DETECTED',
  'ANALYZING',
  'RECOVERY_OPTIONS_READY',
  'AWAITING_APPROVAL',
  'EXECUTING',
  'RECOVERED',
];

export const STATE_DESCRIPTIONS: Record<TripState, string> = {
  NORMAL: 'Sentinel armed — itinerary monitored, no anomalies.',
  DISRUPTION_DETECTED: 'Inbound disruption webhook received and validated.',
  ANALYZING: 'Impact graph + candidate search + deterministic pruning running.',
  RECOVERY_OPTIONS_READY: 'Ranked recovery options computed and explainable.',
  AWAITING_APPROVAL: 'Human 1-tap approval gate — nothing executes without it.',
  EXECUTING: 'Approved plan executing through the active travel provider.',
  RECOVERED: 'Recovery executed; resulting order state confirmed.',
  FAILED: 'Execution failed — actionable retry path available.',
};

/** Allowed transitions. A transition to EXECUTING requires explicit POST confirmation. */
const TRANSITIONS: Record<TripState, TripState[]> = {
  NORMAL: ['DISRUPTION_DETECTED'],
  DISRUPTION_DETECTED: ['ANALYZING', 'NORMAL'],
  ANALYZING: ['RECOVERY_OPTIONS_READY', 'FAILED'],
  RECOVERY_OPTIONS_READY: ['AWAITING_APPROVAL', 'ANALYZING'],
  AWAITING_APPROVAL: ['EXECUTING', 'ANALYZING'],
  EXECUTING: ['RECOVERED', 'FAILED'],
  RECOVERED: ['NORMAL'],
  FAILED: ['AWAITING_APPROVAL', 'NORMAL'],
};

export function canTransition(from: TripState, to: TripState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(public readonly from: TripState, public readonly to: TripState) {
    super(`Invalid state transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function assertTransition(from: TripState, to: TripState): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/** UI stepper index for a state (FAILED maps to the EXECUTING step visually). */
export function stateStepIndex(state: TripState): number {
  if (state === 'FAILED') return STATE_ORDER.indexOf('EXECUTING');
  return STATE_ORDER.indexOf(state);
}
