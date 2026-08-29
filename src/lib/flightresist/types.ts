import type { TraceActor } from './agents';

/**
 * FlightResist AI 2.0 — Core Type System
 * Deterministic travel-recovery intelligence engine.
 * The deterministic engine is AUTHORITATIVE for hard constraints and scoring.
 * LLM output is explanation-only and can never alter these types' computed values.
 */

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type TripState =
  | 'NORMAL'
  | 'DISRUPTION_DETECTED'
  | 'ANALYZING'
  | 'RECOVERY_OPTIONS_READY'
  | 'AWAITING_APPROVAL'
  | 'EXECUTING'
  | 'RECOVERED'
  | 'FAILED';

export type ProviderMode = 'ATLAS_SANDBOX' | 'DEMO';

export type ExecutionStatus =
  | 'CONFIRMED'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SIMULATED';

// ---------------------------------------------------------------------------
// Itinerary & Profile Models (R1 & R2)
// ---------------------------------------------------------------------------

export interface FlightLeg {
  flightNumber: string;
  airlineCode: string;
  airlineName: string;
  from: string;
  to: string;
  /** ISO 8601 with explicit offset, e.g. 2026-08-27T08:00:00+08:00 */
  depIso: string;
  arrIso: string;
  durationMin: number;
  aircraft: string;
  cabin: string;
}

export interface Layover {
  airport: string;
  minutes: number;
}

export interface PassengerProfile {
  name: string;
  ticketReference: string;
  loyaltyProgram: string;
  loyaltyTier: string;
  loyaltyNumber: string;
  nationality: string; // ISO 3166-1 alpha-2 / country name
  passportNumber?: string;
  passportExpiryIso?: string;
  issuingCountry?: string;
  contactEmail: string;
  contactPhone: string;
  checkedBags: number;
  /** Legacy alias for backward compatibility */
  loyalty: string;
}

export type MissionImportance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface MissionContext {
  title: string;
  description: string;
  venue: string;
  location: string;
  dealValue?: number;
  dealCurrency?: string;
  importance: MissionImportance;
  deadlineIso: string;
  timezone: string;
}

export interface TripConstraints {
  /** Maximum acceptable fare difference vs original booking (USD). */
  budgetUsd: number;
  /** Minimum connection time in minutes (MCT). */
  mctMin: number;
  /** Required arrival deadline — ISO 8601. Hard constraint. */
  arrivalDeadlineIso: string;
  /** Absolute latest arrival that still salvages the trip purpose — ISO 8601. */
  hardArrivalLimitIso: string;
  /** Minimum checked baggage: pieces × kg. */
  baggagePieces: number;
  baggageWeightKg: number;
}

export interface TripCommitment {
  id: string;
  kind: 'MEETING' | 'HOTEL' | 'TRANSFER' | 'EVENT';
  label: string;
  detail: string;
  /** ISO 8601 start of the commitment. */
  atIso: string;
  location: string;
}

export interface Itinerary {
  tripId: string;
  origin: string;
  destination: string;
  travelDateIso: string;
  legs: FlightLeg[];
  passenger: PassengerProfile;
  mission: MissionContext;
  /** Summary or purpose string (legacy backward-compatible alias). */
  tripPurpose: string;
  constraints: TripConstraints;
  commitments: TripCommitment[];
}

export interface PresetItinerary extends Itinerary {
  id: string;
  presetName: string;
  tagline: string;
  routeType: 'DIRECT' | '1_STOP' | 'MULTI_STOP';
  tags: string[];
}

export interface PresetSummary {
  id: string;
  tripId: string;
  name: string;
  origin: string;
  destination: string;
  travelDateIso: string;
  tagline: string;
  routeType: 'DIRECT' | '1_STOP' | 'MULTI_STOP';
  tags: string[];
  legsCount: number;
  primaryAirline: string;
  dealValue?: number;
  dealCurrency?: string;
  budgetUsd: number;
}

export interface SavedItineraryRecord {
  id: string;
  tripId: string;
  name: string;
  origin: string;
  destination: string;
  travelDateIso: string;
  isPreset: boolean;
  presetId: string | null;
  data: string; // JSON: Itinerary
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Disruption
// ---------------------------------------------------------------------------

export type DisruptionType =
  | 'CANCELLATION'
  | 'DELAY'
  | 'DIVERSION'
  | 'TERMINAL_CLOSURE'
  | 'MISCONNECT';

export interface DisruptionEvent {
  flightNumber: string;
  event: DisruptionType;
  reason: string;
  detectedAtIso: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  detail: string;
  /** Delay minutes — present when event = DELAY. */
  delayMinutes?: number;
  /** Affected hub code for terminal/hub disruptions */
  affectedHub?: string;
}

// ---------------------------------------------------------------------------
// Candidates (provider search results)
// ---------------------------------------------------------------------------

export interface CandidateMetadata {
  bookable: boolean;
  priceStatus: 'current' | 'reference';
  ticketingAvailable: boolean;
  ticketingBlocker?: string;
}

export interface FlightCandidate {
  id: string;
  fareKey: string;
  airlineCode: string;
  airlineName: string;
  label: string;
  legs: FlightLeg[];
  layovers: Layover[];
  depIso: string;
  arrIso: string;
  totalDurationMin: number;
  stops: number;
  /** Minimum layover duration in minutes; null for direct flights. */
  minConnectionMin: number | null;
  fareDiffUsd: number;
  baggagePieces: number;
  baggageWeightKg: number;
  seatsLeft: number;
  /** On-time performance 0..1 */
  otp: number;
  /** Finalist metadata for the deterministic demo fixture (not used by engine logic). */
  fixtureClass?: 'over_budget' | 'unsafe_connection' | 'baggage_incompatible' | 'finalist';
  /** Live Atlas provider metadata */
  metadata?: CandidateMetadata;
}

// ---------------------------------------------------------------------------
// Trip Impact Graph
// ---------------------------------------------------------------------------

export type ImpactNodeKind =
  | 'FLIGHT'
  | 'CONNECTION'
  | 'ARRIVAL'
  | 'HOTEL'
  | 'TRANSFER'
  | 'MEETING';

export interface ImpactNode {
  id: string;
  kind: ImpactNodeKind;
  label: string;
  detail: string;
  /** Weight in overall trip risk (sums to 1.0 across nodes). */
  weight: number;
  /** Probability the node's commitment is damaged 0..1. */
  probability: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'impacted' | 'at-risk' | 'safe';
}

export interface ImpactEdge {
  from: string;
  to: string;
  label: string;
}

export interface TripImpactGraph {
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  /** 0..100 deterministic trip risk score. */
  riskScore: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  /** Phase 5: causal chain narration — what broke → what cascaded → what matters. */
  chainNarration: ImpactChainNarration;
}

/** Phase 5: structured causal narration of the disruption chain. */
export interface ImpactChainNarration {
  /** What failed first (the root disruption). */
  rootFailure: string;
  /** Downstream dependencies affected, in causal order. */
  cascade: string[];
  /** The single most critical downstream consequence. */
  primaryConsequence: string;
  /** Why the trip risk score is at its current level. */
  riskExplanation: string;
}

// ---------------------------------------------------------------------------
// Constraint funnel
// ---------------------------------------------------------------------------

export type PruneReason =
  | 'misses_deadline'
  | 'over_budget'
  | 'unsafe_connection'
  | 'baggage_incompatible';

export interface FunnelStage {
  reason: PruneReason;
  label: string;
  rule: string;
  removed: number;
  remaining: number;
  removedIds: string[];
}

export interface ConstraintResult {
  survivors: FlightCandidate[];
  funnel: FunnelStage[];
  prunedSummary: Record<PruneReason, number>;
  totalCandidates: number;
}

// ---------------------------------------------------------------------------
// Optimizer
// ---------------------------------------------------------------------------

export interface SubScores {
  arrival: number;
  connection: number;
  price: number;
  baggage: number;
  risk: number;
}

export interface ScoredOption {
  id: 'opt_a' | 'opt_b' | 'opt_c';
  label: 'A' | 'B' | 'C';
  candidate: FlightCandidate;
  scores: SubScores;
  /** Multi-criteria recovery score R (0..100, higher is better). */
  recoveryScore: number;
  /** Residual trip risk if this option is taken (0..100, lower is better). */
  residualRisk: number;
  residualGraph: TripImpactGraph;
  status: 'RECOMMENDED' | 'SECONDARY' | 'REJECTED' | 'ALTERNATIVE';
  reason: string;
  /** Phase 5: deterministic structured facts explaining why this option got its status.
   *  Populated by the Why Engine in the pipeline after ranking. */
  why?: OptionWhy;
  metrics: {
    delayHours: number;
    fareDiffUsd: number;
    arrivalIso: string;
    departureIso: string;
    connectionMin: number | null;
    stops: number;
    makesMeeting: boolean;
  };
}

/** Phase 5: structured deterministic facts per option (the "Why Engine"). */
export interface OptionWhy {
  /** Deterministic reasons this option was rejected or lost ranking. */
  whyRejected: string[];
  /** Deterministic reasons this option was recommended. */
  whyRecommended: string[];
  /** Trade-off facts vs the best option. */
  tradeoffs: string[];
  /** Journey elements preserved by this option. */
  preservedJourneyElements: string[];
  /** Remaining risks if this option is chosen. */
  remainingRisks: string[];
  /** One-line deterministic verdict. */
  verdict: string;
}

/** Weights per master spec: R = .35·S_arr + .25·S_conn + .20·S_price + .10·S_bag + .10·S_risk */
export const RECOVERY_WEIGHTS = {
  arrival: 0.35,
  connection: 0.25,
  price: 0.2,
  baggage: 0.1,
  risk: 0.1,
} as const;

// ---------------------------------------------------------------------------
// LLM explanation (explanation-only layer)
// ---------------------------------------------------------------------------

export interface LlmExplanation {
  headline: string;
  summary: string;
  tradeoffs: { option: string; verdict: string; text: string }[];
  confidenceNote: string;
  source: 'LLM' | 'TEMPLATE';
  model: string;
  latencyMs: number;
  /** Phase 5: compact deterministic fact payload the LLM received (evidence for judges). */
  factPayload: LlmFactPayload;
}

/** Phase 5: compact deterministic fact payload sent to the LLM reasoner. */
export interface LlmFactPayload {
  recommended: string;
  score: number;
  fareDiff: number;
  delayHours: number;
  meetingPreserved: boolean;
  budgetPass: boolean;
  connectionPass: boolean;
  residualRisk: number;
  alternatives: {
    label: string;
    score: number;
    fareDiff: number;
    delayHours: number;
    makesMeeting: boolean;
    residualRisk: number;
    status: string;
  }[];
  impactsResolved: string[];
  impactsRemaining: string[];
}

// ---------------------------------------------------------------------------
// Agent event stream (SSE)
// ---------------------------------------------------------------------------

export type AgentEventLevel = 'info' | 'success' | 'warn' | 'critical' | 'agent';

export interface AgentEvent {
  seq: number;
  phase: 'SENTINEL' | 'DISRUPTION' | 'ANALYSIS' | 'SEARCH' | 'CONSTRAINTS' | 'OPTIMIZATION' | 'REASONING' | 'APPROVAL' | 'EXECUTION' | 'RECOVERY';
  step: string;
  title: string;
  details: string;
  level: AgentEventLevel;
  /** Phase 4: which agentic responsibility (or deterministic engine) produced this event. */
  agent?: TraceActor;
  timestamp: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Analysis & execution results
// ---------------------------------------------------------------------------

export interface RecoveryAnalysis {
  disruption: DisruptionEvent;
  impactGraph: TripImpactGraph;
  constraintResult: ConstraintResult;
  options: ScoredOption[];
  recommendedId: 'opt_a' | 'opt_b' | 'opt_c';
  explanation: LlmExplanation | null;
  analyzedAtIso: string;
  totalAnalysisMs: number;
}

export interface ExecutionStep {
  name: string;
  status: 'ok' | 'failed';
  durationMs: number;
  detail: string;
}

export interface ExecutionResult {
  status: ExecutionStatus;
  providerMode: ProviderMode;
  proposalId: string;
  orderId: string | null;
  pnr: string | null;
  demoReference: string | null;
  fareKey: string | null;
  state: TripState;
  executionTimeMs: number;
  steps: ExecutionStep[];
  completedAtIso: string;
  error: string | null;
}

export interface ProviderInfo {
  mode: ProviderMode;
  badge: string;
  label: string;
  probeDetail: string;
}

export interface TripSessionSnapshot {
  tripId: string;
  state: TripState;
  itinerary: Itinerary;
  riskScore: number;
  disruption: DisruptionEvent | null;
  analysis: RecoveryAnalysis | null;
  execution: ExecutionResult | null;
  provider: ProviderInfo;
  events: AgentEvent[];
  ledger: LedgerEntry[];
  engineVersion: string;
}

export interface LedgerEntry {
  id: string;
  proposalId: string;
  status: string;
  reference: string | null;
  executionTimeMs: number;
  createdAtIso: string;
}
