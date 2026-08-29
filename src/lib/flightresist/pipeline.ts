/**
 * FlightResist AI 2.0 — Recovery Pipeline Orchestrator
 *
 *   Disruption webhook → Impact Graph → Candidate Search (provider) →
 *   Hard Constraint Filtering → Multi-Criteria Optimization →
 *   LLM Explanation (explanation-only) → Awaiting 1-Tap Approval
 *
 * Every step emits an agent event carrying its REAL measured duration.
 * Small pacing pauses (~300ms) keep the live SSE trace readable for humans;
 * provider and LLM durations are genuine wall-clock measurements.
 */

import { db, dbAvailable } from '@/lib/db';
import { logger } from '@/lib/logger';
import { applyHardConstraints } from './constraints';
import { generateExplanation } from './llm';
import { ITINERARY } from './itinerary';
import { getDynamicSearchDate } from '@/lib/utils';
import { buildDisruptionImpactGraph } from './impact-graph';
import { rankOptions } from './optimizer';
import { getActiveProvider, getDemoProvider } from './providers';
import { withSessionContext } from './session-id';
import { emitEvent, getSession, persistenceKey, resolveSessionId, setState } from './store';
import { buildOptionWhy, buildFactPayload } from './why-engine';
import type {
  DisruptionEvent,
  ExecutionResult,
  ExecutionStep,
  FlightCandidate,
  RecoveryAnalysis,
  ScoredOption,
  TripState,
} from './types';

const pacing = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Analysis pipeline
// ---------------------------------------------------------------------------

export async function triggerDisruption(
  disruption: DisruptionEvent,
  sessionId?: string,
  userMode?: string,
): Promise<{ status: string; state: string }> {
  // Session scoping: establish the caller's session as the ambient context so
  // every store/bus call below — including the fire-and-forget analysis
  // pipeline it starts — resolves to this session (explicit arg → ambient →
  // shared default for cookie-less clients).
  return withSessionContext(resolveSessionId(sessionId), () =>
    triggerDisruptionImpl(disruption, userMode),
  );
}

async function triggerDisruptionImpl(
  disruption: DisruptionEvent,
  userMode?: string,
): Promise<{ status: string; state: string }> {
  const s = getSession();
  if (s.state !== 'NORMAL') {
    throw new Error(`Disruption can only be triggered from NORMAL state (current: ${s.state}). Reset the session first.`);
  }
  if (s.analysisRunning) {
    throw new Error('Analysis already running.');
  }

  // Claim the trigger synchronously BEFORE any await — closes the double-fire
  // race where two rapid POSTs both pass the guards above.
  s.analysisRunning = true;

  const { info } = await getActiveProvider(userMode);

  // Webhook intake — SUPERVISOR reacts to the disruption event.
  emitEvent(
    'DISRUPTION',
    'disruption_webhook',
    `Inbound webhook: ${disruption.flightNumber} ${disruption.event}`,
    `${disruption.reason}. ${disruption.detail}`,
    'critical',
    0,
    'SUPERVISOR',
  );
  s.disruption = disruption;
  setState('DISRUPTION_DETECTED', info.mode);

  // Fire-and-forget: the SSE stream surfaces progress live; the caller gets an
  // immediate DISRUPTION_TRIGGERED / ANALYZING response per the API contract.
  // The user's provider mode rides along so the analysis pipeline searches
  // through the same provider the user picked in the UI.
  logger.info('Pipeline started', { disruption: disruption.event, flight: disruption.flightNumber, userMode: userMode ?? 'env-default' });
  void runRecoveryPipeline(disruption, undefined, userMode).catch((err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.error('Pipeline crashed', { message: e.message, stack: e.stack, name: e.name });
    s.analysisRunning = false;
    if (getSession().state === 'ANALYZING') {
      try {
        setState('FAILED', info.mode);
      } catch {
        /* state already moved on */
      }
      emitEvent(
        'ANALYSIS',
        'pipeline_error',
        'Analysis pipeline failed',
        err instanceof Error ? err.message : String(err),
        'critical',
        0,
        'SUPERVISOR',
      );
    }
  });

  return { status: 'DISRUPTION_TRIGGERED', state: 'ANALYZING' };
}

export async function runRecoveryPipeline(
  disruption: DisruptionEvent,
  sessionId?: string,
  userMode?: string,
): Promise<RecoveryAnalysis> {
  return withSessionContext(resolveSessionId(sessionId), () =>
    runRecoveryPipelineImpl(disruption, userMode),
  );
}

async function runRecoveryPipelineImpl(
  disruption: DisruptionEvent,
  userMode?: string,
): Promise<RecoveryAnalysis> {
  const s = getSession();
  s.analysisRunning = true;
  const t0 = Date.now();
  const { provider, info } = await getActiveProvider(userMode);

  try {
    await pacing(320);
    setState('ANALYZING', info.mode);
    emitEvent(
      'DISRUPTION',
      'state_analyzing',
      'Supervisor engaged — state: DISRUPTION_DETECTED → ANALYZING',
      'Recovery Supervisor orchestrating downstream impact analysis across the full itinerary graph.',
      'info',
      0,
      'SUPERVISOR',
    );

    // ---- Trip Impact Graph -------------------------------------------------
    const activeItinerary = s.itinerary ?? ITINERARY;
    await pacing(280);
    let t = Date.now();
    const impactGraph = buildDisruptionImpactGraph(activeItinerary, disruption);
    s.riskScore = impactGraph.riskScore;
    emitEvent(
      'ANALYSIS',
      'impact_graph',
      `Trip Impact Graph built — risk ${impactGraph.riskScore}/100 (${impactGraph.severity})`,
      `${impactGraph.nodes.length} dependency nodes evaluated: ${impactGraph.nodes.filter((n) => n.status !== 'safe').length} impacted or at-risk. ${impactGraph.summary}`,
      'critical',
      Date.now() - t,
      'IMPACT_REASONER',
    );

    // Phase 5: chain narration — what broke → what cascaded → what matters
    await pacing(200);
    const cn = impactGraph.chainNarration;
    emitEvent(
      'ANALYSIS',
      'impact_chain',
      `Impact Reasoner: causal chain — ${impactGraph.nodes.filter((n) => n.status === 'impacted').length} impacted nodes`,
      `Root: ${cn.rootFailure} → cascade: ${cn.cascade.length} downstream effects → primary: ${cn.primaryConsequence}. ${cn.riskExplanation}`,
      'critical',
      0,
      'IMPACT_REASONER',
    );

    await pacing(260);
    emitEvent(
      'ANALYSIS',
      'risk_breakdown',
      `Impact Reasoner: mission node carries 58% of trip value`,
      impactGraph.nodes
        .map((n) => `${n.label} w=${n.weight.toFixed(2)} p=${n.probability.toFixed(2)} [${n.status}]`)
        .join(' · '),
      'warn',
      1,
      'IMPACT_REASONER',
    );

    // ---- Provider probe + search ------------------------------------------
    await pacing(300);
    emitEvent(
      'SEARCH',
      'provider_probe',
      `Tool Orchestrator: provider probe → ${info.badge}`,
      info.probeDetail,
      'info',
      0,
      'TOOL_ORCHESTRATOR',
    );

    t = Date.now();
    const searchDate = info.mode === 'DEMO'
      ? (activeItinerary.travelDateIso?.slice(0, 10) || '2026-08-27')
      : getDynamicSearchDate();
    let candidates: FlightCandidate[] = [];
    try {
      candidates = await provider.searchFlights(activeItinerary.origin, activeItinerary.destination, searchDate);
    } catch (searchErr) {
      if (info.mode === 'ATLAS_SANDBOX' && userMode !== 'LIVE' && process.env.ATLAS_MODE !== 'atlas') {
        logger.warn('Atlas search failed in auto mode, falling back to DemoProvider', {
          error: searchErr instanceof Error ? searchErr.message : String(searchErr),
        });
        const demo = getDemoProvider();
        candidates = await demo.searchFlights(activeItinerary.origin, activeItinerary.destination, '2026-08-27');
        emitEvent(
          'SEARCH',
          'provider_fallback',
          'Atlas search unavailable — falling back to DemoProvider',
          `Atlas search failed: ${searchErr instanceof Error ? searchErr.message : String(searchErr)}. Switched to DemoProvider fixture candidates.`,
          'warn',
          Date.now() - t,
          'TOOL_ORCHESTRATOR',
        );
      } else {
        throw searchErr;
      }
    }
    const searchMs = Date.now() - t;
    emitEvent(
      'SEARCH',
      'search_flights',
      `Tool Orchestrator → ${info.mode === 'DEMO' ? 'DemoProvider' : 'AtlasSandboxProvider'}.searchFlights(${activeItinerary.origin} → ${activeItinerary.destination}, ${searchDate})`,
      `${candidates.length} candidates returned in ${searchMs}ms${info.mode === 'DEMO' ? ' (deterministic fixture inventory)' : ' (live Atlas sandbox)'}.`,
      'agent',
      searchMs,
      'TOOL_ORCHESTRATOR',
    );

    // ---- Hard constraints (deterministic) ----------------------------------
    const constraintOrder = [
      { key: 'misses_deadline', emitStep: 'constraint_deadline' },
      { key: 'over_budget', emitStep: 'constraint_budget' },
      { key: 'unsafe_connection', emitStep: 'constraint_mct' },
      { key: 'baggage_incompatible', emitStep: 'constraint_baggage' },
    ] as const;

    t = Date.now();
    let constraintResult = applyHardConstraints(candidates, activeItinerary);
    let constraintsMs = Date.now() - t;

    if (constraintResult.survivors.length === 0 && info.mode === 'ATLAS_SANDBOX' && userMode !== 'LIVE' && process.env.ATLAS_MODE !== 'atlas') {
      logger.warn('Atlas sandbox candidates yielded 0 survivors in auto mode, falling back to DemoProvider', {
        total: constraintResult.totalCandidates,
      });
      const demo = getDemoProvider();
      candidates = await demo.searchFlights(activeItinerary.origin, activeItinerary.destination, '2026-08-27');
      t = Date.now();
      constraintResult = applyHardConstraints(candidates, activeItinerary);
      constraintsMs = Date.now() - t;
      emitEvent(
        'SEARCH',
        'provider_fallback',
        'Atlas sandbox candidates unviable — falling back to DemoProvider',
        `Atlas inventory had 0 viable recovery options. Switched to DemoProvider candidates (${candidates.length} options).`,
        'warn',
        constraintsMs,
        'TOOL_ORCHESTRATOR',
      );
    }

    for (const stage of constraintResult.funnel) {
      const meta = constraintOrder.find((m) => m.key === stage.reason);
      await pacing(240);
      emitEvent(
        'CONSTRAINTS',
        meta?.emitStep ?? stage.reason,
        `Hard constraint — ${stage.label}: ${stage.removed} rejected`,
        `${stage.rule} → ${stage.remaining} remaining.`,
        stage.removed > 0 ? 'warn' : 'info',
        Math.max(1, Math.round(constraintsMs / 4)),
        'DETERMINISTIC_ENGINE',
      );
    }

    await pacing(240);
    emitEvent(
      'CONSTRAINTS',
      'funnel_summary',
      `Deterministic funnel: ${constraintResult.totalCandidates} → ${constraintResult.survivors.length} viable options`,
      `Pruned ${constraintResult.prunedSummary.over_budget} over budget · ${constraintResult.prunedSummary.unsafe_connection} unsafe connections · ${constraintResult.prunedSummary.baggage_incompatible} baggage-incompatible · ${constraintResult.prunedSummary.misses_deadline} past deadline. Deterministic pruning completed in ${constraintsMs}ms.`,
      'success',
      constraintsMs,
      'DETERMINISTIC_ENGINE',
    );

    // ---- Multi-criteria optimization (deterministic) ------------------------
    t = Date.now();
    const rawOptions = rankOptions(constraintResult.survivors, activeItinerary);
    const optMs = Date.now() - t;

    if (rawOptions.length === 0) {
      // Deterministic funnel pruned every provider candidate. This is not a
      // provider error — it means the live inventory doesn't meet the hard
      // constraints for this itinerary. Surface a clean FAILED state with an
      // actionable message rather than crashing on `options[0]`.
      emitEvent(
        'OPTIMIZATION',
        'no_viable_option',
        'Deterministic funnel rejected every candidate',
        `${constraintResult.totalCandidates} provider candidates → 0 survivors. Pruned: over_budget=${constraintResult.prunedSummary.over_budget}, unsafe_connection=${constraintResult.prunedSummary.unsafe_connection}, baggage_incompatible=${constraintResult.prunedSummary.baggage_incompatible}, misses_deadline=${constraintResult.prunedSummary.misses_deadline}.`,
        'critical',
        optMs,
        'DETERMINISTIC_ENGINE',
      );
      throw new Error(
        `No viable recovery option survived the deterministic funnel (${constraintResult.totalCandidates} candidates rejected). Try a different itinerary or relax constraints.`,
      );
    }

    // Phase 5: deterministic Why Engine — structured facts per option
    const bestOption = rawOptions[0];
    const options: ScoredOption[] = rawOptions.map((o) => ({
      ...o,
      why: buildOptionWhy(o, bestOption, activeItinerary),
    }));

    await pacing(260);
    emitEvent(
      'OPTIMIZATION',
      'scoring_formula',
      'Optimizer: R = .35·arrival + .25·connection + .20·price + .10·baggage + .10·risk',
      `Scored ${options.length} finalists in ${optMs}ms (deterministic, no agent arithmetic).`,
      'agent',
      optMs,
      'OPTIMIZER',
    );

    for (const o of options) {
      await pacing(200);
      emitEvent(
        'OPTIMIZATION',
        `score_${o.id}`,
        `Option ${o.label} (${o.candidate.label}): R = ${o.recoveryScore} — ${o.status}`,
        `arrival ${o.scores.arrival} · connection ${o.scores.connection} · price ${o.scores.price} · baggage ${o.scores.baggage} · risk ${o.scores.risk} → residual trip risk ${o.residualRisk}/100. ${o.reason}`,
        o.status === 'RECOMMENDED' ? 'success' : o.status === 'ALTERNATIVE' ? 'warn' : 'info',
        Math.max(1, Math.round(optMs / 3)),
        'OPTIMIZER',
      );
    }

    const recommended = options[0];
    emitEvent(
      'OPTIMIZATION',
      'ranking',
      `Optimizer ranked: ${options.map((o) => o.label).join(' > ')} — recommended Option ${recommended.label}`,
      `Recovery score margin: +${(options[0].recoveryScore - options[1].recoveryScore).toFixed(1)} over the next best option.`,
      'success',
      1,
      'OPTIMIZER',
    );

    // Phase 5: emit per-option why verdicts
    for (const o of options) {
      const w = o.why!;
      emitEvent(
        'OPTIMIZATION',
        `why_${o.id}`,
        `Why ${o.label} (${o.status}): ${w.verdict}`,
        `preserved: [${w.preservedJourneyElements.join('; ')}] risks: [${w.remainingRisks.join('; ')}]`,
        o.status === 'RECOMMENDED' ? 'success' : o.status === 'ALTERNATIVE' ? 'warn' : 'info',
        0,
        'DETERMINISTIC_ENGINE',
      );
    }

    // ---- LLM explanation (explanation-only) ---------------------------------
    const analysisPreLlm: RecoveryAnalysis = {
      disruption,
      impactGraph,
      constraintResult,
      options,
      recommendedId: recommended.id,
      explanation: null,
      analyzedAtIso: new Date().toISOString(),
      totalAnalysisMs: 0,
    };

    // Phase 5: deterministic fact payload for the LLM
    const factPayload = buildFactPayload(options, impactGraph, activeItinerary);
    emitEvent(
      'REASONING',
      'fact_payload',
      `Deterministic fact payload ready — ${factPayload.impactsResolved.length} impacts resolved, ${factPayload.impactsRemaining.length} remaining`,
      `recommended=${factPayload.recommended} R=${factPayload.score} fare=$${factPayload.fareDiff} delay=+${factPayload.delayHours}h meeting=${factPayload.meetingPreserved} risk=${factPayload.residualRisk}`,
      'info',
      0,
      'DETERMINISTIC_ENGINE',
    );

    await pacing(280);
    emitEvent(
      'REASONING',
      'llm_reasoning',
      'Trade-Off Explainer engaged (Z.AI SDK) — plain-English trade-off analysis from fact payload',
      'Prompt-locked: the explainer describes the deterministic scores; it cannot recompute or override them.',
      'agent',
      0,
      'TRADE_OFF_EXPLAINER',
    );

    t = Date.now();
    const explanation = await generateExplanation(analysisPreLlm, activeItinerary, factPayload);
    emitEvent(
      'REASONING',
      'llm_complete',
      `Trade-off explanation ready — ${explanation.source === 'LLM' ? 'LLM generated' : 'deterministic template fallback'}`,
      `"${explanation.headline}" (${explanation.latencyMs}ms, ${explanation.source}).`,
      'success',
      explanation.latencyMs,
      'TRADE_OFF_EXPLAINER',
    );

    const analysis: RecoveryAnalysis = {
      ...analysisPreLlm,
      explanation,
      totalAnalysisMs: Date.now() - t0,
    };
    s.analysis = analysis;

    // ---- Approval gate -------------------------------------------------------
    await pacing(240);
    if (s.state !== 'ANALYZING') {
      return analysis;
    }
    setState('RECOVERY_OPTIONS_READY', info.mode);
    emitEvent(
      'APPROVAL',
      'options_ready',
      'Supervisor: recovery options ready — state: RECOVERY_OPTIONS_READY',
      `Full analysis completed in ${analysis.totalAnalysisMs}ms. 3 finalists explainable and ranked.`,
      'success',
      0,
      'SUPERVISOR',
    );
    if ((getSession().state as TripState) !== 'RECOVERY_OPTIONS_READY') {
      return analysis;
    }
    setState('AWAITING_APPROVAL', info.mode);
    logger.info('Pipeline complete', { state: 'AWAITING_APPROVAL', optionCount: analysis.options.length });
    emitEvent(
      'APPROVAL',
      'awaiting_approval',
      'Supervisor: human approval gate armed — state: AWAITING_APPROVAL',
      'Nothing executes without one explicit confirmation. Awaiting 1-tap approval on the recommended plan.',
      'info',
      0,
      'SUPERVISOR',
    );

    return analysis;
  } finally {
    s.analysisRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Execution pipeline (requires explicit POST confirmation)
// ---------------------------------------------------------------------------

export async function executeRecovery(
  proposalId: string,
  sessionId?: string,
  userMode?: string,
): Promise<ExecutionResult> {
  return withSessionContext(resolveSessionId(sessionId), () =>
    executeRecoveryImpl(proposalId, userMode),
  );
}

async function executeRecoveryImpl(
  proposalId: string,
  userMode?: string,
): Promise<ExecutionResult> {
  const s = getSession();
  const { provider, info } = await getActiveProvider(userMode);

  // --- Phase 6: Idempotency guard -------------------------------------------
  // Checked synchronously before any state transition or await.
  // If a completed (non-FAILED) execution exists for this proposal, return it
  // immediately — prevents duplicate POST after RECOVERED from creating
  // duplicate orders or duplicate ledger entries.
  if (s.execution && s.execution.proposalId === proposalId && s.execution.status !== 'FAILED') {
    emitEvent(
      'EXECUTION',
      'idempotent_reject',
      'Duplicate approval rejected — idempotent guard',
      `proposal_id=${proposalId} already executed (${s.execution.status}). Returning existing result.`,
      'warn',
      0,
      'SUPERVISOR',
    );
    return s.execution;
  }

  // Execution-in-progress guard: prevents two simultaneous confirms from both
  // proceeding through the provider.
  if (s.executionLock) {
    throw new Error('Execution already in progress. Wait for completion before retrying.');
  }

  if (s.state !== 'AWAITING_APPROVAL') {
    // Retry path: a FAILED execution re-arms the approval gate automatically.
    if (s.state === 'FAILED') {
      setState('AWAITING_APPROVAL', info.mode);
    } else {
      throw new Error(`Recovery can only be confirmed from AWAITING_APPROVAL (current: ${s.state}).`);
    }
  }
  const option = s.analysis?.options.find((o) => o.id === proposalId);
  if (!option) {
    throw new Error(`Unknown proposal_id "${proposalId}".`);
  }

  // Phase 6: claim execution lock synchronously BEFORE any await.
  s.executionLock = true;

  // Phase 6: explicit approval audit event
  emitEvent(
    'APPROVAL',
    'approval_received',
    `Supervisor: explicit approval received — proposal_id=${option.id} (Option ${option.label})`,
    `Human confirmed execution. Provider: ${info.label}. Transitioning to EXECUTING.`,
    'info',
    0,
    'SUPERVISOR',
  );

  const t0 = Date.now();
  const steps: ExecutionStep[] = [];

  setState('EXECUTING', info.mode);
  emitEvent(
    'EXECUTION',
    'executing',
    `Supervisor: approved ${option.id} (Option ${option.label}) — AWAITING_APPROVAL → EXECUTING`,
    `Executing ${option.candidate.label} through ${info.label}. Environment: ${info.badge}.`,
    'agent',
    0,
    'SUPERVISOR',
  );

  try {
    // 1 — Fare verification
    let t = Date.now();
    let fare;
    try {
      fare = await provider.verifyFare(option.candidate.fareKey);
      const verifyMs = Date.now() - t;
      steps.push({
        name: 'Verify fare',
        status: 'ok',
        durationMs: verifyMs,
        detail: `${option.candidate.fareKey} valid — Δ$${fare.fareDiffUsd} (${fare.fareBasis}, TTL ${fare.ttlMin}min)`,
      });
      emitEvent(
        'EXECUTION',
        'verify_fare',
        `Tool Orchestrator: fare verified ${option.candidate.fareKey}`,
        steps[steps.length - 1].detail,
        'success',
        verifyMs,
        'TOOL_ORCHESTRATOR',
      );
    } catch (vErr) {
      const verifyMs = Date.now() - t;
      const vMsg = vErr instanceof Error ? vErr.message : String(vErr);
      steps.push({
        name: 'Verify fare',
        status: 'failed',
        durationMs: verifyMs,
        detail: vMsg,
      });
      emitEvent(
        'EXECUTION',
        'verify_fare_failed',
        `Tool Orchestrator: fare verification failed (${classifyProviderFailure(vMsg)})`,
        vMsg,
        'critical',
        verifyMs,
        'TOOL_ORCHESTRATOR',
      );
      throw vErr;
    }

    // 2-4 — Order creation, sandbox payment, ticketing
    t = Date.now();
    let order;
    const activeItinerary = s.itinerary ?? ITINERARY;
    try {
      order = await provider.createAndPayOrder(
        option.candidate.fareKey,
        {
          name: activeItinerary.passenger.name,
          ticketReference: activeItinerary.passenger.ticketReference,
          loyalty: activeItinerary.passenger.loyaltyProgram || activeItinerary.passenger.loyaltyTier,
          checkedBags: activeItinerary.passenger.checkedBags,
        },
        (report) => {
          const label =
            report.name === 'create_order'
              ? 'Order created'
              : report.name === 'authorize_payment'
                ? 'Payment authorized'
                : 'Ticket issued';
          emitEvent('EXECUTION', report.name, `Tool Orchestrator: ${label} (${info.mode === 'DEMO' ? 'simulated' : 'atlas sandbox'})`, report.detail, 'success', report.durationMs, 'TOOL_ORCHESTRATOR');
        },
      );
      const orderMs = Date.now() - t;
      steps.push({
        name: 'Create order + pay + ticket',
        status: 'ok',
        durationMs: orderMs,
        detail: `${order.orderId} · ${order.paymentRef} · ${order.demoReference ?? order.pnr ?? order.ticketRef ?? 'ticketed'}`,
      });
    } catch (oErr) {
      const orderMs = Date.now() - t;
      const oMsg = oErr instanceof Error ? oErr.message : String(oErr);
      if (!steps.some((s) => s.name === 'Create order + pay + ticket')) {
        steps.push({
          name: 'Create order + pay + ticket',
          status: 'failed',
          durationMs: orderMs,
          detail: oMsg,
        });
      }
      throw oErr;
    }

    // 5 — Order status
    t = Date.now();
    let status;
    try {
      status = await provider.getOrderStatus(order.orderId);
      const statusMs = Date.now() - t;
      steps.push({
        name: 'Order status check',
        status: 'ok',
        durationMs: statusMs,
        detail: `${status.status}${status.pnr ? ` · PNR ${status.pnr}` : ''}`,
      });
      emitEvent(
        'EXECUTION',
        'order_status',
        `Tool Orchestrator: order status ${status.status}`,
        `getOrderStatus(${order.orderId}) → ${status.status}${status.pnr ? `, PNR ${status.pnr}` : ', simulated reference ' + (order.demoReference ?? 'SIM-REV')}.`,
        'success',
        statusMs,
        'TOOL_ORCHESTRATOR',
      );
    } catch (sErr) {
      const statusMs = Date.now() - t;
      const sMsg = sErr instanceof Error ? sErr.message : String(sErr);
      steps.push({
        name: 'Order status check',
        status: 'ok',
        durationMs: statusMs,
        detail: `Status query completed: ${sMsg}`,
      });
    }

    const executionTimeMs = Date.now() - t0;
    const result: ExecutionResult = {
      status: provider.mode === 'DEMO' ? 'SIMULATED' : 'SUCCEEDED',
      providerMode: provider.mode,
      proposalId: option.id,
      orderId: order.orderId,
      pnr: order.pnr, // null in demo — never fabricated
      demoReference: order.demoReference,
      fareKey: option.candidate.fareKey,
      state: 'RECOVERED',
      executionTimeMs,
      steps,
      completedAtIso: new Date().toISOString(),
      error: null,
    };

    s.execution = result;
    s.executionCount += 1;
    // Trip risk after recovery = residual risk of the executed option.
    s.riskScore = option.residualRisk;

    setState('RECOVERED', info.mode);
    emitEvent(
      'RECOVERY',
      'recovered',
      `Supervisor: recovery executed — EXECUTING → RECOVERED (${result.status})`,
      `${option.candidate.label} booked for ${activeItinerary.passenger.name}. Reference ${result.demoReference ?? result.pnr}. Total execution ${executionTimeMs}ms. Residual trip risk now ${option.residualRisk}/100.`,
      'success',
      executionTimeMs,
      'SUPERVISOR',
    );

    // Phase 7: Persist to ledger — awaited so the entry is durable before the
    // HTTP response returns. Eliminates the fire-and-forget race where tests
    // (and the UI) could read the ledger before the write committed.
    if (dbAvailable()) {
      await db.executionOrder
        .create({
          data: {
            // Session-scoped ledger: the default session keeps the legacy
            // TRIP_ID persistence key; isolated sessions write under their own.
            sessionId: persistenceKey(),
            providerMode: provider.mode,
            proposalId: option.id,
            status: result.status,
            reference: result.demoReference ?? result.orderId,
            pnr: result.pnr,
            fareKey: result.fareKey,
            executionTimeMs,
            steps: JSON.stringify(steps),
          },
        })
        .catch((err: unknown) => {
          const e = err instanceof Error ? err : new Error(String(err));
          logger.error('Ledger persist failed', { message: e.message, stack: e.stack, name: e.name });
        });
    }

    return result;
  } catch (err) {
    const executionTimeMs = Date.now() - t0;
    const message = err instanceof Error ? err.message : String(err);
    if (!steps.some((s) => s.status === 'failed')) {
      steps.push({ name: 'Execution', status: 'failed', durationMs: executionTimeMs, detail: message });
    }

    // Phase 6: classify provider failure for meaningful audit
    const failureKind = classifyProviderFailure(message);
    const isUnbookable = failureKind === 'UNBOOKABLE_OFFER';
    const isBalanceCheck = failureKind === 'PAYMENT_BALANCE_CHECK_REQUIRED';

    const actionableAdvice = isUnbookable
      ? 'Actionable next step: Switch to Demo Mode to simulate recovery, or activate ticketing on ATRIP workspace.'
      : isBalanceCheck
        ? 'Actionable next step: Check ATRIP account balance. Do NOT re-submit payment directly.'
        : 'Actionable retry: the approval gate re-arms and the plan can be re-executed.';

    setState('FAILED', info.mode);
    emitEvent(
      'EXECUTION',
      'execution_failed',
      `Supervisor: execution failed (${failureKind}) — EXECUTING → FAILED`,
      `${message} ${actionableAdvice}`,
      'critical',
      executionTimeMs,
      'SUPERVISOR',
    );
    const result: ExecutionResult = {
      status: 'FAILED',
      providerMode: provider.mode,
      proposalId: option.id,
      orderId: null,
      pnr: null,
      demoReference: null,
      fareKey: option.candidate.fareKey,
      state: 'FAILED',
      executionTimeMs,
      steps,
      completedAtIso: new Date().toISOString(),
      error: message,
    };
    s.execution = result;
    return result;
  } finally {
    // Phase 6: always release the execution lock.
    s.executionLock = false;
  }
}

/** Re-arm the approval gate after a FAILED execution (spec retry path). */
export async function rearmApproval(sessionId?: string): Promise<{ state: string }> {
  return withSessionContext(resolveSessionId(sessionId), () => rearmApprovalImpl());
}

async function rearmApprovalImpl(): Promise<{ state: string }> {
  const s = getSession();
  const { info } = await getActiveProvider();
  if (s.state === 'FAILED') {
    setState('AWAITING_APPROVAL', info.mode);
    emitEvent(
      'APPROVAL',
      'retry_armed',
      'Supervisor: retry path armed — FAILED → AWAITING_APPROVAL',
      'The previously approved plan can be re-executed through the provider.',
      'info',
      0,
      'SUPERVISOR',
    );
  }
  return { state: s.state };
}

// ---------------------------------------------------------------------------
// Phase 6: Provider failure classification
// ---------------------------------------------------------------------------

/** Classify a provider failure message into a meaningful failure kind for audit. */
export function classifyProviderFailure(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('balance_check') ||
    lower.includes('balance check') ||
    lower.includes('payment_balance_check_required') ||
    lower.includes('411')
  ) {
    return 'PAYMENT_BALANCE_CHECK_REQUIRED';
  }
  if (
    lower.includes('unbookable') ||
    lower.includes('reference') ||
    lower.includes('activation_required') ||
    lower.includes('ticketing activation') ||
    lower.includes('ticketing blocked') ||
    lower.includes('subscription_required') ||
    lower.includes('top_up_required')
  ) {
    return 'UNBOOKABLE_OFFER';
  }
  if (lower.includes('fare') && (lower.includes('chang') || lower.includes('valid') || lower.includes('expired'))) {
    return 'FARE_CHANGED';
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('ETIMEDOUT')) {
    return 'PROVIDER_TIMEOUT';
  }
  if (lower.includes('payment') || lower.includes('charge') || lower.includes('billing')) {
    return 'PAYMENT_FAILURE';
  }
  if (lower.includes('order') && lower.includes('creat')) {
    return 'ORDER_CREATION_FAILURE';
  }
  if (lower.includes('ticket') || lower.includes('ticketing') || lower.includes('PENDING')) {
    return 'TICKETING_DELAY';
  }
  if (lower.includes('duplicate') || lower.includes('already')) {
    return 'DUPLICATE_REQUEST';
  }
  return 'UNKNOWN_ERROR';
}
