# 🏆 ANTIGRAVITY IMPROVEMENTS — FlightResist AI 2.0

**Goal: 1st Place at the Alibaba Cloud × Atlas Agentic AI Hackathon 2026**
**Submission Deadline: 30 Aug 2026, 23:59 SGT (UTC+8)**
**Time Remaining: ~5 days**
**Document Created: 25 Aug 2026**

> This document is a **360-degree audit** of the FlightResist AI 2.0 project,
> analyzing every source file, API route, test suite, configuration, deployment
> artifact, and documentation file. It maps the current state against the four
> judging criteria and delivers a ranked, actionable improvement plan.
>
> **No project files were modified to produce this document.**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Honest Scorecard — Where You Stand Today](#2-honest-scorecard)
3. [Critical Blockers (Must Fix or You Don't Win)](#3-critical-blockers)
4. [High-Impact Improvements (Points per Hour)](#4-high-impact-improvements)
5. [Engineering Improvements (Code Quality & Robustness)](#5-engineering-improvements)
6. [UI/UX Improvements](#6-uiux-improvements)
7. [Alibaba Cloud Integration Gaps](#7-alibaba-cloud-integration-gaps)
8. [Atlas API Integration Assessment](#8-atlas-api-integration-assessment)
9. [Qoder Platform Usage Assessment](#9-qoder-platform-usage-assessment)
10. [Test Coverage Analysis](#10-test-coverage-analysis)
11. [Deployment Readiness](#11-deployment-readiness)
12. [Demo Video Script & Strategy](#12-demo-video-strategy)
13. [Documentation & Judge Experience](#13-documentation--judge-experience)
14. [What NOT to Touch](#14-what-not-to-touch)
15. [5-Day Execution Plan](#15-5-day-execution-plan)
16. [Risk Matrix](#16-risk-matrix)
17. [Competitive Edge Analysis](#17-competitive-edge-analysis)
18. [Submission Checklist](#18-submission-checklist)

---

## 1. Executive Summary

### What's Genuinely Strong

Your project is **architecturally superior** to 90%+ of what will be submitted. Here is the evidence:

| Strength | Evidence File(s) |
|---|---|
| **Deterministic engine is authoritative, LLM is explanation-only** | `optimizer.ts`, `constraints.ts`, `impact-graph.ts` — all closed-form TypeScript, no LLM in the loop |
| **Weighted Trip Impact Graph** | 6-node dependency graph with calibrated weights (meeting = 58%), risk = Σ wᵢ·pᵢ, yields exactly 87/100 |
| **42→3 decision funnel** | Hard constraints applied in strict order with deterministic pruning — not a gimmick |
| **Multi-criteria scoring model** | R = .35·arrival + .25·connection + .20·price + .10·baggage + .10·risk — defensible, tested |
| **Real Atlas Sandbox transaction** | End-to-end verified: search → fare verify → confirm-price → order → pay → TICKETED with live PNR (S78066) |
| **91/91 safety assertions** | Including "no approval → no transaction" and "double approval → exactly one transaction" |
| **Working MCP server** | Real JSON-RPC 2.0 over HTTP, 5 tools, delegates to same engine as REST API, 17/17 smoke tests |
| **Provider abstraction** | Clean `BaseTravelProvider` → `DemoProvider` / `AtlasSandboxProvider` with runtime probe |
| **State machine with guards** | 8 states, enforced transitions, approval gate is non-bypassable, execution lock prevents races |
| **Honest disclosure** | `[ENV: DETERMINISTIC DEMO]` badge, `SIM-*` references, never fabricates PNRs |
| **Complete UI cockpit** | 18 specialized components, presenter shortcuts (D/E/A/R/P/C/?), risk gauge, radar chart, funnel animation |

### What Will Cost You 1st Place (If Unfixed)

| Gap | Impact on Score |
|---|---|
| **🔴 No 3-minute video** | FATAL. No video = no submission = not scored. Worth 20% of rubric. |
| **🔴 No Alibaba Cloud deployment** | No public URL. Judges can't try it. Feasibility = 30% of rubric. |
| **🟠 Alibaba Cloud Model Studio not activated** | `llm.ts` has full Qwen code but no API key configured. Alibaba Cloud engineers are judging. |
| **🟡 README not optimized for judges** | Opens with architecture. Should open with "try it in 30 seconds." |

### Estimated Score

| Criterion | Weight | Today | After Fixes | Points Gained |
|---|---|---|---|---|
| Innovation | 30% | 26/30 | 27–28/30 | +1–2 |
| Feasibility | 30% | 20/30 | 26–28/30 | +6–8 |
| Qoder/Alibaba Cloud | 20% | 12/20 | 18–19/20 | +6–7 |
| Demo Presentation | 20% | 0/20 | 17–19/20 | +17–19 |
| **Total** | | **~58–68** | **~88–94** | **+20–26** |

**You are not behind on engineering. You are behind on proof.**

---

## 2. Honest Scorecard

### Innovation (30%) — Current: 26/30

**What's working:**
- The "deterministic engine is authoritative, LLM is explanation-only" position is genuinely novel. 90% of hackathon demos will be LLM-wrapper agents.
- Trip Impact Graph with weighted dependency nodes (meeting = 58%) is original and defensible.
- The 42→3 pruning funnel is visual, verifiable, and understandable.
- Multi-criteria scoring with transparent weights is rare in this space.
- Two disruption scenarios (cancellation + delay) demonstrate different graph shapes.
- The Why Engine (`why-engine.ts`) produces structured causal facts per option.

**What's holding you back:**
- Only one O&D pair (SIN→NRT). Even one more would demonstrate generalizability.
- The "agentic" aspect is somewhat performative — 6 actor labels on pipeline stages, not independently reasoning agents. This is **fine and honest**, but be ready for the question.

**Improvement opportunity (LOW priority):** A second fixture for a different O&D would show generalizability, but **skip this if you're behind on the video.**

### Feasibility (30%) — Current: 20/30

**What's working:**
- Real Atlas CLI integration (0.3.12) with verified end-to-end sandbox booking
- Provider abstraction cleanly separates demo from live
- 91 safety assertions prove the system behaves correctly
- SQLite persistence with `hydrateFromDb()` survives restarts
- Production build verified (`next build` → standalone bundle, 61ms boot)
- Production-specific bugs already fixed (commit `20b4cde`: SQLite path, AgentEvent.agent column, query logging)

**What's killing your score:**
- **No public URL.** App runs on `localhost:3000`. Judges interpret "feasibility" as "could this go live?" — answer today is "on my laptop."
- **Single-session architecture.** `globalThis.__flightresistSession` = one user at a time. Fine for hackathon but must be acknowledged, not hidden.
- **No rate limiting on API routes.** A judge who double-clicks could see a 409.

### Qoder/Alibaba Cloud (20%) — Current: 12/20

**What's working:**
- MCP server is real, functional, verified (17/17 smoke tests)
- `qoder_mcp_config.json` properly binds tools into a Qoder workspace
- Atlas Skill installed and hash-pinned in `skills-lock.json`
- `QODER_EVIDENCE.md` is honest (especially §5 on limits — earlier docs over-claimed and this was corrected)
- `llm.ts` has the Qwen/DashScope integration fully implemented (lines 148-176)
- Bidirectional angle: "Qoder built this AND this is callable by Qoder"

**What's missing:**
- **No `DASHSCOPE_API_KEY` configured.** Qwen integration is code-ready but falls back to Z.AI/template.
- **No Alibaba Cloud ECS deployment.** `deploy/` has complete scripts but none executed.

### Demo Presentation (20%) — Current: 0/20

**Nothing exists.** No script, no storyboard, no recording, no upload. This is the single biggest risk.

---

## 3. Critical Blockers

### 🔴 BLOCKER 1: No Demo Video — CANNOT SUBMIT WITHOUT THIS

**Status:** Not started
**Fix time:** 2–3 days (script + record + edit + re-record)
**Priority:** HIGHEST

The submission form requires a 3-minute video. No video = no entry = zero points.

**Your first take WILL be 5 minutes long and you WILL hate it. Budget 2 full days.**

See Section 12 for the complete 178-second shot-by-shot script.

### 🔴 BLOCKER 2: No Alibaba Cloud Deployment — Worth ~8 to 12 points

**Status:** Deploy scripts ready (`deploy/bootstrap.sh`, `Caddyfile`, `flightresist.service`), never executed
**Fix time:** 2–4 hours (if Alibaba Cloud account is ready)
**Priority:** HIGH

**No code changes required.** This is purely operational:
1. Provision Alibaba Cloud ECS in Singapore (`ap-southeast-1`)
2. Run `FLIGHTRESIST_DOMAIN=<ip>.sslip.io ./deploy/bootstrap.sh`
3. Verify the public URL

### 🟠 BLOCKER 3: Qwen Not Activated — Worth ~4 to 6 points

**Status:** `llm.ts` has full implementation (lines 28-47: backend selection, lines 148-176: `callQwen()`)
**Fix time:** 30 minutes
**Priority:** HIGH — after deployment

All you need:
1. Get a DashScope API key from https://bailian.console.alibabacloud.com/
2. Set `DASHSCOPE_API_KEY=sk-xxx` in the deployed environment
3. Verify the explanation panel shows `source: QWEN` instead of `TEMPLATE`

The template fallback is already proven to work when the key is missing — this is risk-free.

---

## 4. High-Impact Improvements (Ranked by Points per Hour)

### 4.1 Deploy to Alibaba Cloud ECS — Worth ~+8 points · ~2 hours

```bash
# On the ECS instance:
apt-get update && apt-get install -y git
git clone --depth 1 https://github.com/jamshidnabizada7-boop/FlightResist-AI.git /tmp/fr
cd /tmp/fr
FLIGHTRESIST_DOMAIN=<your-ip>.sslip.io ./deploy/bootstrap.sh
```

**Instance spec:** `ecs.e-c1m2.large` (2 vCPU / 4 GB), Ubuntu 24.04, Singapore region.
**No code changes.** The `bootstrap.sh` is idempotent and syntax-verified.

### 4.2 Activate Qwen on DashScope — Worth ~+4 points · ~30 minutes

```bash
printf 'LLM_PROVIDER=qwen\nDASHSCOPE_API_KEY=sk-your-key\n' > /etc/flightresist.env
chmod 600 /etc/flightresist.env
systemctl restart flightresist
```

### 4.3 Record the 3-Minute Demo Video — Worth ~+18 points · ~2 days

See Section 12.

### 4.4 Record One Real Atlas Sandbox Run — Worth ~+3 points · ~30 minutes

**Presentation improvement, not engineering:**
1. Set `ATLAS_MODE=atlas` in `.env` (config only)
2. Do ONE clean end-to-end flow, capture screen + terminal with real PNR
3. Set `ATLAS_MODE=demo` back
4. Include as 15-second clip in the video

**⚠️ ONE run only. Sandbox rate-limits duplicate bookings.**

### 4.5 Restructure README for Judges — Worth ~+2 points · ~1 hour

Current README opens with architecture. A judge's first 15 seconds need:
1. One-sentence pitch
2. **Live URL** (once deployed)
3. "Try it in 30 seconds" with keyboard shortcuts
4. Four-row table answering Innovation / Feasibility / Qoder / Demo with file links

### 4.6 Add Health Check Endpoint — Worth ~+1 point · ~15 minutes

Create `src/app/api/health/route.ts`:
```typescript
export async function GET() {
  return Response.json({
    status: "ok", version: "2.0.0",
    provider: process.env.ATLAS_MODE ?? "demo",
    uptime: process.uptime()
  });
}
```

Small thing that judges notice. Says "this developer thinks about production."

---

## 5. Engineering Improvements

### 5.1 Session Architecture — ACKNOWLEDGE, DON'T FIX

**Current:** `globalThis.__flightresistSession` — single in-memory session
**Assessment:** Acceptable for hackathon. `hydrateFromDb()` handles restart recovery correctly.

**What to say:** "Single active session — this is an MVP. Production targets Redis/PostgreSQL-backed multi-session."

### 5.2 Error Handling Gaps Found

| Location | Issue | Risk | Action |
|---|---|---|---|
| `pipeline.ts:68` | `void runRecoveryPipeline()` fire-and-forget | LOW — catch block sets FAILED state | Don't fix |
| `store.ts:184` | Event persistence is fire-and-forget (`void db.agentEvent.create()`) | LOW — events replayed from memory | Don't fix |
| `store.ts:99,149` | Prisma errors caught with `console.error` only | LOW — no alerting in hackathon | Don't fix |
| `atlas-sandbox.ts:130-138` | Auth probe failure silently swallowed | LOW — demo continues | Don't fix |

**Recommendation:** All acceptable for demo. Be ready to discuss if asked "what would you change for production?"

### 5.3 Type Safety — Minor Issues

| Location | Issue |
|---|---|
| `store.ts:142` | `(e.agent as TraceActor \| null)` — assertion instead of runtime validation |
| `pipeline.ts:282` | `o.why!` — non-null assertion (always populated at this point but type doesn't express it) |

**Recommendation:** Ignore for hackathon. These are correct at runtime.

### 5.4 `.env` Configuration Issue

**Current `.env` has `ATLAS_MODE=atlas`** — but Atlas CLI is not available in your environment. This means the provider probe will fail and fall back to Demo mode anyway. For the deployed version, ensure `ATLAS_MODE=demo` is set explicitly (the `flightresist.service` already does this correctly).

### 5.5 `next.config.ts` — `ignoreBuildErrors: true`

This is set to avoid 2 known TypeScript errors in `examples/websocket/*` which aren't part of the app. **Acceptable for hackathon** but note it during a code review.

---

## 6. UI/UX Improvements

### 6.1 First-Load Experience — Add Visual Hint

When a judge first opens the app, there's no "start here" guidance. The "Simulate Disruption" button should have a subtle pulse or tooltip. **10 minutes of work.**

### 6.2 Completed Features (Good, Don't Touch)

| Feature | Status | Notes |
|---|---|---|
| Mobile responsiveness (390px) | ✅ Verified | No horizontal overflow |
| Color-blind accessibility | ✅ Built | Shape+text legend on radar |
| Demo checklist overlay | ✅ Built | 8-step guided run, `C` shortcut |
| Print summary | ✅ Built | `P` shortcut, 1-page A4 |
| Keyboard shortcuts | ✅ Built | D/E/A/R/P/C/? — state-aware, never misfire |
| SSE agent trace | ✅ Built | Real-time with phase filters, agent badges |
| Decision funnel animation | ✅ Built | Animated width bars, count-up |
| Risk gauge | ✅ Built | Semicircle SVG, expo-out sweep |
| Before/after routing strip | ✅ Built | Shows original vs recovery route |
| Evidence exports | ✅ Built | JSON run report, CSV, PDF summary |

---

## 7. Alibaba Cloud Integration Gaps

### Current State

| Alibaba Cloud Service | Code-Ready? | Actually Used? | Fix Required |
|---|---|---|---|
| **ECS (compute)** | ✅ Scripts ready | ❌ Never deployed | Run `bootstrap.sh` |
| **Model Studio (Qwen)** | ✅ Full implementation in `llm.ts` | ❌ No API key | Set `DASHSCOPE_API_KEY` |
| Qoder platform | ✅ | ✅ Development + MCP server | None |

### What to Say in the Video

**If ECS + Qwen ship:**
> "FlightResist runs on Alibaba Cloud ECS in Singapore — the same city as this venue — with reasoning powered by Qwen on Alibaba Cloud Model Studio."

**If only ECS ships:**
> "FlightResist is deployed on Alibaba Cloud ECS in Singapore."

**If neither ships (contingency):**
> "Deployment-ready for Alibaba Cloud ECS. The standalone bundle, systemd unit, and Caddyfile are in the repo."

**Never claim something that isn't true.**

---

## 8. Atlas API Integration Assessment

### Verified End-to-End Chain

| Step | CLI Command | Code Location | Status |
|---|---|---|---|
| Runtime probe | `atlas-flight --version` + `auth status --json` | `atlas-sandbox.ts:118-158` | ✅ |
| Flight search | `search --origin --destination --depart --adults --json` | `atlas-sandbox.ts:376-408` | ✅ |
| Offer verify | `offer verify --offer-id --json` → `booking_id` + `traveler_id` | `atlas-sandbox.ts:410-454` | ✅ |
| Price confirm | `booking confirm-price --booking-id --json` → `PRICE_CONFIRMED` | `atlas-sandbox.ts:437-441` | ✅ |
| Order create | `order create --booking-id --passengers-stdin --json` | `atlas-sandbox.ts:456-528` | ✅ |
| Order pay | `order pay --confirmation-id --json` → PNR + ticket | `atlas-sandbox.ts:529-569` | ✅ |
| Order status | `order status --order-no --json` | `atlas-sandbox.ts:583-619` | ✅ |

**Full chain reached `TICKETED` with real airline PNRs (S78066, S72135).**

### Quality Assessment

**Excellent practices:**
- `assertCode()` branches on `code`, never `message` — per Atlas SDK rules
- `retryOnce()` only on read operations — order/payment NEVER retried (per SKILL.md safety)
- Session offer cache with TTL awareness — prevents stale offer resurrection
- Fare deltas computed against cheapest-offer baseline — preserves funnel budget semantics
- `FAMILY/GIVEN` uppercase name formatting for passenger data
- Sandbox passport data included to avoid `PASSENGER_INFO_REQUIRED` round-trips

**Known limitations (acceptable):**
- `seatsLeft: 99` hardcoded — Atlas search doesn't surface this
- `otp: 0.8` hardcoded — no real OTP data from Atlas
- Production ticketing blocked by `TICKETING_ACTIVATION_REQUIRED`

**What to say:** "Sandbox-verified, production ticketing pending Atlas activation." This is a **strength**, not a weakness.

---

## 9. Qoder Platform Usage Assessment

### What's Real and Verifiable

| Capability | Evidence | Verification |
|---|---|---|
| Qoder built Phases 1–10 | `QODER_UPGRADE_STATUS.md` (1,643 lines), `worklog.md` | Development history |
| Atlas Skill installed | `skills-lock.json` with hash `dffbe3c0...` | `cat skills-lock.json` |
| MCP server functional | `src/app/api/mcp/route.ts` — 5 tools, JSON-RPC 2.0 | `node tests/mcp-smoke.mjs` → 17/17 |
| MCP config for Qoder | `qoder_mcp_config.json` | Workspace import |
| Subagents used | Search, CodeReview, Debug, Browser, GeneralPurpose, plan-agent | `QODER_EVIDENCE.md §3` |
| Bidirectional | Qoder built the app AND the app is callable by Qoder | Architecture |

### MCP Implementation Quality

The MCP server is **production-quality:**
- Correct JSON-RPC 2.0 error codes (`-32700`, `-32601`, `-32602`, `-32603`)
- Tool errors: `isError: true` inside successful envelope (per MCP convention)
- All 5 tools delegate to same engine functions as REST API — zero drift
- Discovery manifest via GET with full JSON Schema
- Handles `initialize`, `tools/list`, `tools/call`

### Improvements for QODER_EVIDENCE.md

1. **Add visual evidence** — screenshot of MCP `tools/list` response or Qoder workspace with tools loaded
2. **Move bidirectional angle to line 1** — "Qoder built this app AND this app is callable by Qoder" should be the first thing a judge reads
3. **Add "verify in 30 seconds" at the top**, not the bottom

---

## 10. Test Coverage Analysis

### Existing Suites (Excellent)

| Suite | Tests | Status | Coverage |
|---|---|---|---|
| `phase6-safety.mjs` | 91 assertions | ✅ All pass | Trust & safety: approval gates, idempotency, state transitions, failure paths, failure classification |
| `mcp-smoke.mjs` | 17 checks | ✅ All pass | MCP JSON-RPC protocol, all 5 tools, discovery manifest |
| `atlas-golden-flow.mjs` | Full flow | ✅ All pass | E2E: trigger → analyze → approve → execute → recover |
| `atlas-chain-smoke.mjs` | CLI chain | ✅ Verified | Direct CLI testing with fallback routes |

### What's NOT Tested (Acceptable Gaps)

| Gap | Risk | Priority |
|---|---|---|
| Delay scenario API path | LOW — same pipeline | Skip |
| LLM with real Qwen key | MEDIUM — template fallback tested | Verify once key is set |
| Concurrent requests | LOW — single session by design | Skip |
| UI component rendering | LOW — browser agent verified | Skip |

**Recommendation: Do NOT add more tests.** "91 safety assertions" is a selling point. Don't dilute it.

---

## 11. Deployment Readiness

### Production Build — Verified

| Check | Status | Details |
|---|---|---|
| `next build` | ✅ Passes | Standalone bundle at `.next/standalone/` |
| `start:prod` | ✅ Ready | `NODE_ENV=production bun .next/standalone/server.js` boots in 61ms |
| Production bugs | ✅ Fixed | Commit `20b4cde`: SQLite path, AgentEvent.agent column, query logging |

### Deployment Artifacts — Complete

| File | Status | Quality |
|---|---|---|
| `deploy/bootstrap.sh` | ✅ | Idempotent, `set -euo pipefail`, well-documented, 150 lines |
| `deploy/Caddyfile` | ✅ | TLS auto-cert, SSE `flush_interval -1`, security headers, compression |
| `deploy/flightresist.service` | ✅ | Systemd with `NoNewPrivileges`, `ProtectSystem=strict`, `ReadWritePaths` |
| `DEPLOY.md` | ✅ | Step-by-step with troubleshooting table |

### Security Checklist

| Check | Status |
|---|---|
| No secrets in repo | ✅ `.env` has no API keys |
| Port 3000 not exposed | ✅ Caddy proxies; loopback only |
| SQL injection | ✅ Prisma ORM, parameterized queries |
| CORS | ✅ Same-origin (full-stack Next.js) |
| Rate limiting | ❌ Not implemented (acceptable for demo) |

---

## 12. Demo Video Strategy

### Requirements

- **Max length:** 3:00 (NOT 3:01 — assume hard cutoff)
- **Format:** Screen recording with voiceover, burned-in captions
- **Resolution:** 1080p, upload to YouTube/Vimeo/Loom
- **Submit by:** 29 Aug (one day before deadline for safety margin)

### Shot-by-Shot Script (178 seconds)

---

#### `0:00–0:18` — The Problem (18s)
**On screen:** Cockpit in NORMAL state. Trip overview: SQ856 SIN→HKG, CX520 HKG→NRT. Mission line visible.

> "This traveller signs a contract in Tokyo at 8:30 tomorrow morning. Right now, at 5:30 AM, a typhoon is about to cancel his first flight. Today, what happens next is an SMS, a two-hour phone queue, and a missed meeting. The airline tells him his *flight* is cancelled. Nobody tells him his *trip* is broken."

**Why this beat:** Frames the problem as *downstream itinerary impact* — your differentiator.

---

#### `0:18–0:32` — What FlightResist Is (14s)
**On screen:** Slow pan across the cockpit.

> "FlightResist is an autonomous travel recovery engine. When an active journey breaks, it reasons about the whole itinerary, finds the optimal recovery, and executes it — with exactly one human confirmation."

---

#### `0:32–1:00` — Detection + Trip Impact Graph (28s)
**On screen:** Click SIMULATE DISRUPTION. SSE trace runs. Risk gauge: 0→87. Impact graph lights up.

> "Disruption detected. The supervisor agent builds a trip impact graph — not just the cancelled flight, but the misconnection, the late arrival, the hotel, the transfer, and the meeting. The meeting carries fifty-eight percent of this trip's value. Trip risk: eighty-seven out of a hundred. Critical."

**On-screen label:** `TRIP RISK 87/100 — CRITICAL`

**Editing note:** Let the agent trace be visibly *live*. This proves agentic behaviour.

---

#### `1:00–1:30` — The Decision Funnel + Scoring (30s)
**On screen:** Funnel animates 42→30→12→3. Three option cards appear. Option B has RECOMMENDED badge.

> "Forty-two recovery candidates. Deterministic filters remove twelve over budget, eighteen with unsafe connections below the sixty-minute minimum, nine with incompatible baggage. Three survive. A weighted score — arrival, connection, price, baggage, residual risk — ranks them. Option B scores eighty-two. Via Taipei, three hours later, forty-three dollars more, and it protects the meeting."

**On-screen labels:** `42 → 30 → 12 → 3` then `OPTION B · R = 82.0 · +$43 · +3h · MEETING PRESERVED`

---

#### `1:30–1:48` — The Safety Boundary ⭐ YOUR BEST 18 SECONDS (18s)
**On screen:** Hold on approval gate. "No transaction has occurred yet" clearly readable. LLM panel visible.

> "Here is the part that matters. The engine decided this — closed-form, deterministic, testable. The language model only explains it. It cannot compute, re-rank, or override a safety constraint. And nothing has been booked. No money has moved. The agent is autonomous right up to the transaction, and then it stops and asks."

**On-screen label:** `NO TRANSACTION · LLM = EXPLANATION ONLY`

**⚠️ DO NOT CUT THIS BEAT.** Every judge has seen an agent demo that silently spent money. This sentence separates you from them. It maps directly onto Innovation AND Feasibility.

---

#### `1:48–2:12` — Execution (24s)
**On screen:** Click CONFIRM RECOVERY. Modal runs steps with real ms timings. State: RECOVERED. Risk: 87→18.

> "One tap. Verify fare, create order, pay, ticket — each step timed, each step attributed to the agent that performed it. Recovery executed. Trip risk drops from eighty-seven to eighteen. The meeting is safe."

**On-screen label:** `RECOVERED · RISK 87 → 18`

---

#### `2:12–2:27` — "This Is Not a Mock" (15s)
**On screen:** Cut to real Atlas Sandbox run (Day 2 capture). Terminal: real PNR visible.

> "That run was the deterministic demo provider, so it behaves identically every time. But the same code path drives the real Atlas API. Here it is against the Atlas Sandbox — real fare verification, real order, real payment, real airline PNR. Production ticketing is pending Atlas activation; everything up to it is verified."

**Why this beat:** Converts your biggest Feasibility liability into a Feasibility asset.

---

#### `2:27–2:45` — The Stack (18s)
**On screen:** Architecture diagram, live URL in browser, MCP tool list.

> "Atlas provides the airline layer — a hundred and forty carriers through one API, integrated through the official Atlas Skill. It runs on Alibaba Cloud in Singapore. And the agent surface is real MCP — five tools over JSON-RPC, so any Qoder workspace can drive this engine directly. FlightResist isn't just an app; it's a recovery capability other agents can call."

**Adjust to reality:** If Qwen landed, add "reasoning with Qwen on Model Studio." If ECS didn't land, say "deployment-ready for Alibaba Cloud ECS." **Never narrate something that isn't true.**

---

#### `2:45–2:58` — Close (13s)
**On screen:** Live URL + GitHub URL, both large and readable. Hold for full 13 seconds.

> "Ninety-one safety assertions. Zero fabricated bookings. One confirmation between an agent and a traveller's money. Try it yourself — it's live, and it's open source."

---

### Recording Checklist

- [ ] Reset session to NORMAL before every take (press `R`)
- [ ] Browser at 1920×1080, zoom 100%, no bookmarks bar, no extensions
- [ ] Close every notification source: email, chat, calendar, OS banners
- [ ] Hide Next.js dev overlay if it appears
- [ ] Record each of 8 beats as **separate clips** (don't do one continuous take)
- [ ] Do **3+ takes** of the 1:30–1:48 safety beat (your most important 18 seconds)
- [ ] Capture Atlas Sandbox proof clip **once** (rate limits)
- [ ] Burn in captions/subtitles (judges are international, may watch muted)
- [ ] On-screen labels over every key number (RISK 87, 42→3, R=82.0)
- [ ] Show live URL on screen for ≥5 seconds
- [ ] Final runtime **≤ 2:58** (not 3:01)
- [ ] Watch the whole thing muted. Then watch it on a phone.
- [ ] Upload, verify link in **incognito window**

---

## 13. Documentation & Judge Experience

### README.md — Restructure Top Section

**Current:** Opens with architecture and the `BaseTravelProvider` diagram.
**Needed:** Opens with the judge landing experience.

**New top structure (in this order):**
1. One-sentence pitch + track badge
2. **Live URL** (large, prominent)
3. "Try it in 30 seconds" — D → A → R
4. Four-row rubric table: Innovation / Feasibility / Qoder / Demo — each with 1-line answer + file link
5. Verify-it-yourself commands (3 test suites)
6. Then architecture, API contract, etc.

### QODER_EVIDENCE.md — Polish

**Current quality: 7/10.** Improvements:
1. Move "bidirectional" angle to the opening line
2. Add `curl` command showing MCP discovery at the deployed URL
3. Add screenshot of MCP `tools/list` response

### Suggested: JUDGE_QUICKSTART.md

One-page document for judges:
- Live URL
- "Run the full demo in 60 seconds"
- "Verify claims" with 3 test suite commands
- Architecture diagram (embedded)
- Links to 5 key source files

---

## 14. What NOT to Touch

**The discipline that wins this: finish what exists, prove what exists, deploy what exists.**

| Do NOT Build | Why |
|---|---|
| Kubernetes / microservices / service mesh | Judges see unfocus, not impressiveness, on a solo 5-day timeline |
| Multi-tenant auth / enterprise IAM | Zero rubric points. Days of work. |
| Conversational chatbot interface | **Actively harmful** — undermines your "LLM is not in the control path" differentiator |
| Hotel / rail / bus / multi-modal APIs | Your own spec put these out of scope. Half-built breadth loses to finished depth |
| Rewrite or "improve" the scoring engine | It's calibrated, tested 91/91. Touching it risks your evidence chain |
| More disruption scenarios | Two is enough. A third adds nothing in 180 seconds |
| A slide deck | The organizers said **"NO SLIDES. SHIP SOMETHING REAL."** |
| Rewrite any existing component | Every change risks regression. Your code is working and tested. |

---

## 15. 5-Day Execution Plan

### Day 1 — Mon 25 Aug: Alibaba Cloud Deployment ⚡

| Time | Task | Blocks if fails? |
|---|---|---|
| Morning | Sign into Alibaba Cloud, verify billing/free-trial | YES |
| Midday | Provision ECS Singapore, run `bootstrap.sh` | YES |
| Afternoon | Verify golden flow on public URL | YES |
| Evening | Get DashScope API key, set `LLM_PROVIDER=qwen`, verify | No — fallback works |

**Done when:** A stranger on a phone can load the URL, press D, see analysis, press A, see RECOVERED.

**Contingency:** If billing can't be resolved by end of day, stop fighting it. State "deployment-ready for Alibaba Cloud ECS" in video. You lose ~4 points but keep integrity.

### Day 2 — Tue 26 Aug: Atlas Proof + Video Prep

| Time | Task |
|---|---|
| Morning | Set `ATLAS_MODE=atlas`, ONE clean sandbox run, capture terminal + screen |
| Midday | Set `ATLAS_MODE=demo` back, verify demo path intact |
| Afternoon | Finalize video script, practice narration out loud 3× |
| Evening | Set up recording environment, test screen capture |

### Day 3 — Wed 27 Aug: Record Raw Footage

| Time | Task |
|---|---|
| Full day | Record each of 8 beats as separate clips |
| | Record clean audio separately |
| | 3+ takes of the safety beat (1:30–1:48) |
| | Review, re-record weak spots |

### Day 4 — Thu 28 Aug: Edit + Polish

| Time | Task |
|---|---|
| Morning | Edit video: cut to ≤2:58, burn in captions, on-screen labels |
| Midday | Restructure README.md top section; Polish QODER_EVIDENCE.md |
| Afternoon | Export 1080p, upload, verify in incognito |
| Evening | Re-run all 3 test suites against deployed URL |

### Day 5 — Fri 29 Aug: Submit

| Time | Task |
|---|---|
| Morning | Fresh-eyes test: phone, different browser, full flow |
| Midday | `git status` clean, push to `origin/main` |
| Afternoon | **SUBMIT THE FORM** |
| Evening | Confirm email received |

### Day 6 — Sat 30 Aug: Buffer

Reserved for the thing that will go wrong. If nothing does, re-record weakest 20 seconds.

---

## 16. Risk Matrix

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Alibaba Cloud account can't be set up | Medium | HIGH | Fall back to "deployment-ready" claim |
| DashScope API key doesn't work | Low | MEDIUM | Template fallback proven; Z.AI SDK works |
| Atlas Sandbox run fails during recording | Medium | MEDIUM | You already have Phase 1 proof; capture once, don't retry |
| Video takes longer than expected | **HIGH** | **HIGH** | Start Day 2, not Day 4. First take WILL be too long. |
| Demo breaks during recording | LOW | HIGH | Demo is deterministic — same inputs = same outputs |
| Judge sees RECOVERED state on load | Medium | LOW | Session persists; note "press R to reset" in README |
| Test suite regresses | LOW | MEDIUM | Don't change code; re-run before submit |
| Submission form times out | Low | CRITICAL | Submit Day 5 (29th), not deadline day |

---

## 17. Competitive Edge Analysis

### Why You Should Win

1. **Architectural honesty.** "Deterministic engine is authoritative; LLM is explanation-only" — the opposite of every other submission, and the RIGHT answer for travel safety.

2. **Real Atlas integration.** Most submissions will mock APIs or use search only. You drove a real booking to `TICKETED` with a real PNR.

3. **Provable safety.** 91 assertions including "no approval → no transaction" and "double approval → exactly one transaction." Verifiable live.

4. **MCP is bidirectional.** Qoder built the app AND the app is callable by Qoder. This is the agentic ecosystem angle judges want.

5. **Deterministic demo.** Will never fail on camera. Same inputs → same outputs. Always.

### What Competitors Will Do (and Why You're Different)

| Competitor Pattern | Why You Beat It |
|---|---|
| "ChatGPT wrapper that searches flights" | You have a deterministic engine. They have a prompt. You have safety invariants. They have vibes. |
| "Multi-agent system that talks to itself" | Your agents are pipeline stages with clear responsibilities. Theirs are chat threads with non-deterministic output. |
| "Beautiful UI with simulated data" | You have real Atlas data AND beautiful UI. And your simulations are honestly labeled. |
| "Uses every Alibaba Cloud service" | You use the RIGHT services (ECS + Model Studio). They scatter-shot for checkboxes. |

### The Three Questions Judges Will Ask

**Q: "What happens when the LLM is wrong?"**
→ It can't be wrong in a way that matters. It never touches constraints, scores, ranking, or the state machine. Show `llm.ts` lines 95-102 (the system prompt that locks it) and the template fallback.

**Q: "How do you make money?"**
→ Airlines and OTAs pay per successful recovery. The cost baseline is the call-centre and hotel-voucher spend they already carry when a flight cancels.

**Q: "Why won't an airline just build this?"**
→ Airlines optimize their own metal. Recovery across carriers, hotels, and ground transfers is a cross-provider problem — exactly what the Atlas layer makes possible.

---

## 18. Submission Checklist — 29 Aug

- [ ] Video ≤ 3:00, uploaded, link verified in incognito
- [ ] Live URL loads for a stranger; full flow completes; reset works
- [ ] GitHub repo public, README.md is judge-shaped, LICENSE present ✅
- [ ] QODER_EVIDENCE.md present and readable in 60 seconds ✅
- [ ] **No credentials, API keys, or `.env` committed** — re-verify
- [ ] `git status` clean, everything pushed to `origin/main`
- [ ] Test suites re-run and passing (91/91, 17/17, golden flow)
- [ ] Submitted via official form **by 29 Aug** (not deadline day)
- [ ] Confirmation email received and saved

---

## Final Words

**Your engine is not the problem. Your proof is.**

The recovery intelligence, the provider abstraction, the safety invariants, the MCP surface — all of this is top-bracket work. You are not behind on engineering. You are behind on three things:

1. **A video** (20% of the score, and it doesn't exist)
2. **A public URL** (makes Feasibility credible)
3. **Qwen on Model Studio** (makes Alibaba Cloud integration real)

**If you only have time for two things: the video, and the Alibaba Cloud deployment. In that order.**

The strongest posture available to you: *"Here is precisely what is real, here is precisely what is simulated and why, and here is exactly what production requires."* Judges hear that maybe twice in a whole day of pitches. It is memorable.

---

*This document is advisory only. No project files were modified or deleted to produce it.*
