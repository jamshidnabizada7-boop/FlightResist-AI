# FlightResist AI 2.0

**Autonomous Travel Recovery Intelligence** — built for the *Alibaba Cloud × Atlas Agentic AI Hackathon 2026*.

> When an active journey breaks, FlightResist assesses the downstream impact across the **entire itinerary** and executes an optimal recovery with a **single user confirmation**.

**Track:** ✈️ Flights & Aviation — proactive disruption handling and intelligent rebooking.

### For judges — start here

| | |
|---|---|
| **Live demo** | `<deployment URL pending>` |
| **Try it in 30 seconds** | Open the app → press **`D`** (or click *Simulate Disruption*) → watch risk climb to **87** and the funnel prune **42 → 3** → press **`A`** to approve → land on **RECOVERED** at risk **18**. Press **`R`** to reset. |
| **Innovation (30%)** | The deterministic engine is **authoritative**; the LLM is **explanation-only** and cannot compute, rank, or override a safety constraint. Weighted Trip Impact Graph scores the *whole itinerary*, not the cancelled flight — the client meeting carries 58% of trip value. → [`optimizer.ts`](./src/lib/flightresist/optimizer.ts) · [`impact-graph.ts`](./src/lib/flightresist/impact-graph.ts) |
| **Feasibility (30%)** | Real `atlas-flight` 0.3.12 CLI, driven end-to-end against the Atlas **Sandbox** — real fare verification, real order, real payment, order reached **`TICKETED` with a live airline PNR**. 91 safety assertions pass, including *no approval → no transaction* and *double approval → exactly one transaction*. → [`tests/phase6-safety.mjs`](./tests/phase6-safety.mjs) |
| **Qoder / Alibaba Cloud (20%)** | Qoder built Phases 1–10 **and** the app exposes a real MCP server Qoder can call back into. Explanations run on **Alibaba Cloud Model Studio (Qwen)**. → **[`QODER_EVIDENCE.md`](./QODER_EVIDENCE.md)** ← read this one |
| **Demo (20%)** | 3-minute walkthrough: `<video URL pending>` |

**Verify every number yourself:**
```bash
npx next dev -p 3000
node tests/phase6-safety.mjs     http://localhost:3000   # → 91/91
node tests/atlas-golden-flow.mjs http://localhost:3000   # → ALL PASS
node tests/mcp-smoke.mjs         http://localhost:3000   # → ALL PASS
```

```
CONVENTIONAL (REACTIVE)                    FLIGHTRESIST (AGENTIC)
Disruption → SMS alert                     Disruption → Autonomous Sentinel
         → Manual search                            → Trip Impact Graph (risk 87/100)
         → Airport lines                            → 42-candidate funnel (deterministic pruning)
         → Missed meeting                          → Multi-criteria scoring (R = .35a+.25c+.20p+.10b+.10r)
                                                   → Plain-English justification (LLM, explanation-only)
                                                   → 1-TAP APPROVAL
                                                   → Provider execution (SIM-REV-89211 in 2.2s)
```

## The demo scenario (SIN → NRT)

| | |
|---|---|
| Itinerary | `TRIP-SIN-NRT-2026` — SQ856 SIN 08:00 → HKG 12:05 · CX520 HKG 14:30 → NRT 19:45 |
| Mission | ¥2.1B contract signing, Marunouchi client HQ, **08:30 JST next morning** |
| Disruption | **Typhoon Trami cancels SQ856 at 05:30** — HKG hub closed, CX520 misconnect guaranteed |
| Trip risk | **87/100 CRITICAL** (weighted impact graph: meeting node carries 58% of trip value) |
| Funnel | **42 candidates → 12 over budget → 18 unsafe connections → 9 baggage-incompatible → 3 finalists** |
| Winner | **Option B — Scoot TR976 + EVA BR2198 via Taipei** (arrives 22:45, +3h, +$43, R = 82.0) |

## Architecture

```
                    BaseTravelProvider (abstract interface)
                                       │
                 ┌─────────────────────┴──────────────────────┐
                 ▼                                            ▼
       AtlasSandboxProvider                            DemoProvider  ← ACTIVE
    (real atlas-flight CLI;       (deterministic 42-candidate fixture,
     auto-activates on probe)      SIM- refs, measured latencies)
```

**The deterministic engine is authoritative.** Hard constraints (arrival deadline, budget, MCT, baggage) and the multi-criteria score are computed by closed-form TypeScript — the LLM is *explanation-only*, prompt-locked from recomputing anything, with a deterministic template fallback.

The explanation backend is a **provider chain** of OpenAI-compatible endpoints, tried in order within a shared 9-second budget: **Alibaba Cloud Model Studio (Qwen)** when `DASHSCOPE_API_KEY` is set → **Groq** (default model: Qwen served by Groq) → **Gemini** → **OpenRouter** → `template` (deterministic template reasoner, instant and offline-ready). Any failure, timeout, or malformed response falls through to the next provider and finally to the deterministic template — **the pipeline never blocks on the LLM.** The UI badge always shows the backend that actually produced the explanation (e.g. `groq · qwen/qwen3.8-27b`) — never a label it can't back. See [`.env.example`](./.env.example).

```
Trip State Engine → Disruption Webhook → Trip Impact Graph → Candidate Generation
  → Hard Constraint Filtering → Multi-Criteria Optimization → LLM Explanation
  → Human Approval (1-tap) → Provider Execution → RECOVERED
```

State machine: `NORMAL → DISRUPTION_DETECTED → ANALYZING → RECOVERY_OPTIONS_READY → AWAITING_APPROVAL → EXECUTING → RECOVERED` (with `FAILED → retry` path). A transition to `EXECUTING` **requires an explicit POST confirmation payload**.

## Honest environment disclosure

- The `atlas-flight` CLI **is present and authenticated** (v0.3.12) and its real capability surface was verified end-to-end in Phase 1 — a Sandbox order reached `TICKETED` with a live PNR. See `QODER_UPGRADE_STATUS.md` for the full capability matrix. In **Production**, Atlas allows search only (`ticketing_available: false`, blocker `TICKETING_ACTIVATION_REQUIRED`).
- `AtlasSandboxProvider` was **rewritten in Phase 3** against the verified `atlas-flight` 0.3.12 CLI surface — all command flags, JSON envelopes, and response codes match real CLI output. It uses `retryOnce()` for non-side-effecting operations (search, fare verify) and never retries order creation or payment. Currently `ATLAS_MODE=demo` is pinned in `.env`, so the **DemoProvider** is active and every surface is labeled **`[ENV: DETERMINISTIC DEMO]`**. Simulated references are `SIM-*`; **no PNR, payment, or count is ever fabricated**.
- **MCP runtime is real.** `src/app/api/mcp/route.ts` serves MCP-over-HTTP (JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`) and every tool delegates to the same deterministic engine the REST routes use. `qoder_mcp_config.json` binds it into a Qoder workspace. Verified with `bun run test:mcp` (17 checks).

## Run

```bash
bun run dev          # Next.js 16 on :3000 (dev server)
bun run db:push      # sync Prisma schema (SQLite at db/custom.db)
bun run lint         # ESLint
```

## API contract

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/trip/current` | session snapshot (itinerary, state, risk, provider, ledger, events) |
| POST | `/api/disrupt/trigger` | `{scenario: "cancellation" \| "delay", delay_minutes?}` (or `{flight_number, event, reason}`) → `DISRUPTION_TRIGGERED / ANALYZING` |
| GET | `/api/recovery/stream` | **SSE** agent reasoning trace (replay + live, heartbeat) |
| GET | `/api/recovery/options` | funnel + pruned summary + 3 ranked options + LLM explanation |
| POST | `/api/recovery/confirm` | `{proposal_id}` → executes via provider (`SIMULATED`, `SIM-REV-89211`, real ms) |
| POST | `/api/session/reset` | reset demo (ledger persists) |

## Demo scenarios & presenter tools

Two engineered disruption scenarios exercise the same deterministic pipeline end-to-end:

| Scenario | Trigger | Impact graph shape |
|---|---|---|
| **Cancellation** — Typhoon Trami cancels SQ856 | button / `D` key | hard-zero: hub closed, misconnect guaranteed → risk **87 CRITICAL** |
| **Delay** — CX520 slips (custom 15–180m via slider) | button / `E` key | compression: buffers scale with delay (45m → risk **41 HIGH**, 120m → 47) |

**Presenter keyboard shortcuts** (state-aware, never misfire; `?` shows the overlay):

| Key | Action |
|---|---|
| `D` / `E` | trigger cancellation / delay scenario (NORMAL only) |
| `A` | approve & execute the recommended plan (AWAITING_APPROVAL only) |
| `R` | reset the demo session |
| `P` | print / save the one-page run summary as PDF |
| `?` / `Esc` | toggle / close the shortcuts overlay |

**Judge evidence artifacts** (all generated from live session data — nothing fabricated):
- **Run Report** (header) — full session JSON export
- **Evidence CSV** (header) — execution ledger + complete agent event trace
- **Summary** (header / `P`) — one-page A4 print summary: itinerary, disruption, funnel, options, LLM explanation, execution steps, ledger

**Cockpit extras:** live SSE agent trace with per-phase filter chips (judge Q&A), 5-criteria finalist radar with hover tooltips and a shape+text status legend (color-blind friendly), before/after recovery routing strip, animated decision funnel, residual-risk gauge, and a collapsible "How It Works" architecture deep-dive (safety invariant, scoring model, provider abstraction).

## Stack

Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 + shadcn/ui · framer-motion · Prisma + SQLite · **Alibaba Cloud Model Studio (Qwen)** with a Z.AI SDK alternate and deterministic template fallback (all backend-only) · SSE route handlers · MCP-over-HTTP (JSON-RPC 2.0) · Lucide icons.

## Key sources

- `src/lib/flightresist/` — engine: `constraints.ts`, `optimizer.ts`, `impact-graph.ts`, `state-machine.ts`, `fixture.ts` (42 candidates), `providers/` (base / demo / atlas-sandbox), `llm.ts`, `pipeline.ts`
- `src/components/flightresist/` — Operations Cockpit UI
- **`QODER_EVIDENCE.md`** — one-page Qoder & Alibaba Cloud usage evidence
- **`DEPLOY.md`** — Alibaba Cloud ECS runbook (`deploy/` holds the Caddyfile, systemd unit, and bootstrap script)
- `IMPLEMENTATION_STATUS.md` — Phase 0 verification record & decisions
- `ATLAS_ENVIRONMENT_SETUP.md` — Atlas Skill / CLI setup record
- `FUTURE_PROGRESS.md` — remaining roadmap and honest gap analysis
- `docs/QODER_UPGRADE_PLAN.md` — Qoder Final Upgrade & Competition Execution Plan ([PDF](file:///docs/FlightResist%20AI%202.0%20Upgrade%20Plan.pdf))

## License

[MIT](./LICENSE) © 2026 Ahmad Jamshid Nabizada

