# QODER_EVIDENCE.md

**How Alibaba Cloud's Qoder platform was used to build FlightResist AI 2.0.**
One page. Every claim below points at a file or a command you can run yourself.

> Judging criterion: *Use of Alibaba Cloud's Qoder Platform — 20%.*
> Full engineering record: [`QODER_UPGRADE_STATUS.md`](./QODER_UPGRADE_STATUS.md) (1,600+ lines) · [`worklog.md`](./worklog.md)

---

## The short version

Qoder is used **in both directions**, which is the part worth 60 seconds of your time:

1. **Qoder built this app.** Phases 1–10 — the real Atlas CLI integration, the MCP runtime, the safety suite, the recovery-intelligence layer, the UI polish, and the release freeze — were executed by the Qoder agent, with Qoder Skills and Qoder subagents.
2. **This app is callable *by* Qoder.** `src/app/api/mcp/route.ts` is a working MCP-over-HTTP server. Any Qoder workspace can import [`qoder_mcp_config.json`](./qoder_mcp_config.json) and drive the recovery engine as a tool.

So FlightResist is not just *built with* Qoder — it is a travel-recovery capability that Qoder agents can **call**.

---

## 1. The MCP surface is real, not declarative

`src/app/api/mcp/route.ts` — MCP-over-HTTP, JSON-RPC 2.0.

| Transport | Method | Behaviour |
|---|---|---|
| `GET /api/mcp` | — | Discovery manifest: `protocolVersion`, `serverInfo`, `active_provider_mode`, full tool schemas |
| `POST /api/mcp` | `initialize` | Returns `protocolVersion: 2024-11-05`, `serverInfo`, `capabilities.tools` |
| `POST /api/mcp` | `tools/list` | All 5 tool definitions with JSON Schema |
| `POST /api/mcp` | `tools/call` | Dispatches to the engine, wrapped in an MCP `content[]` envelope |

JSON-RPC errors are correct: `-32700` parse, `-32601` method not found, `-32602` unknown tool / invalid params, `-32603` internal. Tool-level failures return `isError: true` inside a successful envelope, per MCP convention.

**No tool has its own logic.** Each delegates to the same function the REST route calls, so the MCP surface cannot drift from real app behaviour:

| MCP tool | Delegates to | Side-effecting |
|---|---|---|
| `get_current_trip` | `currentTripResponse()` | No |
| `trigger_disruption` | `triggerDisruption(event)` | Yes — starts analysis |
| `get_recovery_options` | `currentTripResponse().analysis` | No |
| `confirm_recovery` | `executeRecovery(proposal_id)` | **Yes — this is the booking call** |
| `reset_session` | `forceReset(providerMode)` | Session only |

**Verify it yourself:**
```bash
bun run dev                      # or: npx next dev
node tests/mcp-smoke.mjs http://localhost:3000
```
Expected: `ALL CHECKS PASSED` — provider mode `DEMO`, risk escalates to `87`, `42` candidates, `3` ranked options, `opt_b` recommended, and **`pnr: null`** because demo mode never fabricates a ticket.

---

## 2. Qoder Skills — `atlas-flight-booking` was load-bearing

The official Atlas Skill is installed and hash-pinned:

```json
// skills-lock.json
"atlas-flight-booking": {
  "source": "atlas-doc/atlas-flight-booking-skill",
  "sourceType": "github",
  "computedHash": "dffbe3c072fb0e8f9329b5ca6cd63dbdedde0cbc66378e9c1f2bb5701d1e7faf"
}
```

This Skill installed the `atlas-flight` CLI (v0.3.12) and was used to drive the **real Atlas Sandbox transaction chain** that proved the highest-risk path before any UI existed: search → fare verify → confirm price → baggage → order create → order pay → ticketing status. That run reached **`TICKETED` with a real airline PNR**.

Setup record: [`ATLAS_ENVIRONMENT_SETUP.md`](./ATLAS_ENVIRONMENT_SETUP.md) · Capability matrix: [`QODER_UPGRADE_STATUS.md`](./QODER_UPGRADE_STATUS.md)

---

## 3. Qoder Agent & subagents — the actual development workflow

| Phase | What the Qoder agent did | Artifact |
|---|---|---|
| 1 | Proved the Atlas transaction chain end-to-end before building features | `tests/atlas-chain-smoke.mjs` |
| 3 | Rewrote `AtlasSandboxProvider` against the *verified* CLI surface | `src/lib/flightresist/providers/atlas-sandbox.ts` |
| 2 | Built the MCP runtime; deleted a previously fake config claim | `src/app/api/mcp/route.ts` |
| 5 | Recovery-intelligence layer + deterministic fact payload | `src/lib/flightresist/why-engine.ts` |
| 6 | Trust & safety: 91 assertions incl. approval and idempotency invariants | `tests/phase6-safety.mjs` |
| 8–9 | Demo-mode verification and UI polish under a strict no-regression rule | `QODER_UPGRADE_STATUS.md` |
| 10 | Final readiness audit and release freeze | commit `2398e87` |

**Subagents used:** `Search` (repo-wide investigation before edits), `CodeReview` (change review), `Debug` (root-causing runtime failures), `Browser` (real-browser E2E verification and screenshots), `GeneralPurpose`, `plan-agent`.

---

## 4. Alibaba Cloud services

| Service | Use | Where |
|---|---|---|
| **Model Studio (Qwen)** | Explanation-only LLM via the OpenAI-compatible DashScope endpoint. `LLM_PROVIDER=qwen`, model `qwen-plus`. Implemented with plain `fetch` — no SDK dependency. | `src/lib/flightresist/llm.ts` |
| **Qoder** | The development platform for Phases 1–10, and an MCP client that can drive the shipped engine | this document |

The LLM is **never** in the control path. It receives the deterministic engine's computed scores and is prompt-locked from recomputing them; any failure, timeout, or malformed response falls back to a deterministic template. Proof: with a deliberately invalid key, Model Studio returns HTTP 401 and the pipeline still produces risk `87`, `42` candidates, and Option B at `R = 82` — unchanged.

---

## 5. Honest limits — what Qoder is *not* here

Stated plainly, because the earlier version of our own docs over-claimed and we corrected it:

- The `qoder` binary in this environment is the **IDE launcher v1.24.2** (`--diff`, `--merge`, `--goto`, `--add`, `--profile`). It is an editor CLI, **not** an agent runtime.
- `qoder mcp list` is a **no-op** — there is no CLI-managed MCP registry to enumerate. Our MCP server is consumed by importing `qoder_mcp_config.json` into a workspace.
- Earlier documentation claimed a `/api/mcp` route while advertising 5 tools at a route **that did not exist**. That was a fake trace. It was fixed by *building the runtime*, not by softening the wording. See the "Correction to prior docs" note in `QODER_UPGRADE_STATUS.md`.
- The earliest scaffolding work (`worklog.md` Tasks 1–15) was performed in a different agent environment before the Qoder phases began. Phases 1–10 — every capability described above — are Qoder's.

---

## 6. Reproduce every claim

```bash
npx next dev -p 3000                              # start
node tests/mcp-smoke.mjs      http://localhost:3000   # MCP surface        → ALL PASS
node tests/phase6-safety.mjs  http://localhost:3000   # 91 safety asserts  → 91/91
node tests/atlas-golden-flow.mjs http://localhost:3000 # full recovery flow → ALL PASS

# MCP discovery manifest
node -e 'fetch("http://localhost:3000/api/mcp").then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))'
```
