# FUTURE PROGRESS

**FlightResist AI 2.0 — Road to 1st Place**
Alibaba Cloud × Atlas Agentic AI Hackathon 2026 · Singapore

| | |
|---|---|
| Written | 24 Aug 2026 |
| Submission deadline | **30 Aug 2026, 23:59 SGT (UTC+8)** |
| Time remaining | **6 days** |
| Code state | **FROZEN** at commit `2398e87` (`origin/main`) |
| This document | **Advisory only.** No source file was created, modified, or deleted to produce it. |

> Every recommendation below that would touch code is marked **`⚠ NEEDS YOUR APPROVAL`**.
> The freeze you ordered is still in force. Nothing here has been executed.

---

## 0. TL;DR — read this part even if you read nothing else

**Your engine is not the problem. Your proof is.**

You are not behind on engineering. You are behind on the three things that judges actually put a number against:

1. **A 3-minute video** — this is the *only* mandatory deliverable, worth 20%, and it does not exist yet. Without it you are not scored at all.
2. **Alibaba Cloud is not in your stack.** Rule 02 of the competition says the prototype must use *"Atlas data and capabilities, Alibaba Cloud infrastructure, and Qoder."* You have Atlas (real, verified). You have Qoder (real MCP server + Atlas Skill). You have **zero Alibaba Cloud** — no compute, no Model Studio / Qwen API, no hosted URL. Alibaba Cloud engineers are on the judging panel. They will notice.
3. **Your Qoder evidence is buried** in a 1,643-line status document. A judge gives you 90 seconds of reading, not 90 minutes.

Everything else — the deterministic engine, the impact graph, the funnel, the approval gate, the 91/91 safety suite, the real Atlas sandbox PNR — is already better than most of what will be submitted. Do not touch it.

**Estimated score today: ~68–74 / 100. The fixes in this document are worth roughly +20, and none of them require rewriting the recovery engine.**

---

## 1. Honest scorecard against the actual rubric

| Criterion | Weight | Estimate today | Why | Ceiling after the 6-day plan |
|---|---|---|---|---|
| **Innovation** | 30% | **25–27** | Genuinely differentiated. "Deterministic engine is authoritative, LLM is explanation-only" is a real architectural position, not a slogan — and it is the *opposite* of what 90% of agent demos will do. The weighted Trip Impact Graph (meeting node carries 58% of trip value) and the 42→30→12→3 pruning funnel are original and legible. Loses a little for a single hardcoded route. | 27–28 |
| **Feasibility** | 30% | **20–23** | The strongest fact you own: the real `atlas-flight` 0.3.12 CLI was driven end-to-end in Sandbox and reached `TICKETED` with a live airline PNR. That is not a mock. **But** it runs on `localhost:3000`, state lives in `globalThis`, the database is a single SQLite file, there is one session, no auth, no deployment, no public URL. "Feasibility" is read by judges as *"could this actually go live?"* — and right now the honest answer is "on my laptop." | 26–28 |
| **Use of Qoder / Alibaba Cloud** | 20% | **12–14** | Real and verifiable: `src/app/api/mcp/route.ts` is a working MCP-over-HTTP JSON-RPC 2.0 server (5 tools, 17/17 smoke checks), `qoder_mcp_config.json` binds it into a Qoder workspace, and the official Atlas Skill is installed and pinned in `skills-lock.json`. **But** the evidence is unreadable at judging speed, and **no Alibaba Cloud service is used at all.** The LLM is `z-ai-web-dev-sdk`, not Model Studio / Qwen. | 18–19 |
| **Demo Presentation** | 20% | **0** | Not started. No script, no storyboard, no recording, no captions, no upload. | 17–19 |
| | | **~68–74** | | **~88–94** |

### Why "68–74" is not an insult

Most hackathon submissions score 40–60 because they demo a wrapper around a chat model. You have a real state machine, real provider abstraction, real transaction safety, and a real airline PNR. You are already in the top bracket on the two criteria that carry 60% of the score.

You are losing the *other* 40% on things that are, bluntly, **easier to fix than what you have already built.**

---

## 2. The five gaps, ranked by points-per-hour

### GAP 1 — No 3-minute video · worth ~**+18** · BLOCKING
**Severity: fatal if unfixed.** The submission form takes a video. No video = no entry. This is not optional and it is not something you can do at 22:00 on 30 Aug. Budget **two full days** (script + record + edit + re-record), because your first take will be 5 minutes long and you will hate it.

Full shot-by-shot script is in **Section 5**. It is written to hit all four rubric criteria inside 180 seconds.

### GAP 2 — Alibaba Cloud is nowhere in your stack · worth ~**+8**
**Severity: high, and it is a credibility gap, not just a checkbox.** Two independent fixes, in priority order:

**2a. Deploy the app to Alibaba Cloud ECS in Singapore (`ap-southeast-1`).**
This requires **zero application code changes**. Your `package.json` already builds a standalone bundle (`next build` → `.next/standalone`), and the `Caddyfile` already exists as a reverse proxy. Deploying is: provision a small ECS instance → install Node 24 → copy the standalone bundle + `db/custom.db` → run it behind Caddy → point a hostname at it.
Judging bonus: the region is the same city as the pitch venue. Say that out loud in the video.
Cost: a `t6-c1m1.large`-class instance for one week is small money; new-account free trials generally cover it. **Verify the cost before you provision — do not assume.**

**2b. Route the explanation layer through Alibaba Cloud Model Studio (Qwen).** **`⚠ NEEDS YOUR APPROVAL`**
Your original specification said *"LLM Explanation & Trade-Off Reasoner (Qwen 3.8 / Qoder)"*. The build shipped `z-ai-web-dev-sdk` instead. `src/lib/flightresist/llm.ts` already has exactly the right shape for this — a single provider call wrapped in a timeout with a deterministic template fallback — so this is a *contained* change at one boundary, not a refactor. Model Studio exposes an OpenAI-compatible endpoint, so it is a client swap plus an env var.

This turns *"built for the Alibaba Cloud hackathon"* into *"runs on Alibaba Cloud, reasons with Qwen on Alibaba Cloud, deployed in Alibaba Cloud Singapore."* That is a different sentence.

**Risk to manage:** this touches code inside a frozen build, three days before the deadline. If you approve it, it must be done as an *additive provider* with the existing template fallback left completely intact, verified with the existing test suites (`phase6-safety.mjs` 91/91, `atlas-golden-flow.mjs`, `mcp-smoke.mjs` 17/17), and committed separately so it can be reverted in one command. If any test drops below its current number, revert and ship 2a alone.

### GAP 3 — Qoder evidence is unreadable at judging speed · worth ~**+5**
`QODER_UPGRADE_STATUS.md` is 1,643 lines. It is excellent as an engineering record and useless as an exhibit. You need one page, ~80 lines, that a judge can absorb in 60 seconds and that maps each Qoder capability to a *file they can open*. Documentation only — no code. See **Section 4, Day 3**.

### GAP 4 — Judges see `[ENV: DETERMINISTIC DEMO]` and no real-booking proof · worth ~**+4**
This is a *presentation* bug, not an engineering one. You genuinely completed a real Atlas Sandbox booking to `TICKETED` with a live PNR — and your video, as currently planned, would never show it. A judge watching only the demo mode will privately mark you down as "simulated."

Fix: keep the main narrative in demo mode (it is deterministic and it will not fail live on camera — this is the correct choice), and add a **15-second "this is not a mock" beat** that shows the real Atlas Sandbox execution with its real PNR. Flipping `ATLAS_MODE` in `.env` is a **config change, not a code change**, and can be done for a single recorded take.

⚠ Do **not** attempt repeated live `order create` / `order pay` calls during recording — the sandbox rate-limits duplicate bookings, and this was already documented as a known constraint in Phase 10. Do one clean run, capture it, keep the terminal output as an artifact.

⚠ Production ticketing is still blocked by `TICKETING_ACTIVATION_REQUIRED`. **Never** claim production ticketing works. Say "Sandbox-verified, production ticketing pending Atlas activation" — that sentence *gains* you credibility with people who know the platform.

### GAP 5 — No public URL, no LICENSE, README is not judge-shaped · worth ~**+3**
- Your repo is public at `github.com/jamshidnabizada7-boop/FlightResist-AI` but has **no LICENSE file**. Add MIT. One file, two minutes.
- The README opens with architecture. A judge's first 15 seconds should get: what it does, the live URL, the 30-second try-it, and the four rubric answers.
- If 2a lands, put the live URL in the README, in the video, and in the submission form.

---

## 3. What NOT to build — resist all of this

You wrote the out-of-scope list yourself in your original specification. It was correct then and it is more correct now with six days left.

| Do **not** build | Why |
|---|---|
| Kubernetes, microservices, service mesh | Feasibility is scored on *believability*, not infrastructure surface area. A judge who sees k8s on a solo 6-day project reads it as unfocused, not impressive. |
| Multi-tenant auth / enterprise IAM | Zero rubric points. Days of work. |
| A conversational chatbot interface | Actively harmful. It would undermine your single strongest differentiator: *the LLM is not in the control path.* |
| Hotel / rail / bus / multi-modal APIs | Your own spec put these out of scope. Half-built breadth beats nothing, but it loses to finished depth. |
| Rewriting or "improving" the scoring engine | It is calibrated, tested 91/91, and every number in your demo traces to it. Touching it risks your entire evidence chain. |
| More disruption scenarios | Two is enough. A third adds nothing a judge will see in 180 seconds. |
| A slide deck | The organisers literally wrote **"NO SLIDES. SHIP SOMETHING REAL."** |

**The discipline that wins this: finish what exists, prove what exists, deploy what exists.**

---

## 4. The 6-day plan

Times are indicative for a solo builder. Approval gates are explicit.

### Day 1 — Mon 24 Aug · Alibaba Cloud account + deployment path
**Goal: a public URL on Alibaba Cloud.** No code changes.

1. Confirm you can actually sign in to Alibaba Cloud and that billing/free-trial is usable. **Do this first** — if this blocks, the whole Day 1–2 plan changes and you fall back to the Section 4 contingency.
2. Provision one ECS instance, region **`ap-southeast-1` (Singapore)**, Ubuntu, smallest tier that runs Node comfortably (2 vCPU / 2 GB).
3. Security group: open 80/443 only.
4. Install Node 24 on the instance. Copy the built standalone bundle plus `public/`, `prisma/`, and `db/custom.db`. Run `prisma db push` once on the box.
5. Start the app, put Caddy in front for TLS, verify the golden flow end-to-end **on the public URL**: trigger → analyze → approve → RECOVERED → reset.
6. Record the URL. You will cite it in the video, the README, and the form.

**Done when:** a stranger on a phone can load the URL and complete the demo.

**Contingency if Alibaba Cloud billing cannot be resolved:** do not burn Day 2 fighting it. Instead, containerise nothing and claim nothing — state plainly in the video and README: *"Deployment target is Alibaba Cloud ECS, ap-southeast-1; the standalone bundle is deployment-ready."* You lose ~4 of the 8 points but you keep your integrity, which matters more with this panel than the 4 points.

### Day 2 — Tue 25 Aug · Qwen on Model Studio **`⚠ NEEDS YOUR APPROVAL`**
Only proceed if Day 1 finished. If Day 1 slipped, **skip this entire day** and go to Day 3 — the video outranks Qwen.

1. Create a Model Studio (Bailian) API key in the same Singapore region.
2. Add a Qwen provider *behind the existing boundary* in `src/lib/flightresist/llm.ts`. Rules, non-negotiable:
   - The deterministic template fallback stays exactly as it is.
   - The existing timeout and prompt-lock stay exactly as they are.
   - The LLM still never computes, ranks, or overrides anything.
   - Selection is by env var, defaulting to current behaviour.
3. Re-run **all three** suites and require identical numbers: `phase6-safety.mjs` **91/91**, `atlas-golden-flow.mjs` **all pass**, `mcp-smoke.mjs` **17/17**. Plus `tsc --noEmit`, `eslint src/`, `next build`.
4. Commit as one isolated, revertible commit. If anything regresses: **revert, ship without it.**

**Done when:** the LLM panel in the UI shows a Qwen-sourced explanation, with the template fallback still proven to work when the key is removed.

### Day 3 — Wed 26 Aug · Judge-facing documents (no code)
1. Write a **one-page** `QODER_EVIDENCE.md` (~80 lines): a table of Qoder capability → what it did on this project → the exact file/artifact a judge can open. Cover the MCP server, the installed Atlas Skill, the subagents used, and the phase-by-phase agent workflow. Link the long status doc as an appendix; do not make it the front door.
2. Rewrite the top third of `README.md` as a judge landing page: one-sentence pitch, **live URL**, 30-second try-it, then a four-row table answering Innovation / Feasibility / Qoder / Demo with links.
3. Add `LICENSE` (MIT).
4. Export a clean architecture diagram as an image and embed it. A judge should understand the system without reading prose.

### Day 4 — Thu 27 Aug · Capture the real Atlas Sandbox proof + record raw footage
1. Set `ATLAS_MODE=atlas` (config only). Do **one** clean end-to-end Sandbox run. Capture the terminal output and the resulting real PNR as a screen recording and a saved log. **One run.** Then set `ATLAS_MODE=demo` back and confirm the demo path is intact.
2. Record every screen segment in **Section 5** — as separate clips, not one continuous take. Separate clips let you fix one 8-second mistake without re-shooting three minutes.
3. Record clean audio separately from the screen capture if you can. Bad audio destroys more hackathon videos than bad code.

### Day 5 — Fri 28 Aug · Edit
1. Cut to **under 3:00**. Not 3:01. Assume a hard cutoff.
2. Burn in captions/subtitles — the panel is international and may watch muted.
3. Put on-screen labels over every key number (`RISK 87`, `42 → 3`, `R = 82.0`, `NO TRANSACTION YET`). Judges scan text faster than they parse speech.
4. Show the live Alibaba Cloud URL on screen for at least 5 seconds.
5. Export 1080p, upload, **verify the link works in a private/incognito window.**

### Day 6 — Sat 29 Aug · Dress rehearsal + submit
1. Fresh-eyes test: open the live URL on a phone you have not used, run the whole flow, reset.
2. Re-run the full verification suite one last time; confirm `git status` clean and pushed.
3. **Submit the form.** Do it on the 29th, not the 30th.

### Buffer — Sun 30 Aug
Reserved for the thing that will go wrong. Something always does. If nothing does, spend it re-recording the weakest 20 seconds of the video.

---

## 5. The 3-minute video script — shot by shot

**Total: 178 seconds.** Every number below is real and already verified in your build (see Appendix A). Do not improvise numbers on camera.

The structure is deliberate: **problem → agentic behaviour → safety boundary → real execution → stack → honest close.** It is ordered so that a judge who stops watching at 1:30 has already seen your strongest material.

---

### `0:00 – 0:18` · The problem (18s)
**On screen:** the cockpit in `NORMAL` state. Trip overview visible: SQ856 SIN 08:00 → HKG, CX520 HKG 14:30 → NRT 19:45. Mission line visible: contract signing, Marunouchi, 08:30 JST next morning.

> "This traveller signs a contract in Tokyo at 8:30 tomorrow morning. Right now, at 5:30 AM, a typhoon is about to cancel his first flight. Today, what happens next is an SMS, a two-hour phone queue, and a missed meeting. The airline tells him his *flight* is cancelled. Nobody tells him his *trip* is broken."

**Why this beat:** it frames the problem as *downstream itinerary impact*, which is exactly what your impact graph solves and what nobody else will demo.

---

### `0:18 – 0:32` · What FlightResist is (14s)
**On screen:** slow pan across the cockpit. Header env badge visible.

> "FlightResist is an autonomous travel recovery engine. It watches an active journey, and when it breaks, it reasons about the whole itinerary, finds the optimal recovery, and executes it — with exactly one human confirmation."

---

### `0:32 – 1:00` · Detection + Trip Impact Graph (28s)
**On screen:** click **SIMULATE DISRUPTION**. Let the live SSE agent trace run. Risk gauge animates **0 → 87**. Impact graph nodes light up.

> "Disruption detected. The supervisor agent builds a trip impact graph — not just the cancelled flight, but the misconnection, the late arrival, the hotel check-in, the airport transfer, and the meeting. The meeting carries fifty-eight percent of this trip's value. Trip risk: **eighty-seven out of a hundred. Critical.**"

**On-screen label:** `TRIP RISK 87/100 — CRITICAL`
**Editing note:** let the agent trace be visibly *live*. This is your proof of agentic behaviour rather than a scripted animation. Do not speed it up so much that it stops looking real.

---

### `1:00 – 1:30` · The decision funnel + scoring (30s)
**On screen:** the funnel animates **42 → 30 → 12 → 3** with elimination reasons. Then the three option cards, with **B** carrying the RECOMMENDED badge and the 5-criteria radar.

> "Forty-two recovery candidates. Deterministic filters remove twelve over budget, eighteen with unsafe connections below the sixty-minute minimum, nine with incompatible baggage. Three survive. Then a weighted score — arrival, connection, price, baggage, residual risk — ranks them. **Option B scores eighty-two.** Via Taipei, three hours later, forty-three dollars more, and it *protects the meeting*."

**On-screen labels:** `42 → 30 → 12 → 3` then `OPTION B · R = 82.0 · +$43 · +3h · MEETING PRESERVED`

---

### `1:30 – 1:48` · The safety boundary — your single best moment (18s)
**On screen:** hold on the approval gate. The **"No transaction has occurred yet"** indicator must be clearly readable. Then the LLM explanation panel.

> "Here is the part that matters. The engine decided this — closed-form, deterministic, testable. The language model only *explains* it. It cannot compute, it cannot re-rank, it cannot override a safety constraint. And nothing has been booked. No money has moved. The agent is autonomous right up to the transaction, and then it stops and asks."

**On-screen label:** `NO TRANSACTION HAS OCCURRED YET · LLM = EXPLANATION ONLY`

**Do not cut this beat to save time.** Every judge on that panel has seen an agent demo that silently spent money. This is the sentence that separates you from them, and it maps directly onto both Innovation and Feasibility.

---

### `1:48 – 2:12` · Execution (24s)
**On screen:** click **CONFIRM RECOVERY**. The execution modal runs its steps with real millisecond timings and agent badges. State lands on **RECOVERED**, risk gauge drops **87 → 18**, ledger row appears.

> "One tap. Verify fare, create order, pay, ticket — each step timed, each step attributed to the agent that performed it. Recovery executed. Trip risk drops from eighty-seven to eighteen. The meeting is safe."

**On-screen label:** `RECOVERED · RISK 87 → 18`

---

### `2:12 – 2:27` · "This is not a mock" (15s)
**On screen:** cut to the Day-4 capture — the real Atlas Sandbox run, real `atlas-flight` CLI output, order reaching `TICKETED`, real airline PNR visible.

> "That run was the deterministic demo provider, so it behaves identically every time. But the same code path drives the real Atlas API. Here it is against the Atlas Sandbox — real fare verification, real order, real payment, real airline PNR. Production ticketing is pending Atlas activation on our account; everything up to it is verified."

**Why this beat:** it converts your biggest Feasibility liability into a Feasibility asset, and the honest caveat about production ticketing will read as competence, not weakness.

---

### `2:27 – 2:45` · The stack (18s)
**On screen:** architecture diagram, then the live Alibaba Cloud URL in the browser address bar, then the Qoder MCP tool list.

> "Atlas provides the airline capability layer — a hundred and forty-plus carriers through one API, integrated through the official Atlas Skill. It runs on Alibaba Cloud in Singapore. And the agent surface is real MCP — five tools over JSON-RPC, so any Qoder workspace can drive this engine directly. FlightResist isn't just an app; it's a recovery capability other agents can call."

**Adjust this line to match what actually shipped.** If Day 2 (Qwen) landed, add *"reasoning with Qwen on Alibaba Cloud Model Studio."* If Day 1 (ECS) did not land, cut *"It runs on Alibaba Cloud in Singapore"* and say *"deployment-ready for Alibaba Cloud ECS."* **Never narrate something that isn't true — a judge will open the URL.**

---

### `2:45 – 2:58` · Close (13s)
**On screen:** the live URL and the GitHub repo URL, both large and readable. Hold for the full 13 seconds.

> "Ninety-one safety assertions. Zero fabricated bookings. One confirmation between an agent and a traveller's money. Try it yourself — it's live, and it's open source."

**On screen:** `LIVE: <your-url>` · `github.com/jamshidnabizada7-boop/FlightResist-AI`

---

## 6. Recording checklist

| ☐ | Item |
|---|---|
| ☐ | Reset session to `NORMAL` before **every** take |
| ☐ | Browser at 1920×1080, **zoom 100%**, no bookmarks bar, no extensions visible |
| ☐ | Close every notification source: email, chat, calendar, OS banners |
| ☐ | Hide the Next.js dev-tools overlay if it appears on camera |
| ☐ | Verify the env badge reads what you are about to *say* it reads |
| ☐ | Record each of the 8 beats as a **separate clip** |
| ☐ | Do at least 3 takes of the `1:30 – 1:48` safety beat — it is the most important 18 seconds |
| ☐ | Capture the Atlas Sandbox proof clip **once** (rate limits) |
| ☐ | Burned-in captions on the final export |
| ☐ | Final runtime **≤ 2:58** |
| ☐ | Watch the whole thing muted, then watch it on a phone |
| ☐ | Upload, then verify the link in an incognito window |

---

## 7. What to claim, and what never to claim

Feasibility is 30% of your score, and it is won by *calibration*, not by enthusiasm. A judge who catches one overclaim will discount everything else you said.

### Say this
- "The deterministic engine is authoritative. The LLM explains; it never decides."
- "Verified end-to-end against the Atlas **Sandbox** — real order, real payment, real airline PNR."
- "Production ticketing is pending Atlas account activation."
- "The demo runs the deterministic provider so it is reproducible; the identical code path drives live Atlas."
- "Ninety-one safety assertions pass, including: no approval means no transaction, and double approval produces exactly one transaction."
- "Single traveller, single active session — this is an MVP, and here is exactly what productionising it requires."

### Never say this
- ~~"It books real tickets in production."~~ It does not. `TICKETING_ACTIVATION_REQUIRED`.
- ~~"It handles any route worldwide."~~ One engineered scenario is implemented.
- ~~"Fully autonomous end to end."~~ Your approval gate is a *feature*, not a gap. Own it.
- ~~"Production ready."~~ Say **"production-shaped"**: real provider contracts, real transaction safety, real failure classification — with a named, honest list of what is still missing.
- ~~Any invented number.~~ Every figure in the video must trace to Appendix A.

**The strongest posture available to you:** *"Here is precisely what is real, here is precisely what is simulated and why, and here is exactly what production requires."* Judges hear that maybe twice in a whole day of pitches. It is memorable.

---

## 8. Submission checklist — 29 Aug

| ☐ | Item |
|---|---|
| ☐ | Video ≤ 3:00, uploaded, link verified in incognito |
| ☐ | Live URL loads for a stranger; full flow completes; reset works |
| ☐ | GitHub repo public, `README.md` is judge-shaped, `LICENSE` present |
| ☐ | `QODER_EVIDENCE.md` present and readable in 60 seconds |
| ☐ | **No credentials, API keys, or `.env` committed** — re-verify, do not assume |
| ☐ | `git status` clean, everything pushed to `origin/main` |
| ☐ | Verification suites re-run and passing at their current numbers |
| ☐ | Submitted via the official form **by the captain (you)** |
| ☐ | Confirmation email received and saved |

**Submit on 29 Aug.** Deadline-day submissions fail on upload limits, form timeouts, and timezone arithmetic. SGT is UTC+8 — check what that is where you are, and do not cut it close.

---

## 9. If you make the top 3 (contacted 10 Sep · pitch 30 Sep, Marina Bay Sands)

Three weeks between notification and stage. Do not start this work now — but know it exists so that if the call comes you are not starting from zero.

1. **The pitch is a different artifact than the demo.** Live, on stage, with investors present. Rehearse to 90% of your allotted time, out loud, standing up.
2. **Prepare for the three questions you will actually get:**
   - *"What happens when the LLM is wrong?"* → It cannot be wrong in a way that matters; it never touches constraints, scores, ranking, or the state machine. Show them the boundary in the code.
   - *"How do you make money?"* → Airlines and OTAs pay per successful recovery; the cost baseline is the call-centre and hotel-voucher spend they already carry when a flight cancels.
   - *"Why won't an airline just build this?"* → Airlines optimise *their own* metal. Recovery across carriers, hotels, and ground transfers is a cross-provider problem, which is exactly what the Atlas layer makes possible.
3. **Have one live failure ready.** Demo the `FAILED` state and its retry path on purpose. Nothing establishes engineering credibility faster than voluntarily showing your error handling.
4. **Bring an offline recording.** Venue Wi-Fi fails. Always.

---

## Appendix A — Verified evidence inventory

Every number you are permitted to say on camera. All are from the frozen build at commit `2398e87` and were re-verified in Phase 10.

### Scenario
| Field | Value |
|---|---|
| Trip | `TRIP-SIN-NRT-2026` |
| Leg 1 | SQ856 · SIN 08:00 → HKG 12:05 · **CANCELLED** (Typhoon Trami, 05:30) |
| Leg 2 | CX520 · HKG 14:30 → NRT 19:45 |
| Mission | Contract signing · Marunouchi, Tokyo · **08:30 JST next day** |
| Budget ceiling | **$150** |
| Minimum connection time | **60 min** |
| Baggage | 1 × 23 kg |

### Impact graph
| Node | Weight |
|---|---|
| Meeting / event | **0.58** |
| Arrival | 0.12 |
| Hotel | 0.10 |
| Flight | 0.08 |
| Connection | 0.06 |
| Transfer | 0.06 |
| **Trip risk (disrupted)** | **87 / 100 — CRITICAL** |
| **Residual risk (after Option B)** | **18** |

### Decision funnel
`42 candidates → 30 → 12 → 3` · removed: **12** over budget · **18** unsafe connection · **9** baggage-incompatible

### Scoring model
`R = 0.35·arrival + 0.25·connection + 0.20·price + 0.10·baggage + 0.10·risk`

| Option | Score | Status | Fare Δ | Delay | Residual risk |
|---|---|---|---|---|---|
| **B** — via Taipei (Scoot TR976 + EVA BR2198) | **82.0** | **RECOMMENDED** | **+$43** | **+3h** | **18** |
| C | 77.7 | SECONDARY | +$145 | +1.1h | 11 |
| A | 49.5 | REJECTED | $0 | +11h | 71 |

Option B detail: arrives **22:45**, connection **135 min** (≥ 60 MCT), budget headroom **$107**, **meeting preserved = true**.

### Verification results
| Suite | Result |
|---|---|
| `tests/phase6-safety.mjs` | **91 / 91 PASS** |
| `tests/mcp-smoke.mjs` | **17 / 17 PASS** |
| `tests/atlas-golden-flow.mjs` | **ALL PASS** |
| `tsc --noEmit` | clean (2 known errors in `examples/websocket/*`, not part of the app) |
| `eslint src/` | clean |
| `next build` | passes |
| Mobile 390 px | no horizontal overflow |

### Platform facts
| Item | Value |
|---|---|
| Atlas CLI | `atlas-flight` **0.3.12**, authenticated |
| Atlas Sandbox | verified end-to-end → order reached **`TICKETED`** with a real airline PNR |
| Atlas Production | **search only** · `ticketing_available: false` · blocker `TICKETING_ACTIVATION_REQUIRED` |
| Atlas Skill | installed and hash-pinned in `skills-lock.json` |
| MCP server | `src/app/api/mcp/route.ts` — JSON-RPC 2.0, **5 tools** |
| Agent trace | **33 SSE events**, 6 labels: SUPERVISOR · IMPACT_REASONER · TOOL_ORCHESTRATOR · DETERMINISTIC_ENGINE · OPTIMIZER · TRADE_OFF_EXPLAINER |
| Safety invariants | no approval → no transaction · double approval → exactly one transaction · invalid state → 409 · 7 provider-failure classes |
| Repo | `github.com/jamshidnabizada7-boop/FlightResist-AI` |
| Frozen commit | `2398e87` |

---

## Appendix B — Decisions I need from you

I have changed nothing. Before any of this happens, tell me which of these you authorise:

| # | Decision | My recommendation |
|---|---|---|
| 1 | Deploy to Alibaba Cloud ECS (Singapore). **No code changes** — build config and server setup only. | **Yes.** Highest value, lowest risk. Do it first. |
| 2 | Add a Qwen / Model Studio provider to `llm.ts`. **Unfreezes code.** | **Yes, but only after #1 succeeds, and only as an additive provider with the template fallback untouched and all three suites re-verified.** If Day 1 slips, skip it. |
| 3 | Flip `ATLAS_MODE=atlas` for **one** recorded Sandbox take, then flip back. **Config only.** | **Yes.** One run only — the sandbox rate-limits duplicates. |
| 4 | Write `QODER_EVIDENCE.md` + rewrite the README header + add `LICENSE`. **Docs only.** | **Yes.** Cheap, and it is 5 points. |
| 5 | Anything that adds features, agents, scenarios, or infrastructure beyond the above. | **No.** This is how good hackathon projects die in the last week. |

**If you only have time for two things: the video, and the Alibaba Cloud deployment.** In that order.

---

*This document is planning material. The build remains frozen at `2398e87` until you say otherwise.*
