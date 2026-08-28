#!/usr/bin/env node
/**
 * tests/mcp-smoke.mjs — real end-to-end exercise of the /api/mcp MCP surface.
 *
 * Drives the full golden flow through MCP JSON-RPC (not REST):
 *   reset_session → get_current_trip → trigger_disruption
 *   → get_recovery_options → confirm_recovery
 *
 * Usage: node tests/mcp-smoke.mjs [baseUrl]
 * Exits non-zero if any assertion fails.
 */

const BASE = process.argv[2] ?? 'http://localhost:3000';
const MCP = `${BASE}/api/mcp`;

let rpcId = 0;
const failures = [];

function check(label, condition, detail) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? ` → ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

async function rpc(method, params) {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

/** tools/call returns MCP content envelopes; unwrap the JSON payload. */
async function callTool(name, args = {}) {
  const result = await rpc('tools/call', { name, arguments: args });
  const text = result.content?.[0]?.text ?? '{}';
  return { data: JSON.parse(text), isError: result.isError };
}

async function waitForState(target, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await callTool('get_current_trip');
    if (data.state === target) return data;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for state ${target}`);
}

async function main() {
  console.log(`--- MCP smoke test against ${MCP} ---\n`);

  // 1. Discovery manifest (GET)
  const manifest = await (await fetch(MCP)).json();
  check('GET manifest serves protocolVersion', manifest.protocolVersion, manifest.protocolVersion);
  check('GET manifest advertises 5 tools', manifest.tools?.length === 5, manifest.tools?.length);

  // 2. initialize
  const init = await rpc('initialize');
  check('initialize returns serverInfo', init.serverInfo?.name === 'flightresist', init.serverInfo?.name);

  // 3. tools/list
  const list = await rpc('tools/list');
  const names = list.tools.map((t) => t.name).sort();
  check(
    'tools/list exposes expected tools',
    names.join(',') ===
      'confirm_recovery,get_current_trip,get_recovery_options,reset_session,trigger_disruption',
    names.join(','),
  );

  // 4. Unknown tool is rejected
  const bad = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'tools/call', params: { name: 'drop_tables' } }),
  }).then((r) => r.json());
  check('unknown tool rejected with -32602', bad.error?.code === -32602, bad.error?.code);

  // 5. reset_session → NORMAL
  await callTool('reset_session');
  const { data: reset } = await callTool('reset_session');
  check('reset_session → NORMAL', reset.state === 'NORMAL', reset.state);

  // 6. get_current_trip
  const { data: trip } = await callTool('get_current_trip');
  check('get_current_trip returns canonical trip', trip.trip_id === 'TRIP-SIN-NRT-2026', trip.trip_id);
  check('provider mode is DEMO', trip.provider_mode === 'DEMO', trip.provider_mode);

  // 7. trigger_disruption
  const { data: trg } = await callTool('trigger_disruption', {
    flight_number: 'SQ856',
    event: 'CANCELLATION',
    reason: 'Severe Weather',
  });
  check('trigger_disruption accepted', trg.state === 'ANALYZING' || trg.status, trg.state ?? trg.status);

  // 8. Analysis completes → AWAITING_APPROVAL
  const awaiting = await waitForState('AWAITING_APPROVAL');
  check('risk score escalates to 87 (CRITICAL)', awaiting.risk_score === 87, awaiting.risk_score);

  // 9. get_recovery_options — the deterministic funnel
  const { data: opts } = await callTool('get_recovery_options');
  check('42 candidates evaluated', opts.total_candidates === 42, opts.total_candidates);
  check('3 ranked options returned', opts.options?.length === 3, opts.options?.length);
  check('opt_b recommended', opts.recommended_id === 'opt_b', opts.recommended_id);
  // `explanation` is an LlmExplanation object (headline + reasoning), never a bare string.
  check(
    'explanation object present with headline',
    opts.explanation && typeof opts.explanation.headline === 'string' && opts.explanation.headline.length > 0,
    opts.explanation?.headline,
  );

  // 10. confirm_recovery — the human-approval gate
  const { data: exec } = await callTool('confirm_recovery', { proposal_id: 'opt_b' });
  check('confirm_recovery → RECOVERED', exec.state === 'RECOVERED', exec.state);
  check('demo reference issued', /^SIM-REV-/.test(exec.demo_reference ?? ''), exec.demo_reference);
  check('no fake PNR in DEMO mode', exec.pnr === null || exec.pnr === undefined, String(exec.pnr));

  console.log(`\n--- ${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILURE(S)`} ---`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nFATAL: ${err.message}`);
  process.exit(1);
});
