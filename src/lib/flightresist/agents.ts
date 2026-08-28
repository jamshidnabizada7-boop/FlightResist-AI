/**
 * FlightResist AI 2.0 — Agent Responsibility Definitions
 *
 * Four agentic responsibilities are defined. Each is a thin orchestration or
 * explanation layer over the deterministic engine. NO agent may modify scores,
 * rankings, constraint results, or state-machine transitions.
 *
 *   SUPERVISOR         — orchestrates workflow, reacts to disruption, manages approval gate
 *   IMPACT_REASONER    — interprets the deterministic Trip Impact Graph, explains consequences
 *   TRADE_OFF_EXPLAINER — explains why the ranking selected the recommended option
 *   TOOL_ORCHESTRATOR   — invokes BaseTravelProvider, preserves provider responses
 *
 * Deterministic boundaries (NOT agents):
 *   DETERMINISTIC_ENGINE — hard constraint filtering, multi-criteria scoring, ranking
 */

/**
 * Agent responsibility identifiers.
 * The SSE trace labels every event with its responsible agent so judges and
 * operators can follow which agentic layer is acting at each step.
 */
export type AgentResponsibility =
  | 'SUPERVISOR'
  | 'IMPACT_REASONER'
  | 'TRADE_OFF_EXPLAINER'
  | 'TOOL_ORCHESTRATOR';

/**
 * Labels for deterministic-engine operations that are authoritative, not agentic.
 * These appear in the trace alongside agent labels to make the boundary explicit.
 */
export type EngineLabel = 'DETERMINISTIC_ENGINE' | 'OPTIMIZER';

/**
 * Union of all responsibility sources — agents (orchestration/explanation) and
 * the deterministic engine (computation). The trace uses these to disambiguate
 * "who did what" at every step.
 */
export type TraceActor = AgentResponsibility | EngineLabel;

/**
 * Safety invariants — documented as code for judge Q&A.
 *
 * These are NOT enforced at runtime by guards (the architecture itself
 * prevents violation — agents never touch score/ranking code paths).
 * They are recorded here so the boundaries are self-documenting.
 */
export const AGENT_INVARIANTS = {
  SUPERVISOR: [
    'Orchestrates the recovery workflow from disruption to execution.',
    'Reacts to the disruption event and initiates impact analysis.',
    'Requests candidate generation through the Tool Orchestrator.',
    'Invokes deterministic evaluation (constraints + scoring).',
    'Requests trade-off explanation from the Trade-Off Explainer.',
    'Waits for explicit human approval before any side effect.',
    'Invokes provider execution through the Tool Orchestrator after approval.',
    'MUST NOT calculate scores or bypass state-machine authorization.',
  ],
  IMPACT_REASONER: [
    'Interprets the deterministic Trip Impact Graph.',
    'Explains downstream consequences (WHAT BROKE, WHAT IT AFFECTS).',
    'Uses ONLY facts supplied by the deterministic graph.',
    'MUST NOT invent risk values, probabilities, or weights.',
  ],
  TRADE_OFF_EXPLAINER: [
    'Explains why the deterministic ranking selected the recommended option.',
    'Explains why losing options lost (constraint pruning, score deficits).',
    'References ONLY actual numeric facts from the engine.',
    'MUST NOT perform arithmetic or alter ranking.',
  ],
  TOOL_ORCHESTRATOR: [
    'Invokes verified provider capabilities through BaseTravelProvider.',
    'Uses AtlasSandboxProvider when Atlas is active.',
    'Uses DemoProvider when Demo is active.',
    'Preserves real provider responses and identifiers.',
    'MUST NOT expose unsupported Atlas operations.',
    'MUST NOT bypass the approval gate.',
  ],
} as const;

/**
 * Short human-readable description for each responsibility.
 * Used in documentation and the Phase 4 validation report.
 */
export const AGENT_DESCRIPTION: Record<AgentResponsibility, string> = {
  SUPERVISOR:
    'Orchestrates the recovery workflow — reacts to disruption, requests analysis, invokes deterministic evaluation, manages the approval gate, and triggers execution.',
  IMPACT_REASONER:
    'Interprets the deterministic Trip Impact Graph — explains what broke and what it affects, using only graph-supplied facts.',
  TRADE_OFF_EXPLAINER:
    'Explains the deterministic ranking — why the recommended option won and why others lost, quoting engine-computed numbers only.',
  TOOL_ORCHESTRATOR:
    'Invokes the active travel provider — search, fare verification, order creation, payment, and status through BaseTravelProvider.',
};
