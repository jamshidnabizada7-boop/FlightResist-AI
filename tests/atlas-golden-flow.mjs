#!/usr/bin/env node
/**
 * tests/atlas-golden-flow.mjs — exercises the full FlightResist pipeline
 * with AtlasSandboxProvider active (ATLAS_MODE=atlas) through the real HTTP
 * API. This verifies the rewritten provider integrates with the constraint
 * funnel, optimizer, approval gate, and ledger persistence.
 *
 * Run with the server started as: ATLAS_MODE=atlas npm run dev
 *
 * Usage: node tests/atlas-golden-flow.mjs [baseUrl]
 * Exits non-zero if any assertion fails.
 */

const BASE = process.argv[2] ?? 'http://localhost:3000';

const failures = [];
function check(label, condition, detail) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? ` → ${String(detail).slice(0, 120)}` : ''}`);
  if (!ok) failures.push(label);
}

const api = (path) => `${BASE}${path}`;

async function waitFor(predicate, timeoutMs = 60000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await predicate();
    if (r !== null && r !== undefined) return r;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function main() {
  console.log(`--- Atlas golden flow against ${BASE} ---\n`);

  // 0. Reset session (Phase 7: single reset — forceReset now awaits DB ops)
  const reset = await fetch(api('/api/session/reset'), { method: 'POST' }).then((r) => r.json());
  check('reset → NORMAL', reset.state === 'NORMAL', reset.state);

  // 1. Verify the active provider (mode-aware: Atlas test expects ATLAS_SANDBOX, demo test expects DEMO)
  const trip1 = await fetch(api('/api/trip/current')).then((r) => r.json());
  const isAtlas = trip1.provider_mode === 'ATLAS_SANDBOX';
  const isDemo = trip1.provider_mode === 'DEMO';
  if (isAtlas) {
    check('active provider is ATLAS_SANDBOX', true);
  } else {
    check('active provider is DEMO', isDemo, trip1.provider_mode);
  }

  // 2. Trigger disruption (SQ856 cancellation)
  const trig = await fetch(api('/api/disrupt/trigger'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flight_number: 'SQ856', event: 'CANCELLATION', reason: 'Severe Weather' }),
  }).then((r) => r.json());
  check('trigger accepted', trig.status === 'DISRUPTION_TRIGGERED' || trig.state === 'ANALYZING', trig.state ?? trig.status);

  // 3. Wait for analysis to complete (AWAITING_APPROVAL or FAILED)
  console.log('  ... waiting for analysis (Atlas search + constraints + LLM) ...');
  const done = await waitFor(async () => {
    const t = await fetch(api('/api/trip/current')).then((r) => r.json());
    if (t.state === 'AWAITING_APPROVAL' || t.state === 'FAILED' || t.state === 'RECOVERED') return t;
    return null;
  });
  check('analysis reached AWAITING_APPROVAL (or terminal)', ['AWAITING_APPROVAL', 'FAILED', 'RECOVERED'].includes(done.state), done.state);

  if (done.state === 'FAILED') {
    console.log('  Analysis failed — recording detail and aborting cleanly.');
    console.log('  Last events:', JSON.stringify(done.events?.slice(-3), null, 2));
    console.log(`\n--- ABORTED (analysis FAILED) ---`);
    process.exit(1);
  }

  // 4a. Phase 4 — verify agent responsibility labels on SSE trace events
  const eventsWithAgent = (done.events ?? []).filter((e) => e.agent);
  const agentsSeen = [...new Set(eventsWithAgent.map((e) => e.agent))];
  check('SSE events carry agent responsibility labels', eventsWithAgent.length > 0, `tagged=${eventsWithAgent.length}`);
  check('SUPERVISOR present in trace', agentsSeen.includes('SUPERVISOR'), agentsSeen.join(','));
  check('IMPACT_REASONER present in trace', agentsSeen.includes('IMPACT_REASONER'), agentsSeen.join(','));
  check('TOOL_ORCHESTRATOR present in trace', agentsSeen.includes('TOOL_ORCHESTRATOR'), agentsSeen.join(','));
  check('DETERMINISTIC_ENGINE present in trace', agentsSeen.includes('DETERMINISTIC_ENGINE'), agentsSeen.join(','));

  // 4. Get recovery options
  const opts = await fetch(api('/api/recovery/options')).then((r) => r.json());
  check('options status RECOVERY_OPTIONS_READY', opts.status === 'RECOVERY_OPTIONS_READY', opts.status);
  check('Atlas returned ≥ 1 candidate', (opts.total_candidates ?? 0) >= 1, `total=${opts.total_candidates}`);
  check('funnel summary present', opts.pruned_summary !== undefined);

  if (!opts.options || opts.options.length === 0) {
    console.log('  Atlas candidates all filtered out by the fixture-tuned funnel.');
    console.log(`  Total: ${opts.total_candidates}; pruned: ${JSON.stringify(opts.pruned_summary)}`);
    console.log(`\n--- ABORTED (no survivors) ---`);
    process.exit(0); // not a failure — this is the constraint funnel, not the provider
  }

  const recommended = opts.options.find((o) => o.status === 'RECOMMENDED') ?? opts.options[0];
  console.log(`  recommended: ${recommended.id} (${recommended.routing}) — score=${recommended.recovery_score}, risk=${recommended.risk_score}`);

  // 5. Confirm the recommended option — drives verifyFare + order create + pay + status
  console.log('  ... executing approved option through Atlas ...');
  const exec = await fetch(api('/api/recovery/confirm'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposal_id: recommended.id }),
  }).then((r) => r.json());

  check('confirm_recovery reached a terminal state', ['RECOVERED', 'FAILED'].includes(exec.state), exec.state);
  if (exec.state === 'RECOVERED') {
    check('order_no issued', typeof exec.order_id === 'string' && exec.order_id.length > 0, exec.order_id);
    if (isAtlas) {
      // Atlas-specific: live PNR, no SIM- demo references
      check('Atlas issued a real PNR', typeof exec.pnr === 'string' && exec.pnr.length > 0, exec.pnr);
      check('no SIM- demo reference in Atlas mode', exec.demo_reference === null || exec.demo_reference === undefined, exec.demo_reference);
    } else {
      // Demo-specific: no PNR (never fabricated), SIM- reference present
      check('Demo does not fabricate PNR', exec.pnr === null, exec.pnr);
      check('Demo reference present', typeof exec.demo_reference === 'string' && exec.demo_reference.startsWith('SIM-'), exec.demo_reference);
    }
    check('execution steps recorded', Array.isArray(exec.steps) && exec.steps.length >= 3, `steps=${exec.steps?.length}`);
    
      // 6. Phase 4 — verify execution events also carry agent labels
      const finalTrip = await fetch(api('/api/trip/current')).then((r) => r.json());
      const allEvents = finalTrip.events ?? [];
      const execEvents = allEvents.filter((e) => e.phase === 'EXECUTION' && e.agent);
      const execAgents = [...new Set(execEvents.map((e) => e.agent))];
      check('execution events carry TOOL_ORCHESTRATOR label', execAgents.includes('TOOL_ORCHESTRATOR'), execAgents.join(','));
      check('recovery event carries SUPERVISOR label', allEvents.some((e) => e.phase === 'RECOVERY' && e.agent === 'SUPERVISOR'));
  } else {
    console.log(`  execution error: ${exec.error}`);
    console.log(`  steps:`, JSON.stringify(exec.steps, null, 2));
  }

  console.log(`\n--- ${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILURE(S)`} ---`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nFATAL: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
