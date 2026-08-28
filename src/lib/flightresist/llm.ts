/**
 * FlightResist AI 2.0 — LLM Explanation & Trade-Off Reasoner
 *
 * ARCHITECTURAL INVARIANT: the LLM is explanation-only. It receives the
 * deterministic engine's computed scores and is prompt-locked from recomputing
 * or contradicting them. All arithmetic lives in the deterministic TypeScript
 * modules. If the LLM call fails or times out, a deterministic template
 * explanation is produced — the pipeline never blocks on the LLM.
 *
 * Backends (selected by LLM_PROVIDER, default `auto`):
 *   QWEN     — Alibaba Cloud Model Studio (DashScope OpenAI-compatible endpoint).
 *              Active when DASHSCOPE_API_KEY is present. No SDK dependency: plain fetch.
 *   ZAI      — z-ai-web-dev-sdk (Alibaba-ecosystem LLM served through Z.AI).
 *   TEMPLATE — deterministic template only; the LLM is never called.
 *
 * `auto` prefers QWEN when a key is configured and otherwise falls back to ZAI,
 * so an environment with no new variables set behaves exactly as before.
 * Whichever backend is chosen, it remains explanation-only and the deterministic
 * template is always the failure path.
 */

import ZAI from 'z-ai-web-dev-sdk';
import type { Itinerary, RecoveryAnalysis, LlmExplanation, LlmFactPayload, ScoredOption } from './types';

/** Strip or escape potential prompt-injection patterns from user-controlled fields. */
function sanitizeForPrompt(input: string): string {
  return input
    .replace(/\r?\n/g, ' ')           // Remove newlines that could break prompt structure
    .replace(/```/g, '')               // Remove code fences
    .replace(/\b(ignore|disregard|forget|override|system|assistant|user)\b.*?(instructions|prompt|above|previous)/gi, '[redacted]')
    .slice(0, 200);                     // Limit length to prevent flooding
}

const LLM_TIMEOUT_MS = 9000;

/** Alibaba Cloud Model Studio — OpenAI-compatible chat completions. */
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const QWEN_MODEL = process.env.QWEN_MODEL ?? 'qwen-plus';

type LlmBackend = 'QWEN' | 'ZAI' | 'TEMPLATE';

/** Resolves which backend to call. Unset env → previous behaviour (ZAI). */
function selectBackend(): LlmBackend {
  switch ((process.env.LLM_PROVIDER ?? 'auto').toLowerCase()) {
    case 'qwen':
      return 'QWEN';
    case 'zai':
      return 'ZAI';
    case 'template':
      return 'TEMPLATE';
    default:
      return DASHSCOPE_API_KEY ? 'QWEN' : 'ZAI';
  }
}

function optionContext(o: ScoredOption): string {
  const c = o.candidate;
  const routing = c.legs.map((l) => `${l.flightNumber} ${l.from}→${l.to}`).join(' · ');
  return [
    `Option ${o.label} (${o.status}) — ${c.label}`,
    `Routing: ${routing}`,
    `Departs ${c.depIso} / arrives ${c.arrIso} (JST) — ${o.metrics.delayHours}h later than the original plan`,
    `Fare difference: $${o.metrics.fareDiffUsd} of a $${'150'} rebooking budget`,
    `Connection: ${o.metrics.connectionMin === null ? 'nonstop' : `${o.metrics.connectionMin} min layover`}`,
    `Deterministic multi-criteria score R = ${o.recoveryScore} (arrival ${o.scores.arrival}, connection ${o.scores.connection}, price ${o.scores.price}, baggage ${o.scores.baggage}, risk ${o.scores.risk})`,
    `Residual trip risk if booked: ${o.residualRisk}/100`,
    `Engine reason: ${o.reason}`,
  ].join('\n');
}

function buildPrompt(analysis: RecoveryAnalysis, itinerary: Itinerary, payload: LlmFactPayload): string {
  const meeting = itinerary.commitments.find((c) => c.kind === 'MEETING');

  // Phase 5: compact deterministic fact payload embedded in the prompt
  const factBlock = [
    `DETERMINISTIC FACT PAYLOAD (you may only reference these values — never recompute):`,
    `  recommended: Option ${payload.recommended}, R=${payload.score}`,
    `  fare_diff: $${payload.fareDiff}, delay: +${payload.delayHours}h`,
    `  meeting_preserved: ${payload.meetingPreserved}, budget_pass: ${payload.budgetPass}, connection_pass: ${payload.connectionPass}`,
    `  residual_risk: ${payload.residualRisk}/100`,
    `  impacts_resolved: ${payload.impactsResolved.join(', ') || 'none'}`,
    `  impacts_remaining: ${payload.impactsRemaining.join(', ') || 'none'}`,
    ...payload.alternatives.map(
      (a) => `  alt ${a.label}: R=${a.score}, $${a.fareDiff}, +${a.delayHours}h, meeting=${a.makesMeeting}, risk=${a.residualRisk}, status=${a.status}`,
    ),
  ].join('\n');

  return [
    `DISRUPTION: ${sanitizeForPrompt(analysis.disruption.flightNumber)} ${sanitizeForPrompt(analysis.disruption.event)} — ${sanitizeForPrompt(analysis.disruption.reason)}. ${sanitizeForPrompt(analysis.disruption.detail)}`,
    `TRIP PURPOSE: ${itinerary.tripPurpose}. The mission-critical commitment is "${meeting?.label}" at ${meeting?.atIso} (${meeting?.location}).`,
    `TRIP RISK SCORE (deterministic): ${analysis.impactGraph.riskScore}/100 (${analysis.impactGraph.severity}).`,
    `CANDIDATE FUNNEL (deterministic): ${analysis.constraintResult.totalCandidates} candidates searched → ${analysis.constraintResult.prunedSummary.over_budget} over budget, ${analysis.constraintResult.prunedSummary.unsafe_connection} unsafe connections, ${analysis.constraintResult.prunedSummary.baggage_incompatible} baggage-incompatible → ${analysis.constraintResult.survivors.length} finalists ranked.`,
    '',
    factBlock,
    '',
    ...analysis.options.map(optionContext),
    '',
    'TASK: Using ONLY the fact payload above, explain to the traveler why the engine recommends the top option, why the others lost, and what trade-offs remain. Be concrete about the 08:30 signing meeting in Marunouchi, the arrival times, and the money.',
  ].join('\n');
}

const SYSTEM_PROMPT = `You are the Explanation Module of FlightResist AI, an autonomous travel-recovery engine.
A deterministic scoring engine has ALREADY computed every score, rank, count, and latency. You never recompute, question, correct, or invent numbers — you explain the numbers you are given, and you may only reference numbers that appear verbatim in the user message.
Rules:
- Never perform arithmetic or introduce new figures; quote existing ones only.
- Never override or cast doubt on the deterministic ranking.
- Voice: calm, precise operations officer. Plain English. No markdown headers. No emojis.
Respond with STRICT JSON only (no code fences, no extra text) in exactly this shape:
{"headline": "one sentence, max 18 words", "summary": "2-3 sentences", "tradeoffs": [{"option": "A|B|C", "verdict": "RECOMMENDED|SECONDARY|ALTERNATIVE", "text": "1-2 sentences"}], "confidenceNote": "1 sentence stating scores were computed deterministically and you are explanation-only"}`;

function templateExplanation(analysis: RecoveryAnalysis, payload: LlmFactPayload): LlmExplanation {
  const rec = analysis.options.find((o) => o.status === 'RECOMMENDED');
  const second = analysis.options.find((o) => o.status === 'SECONDARY');
  const rejected = analysis.options.find((o) => o.status === 'ALTERNATIVE');
  const budget = 150;
  return {
    headline: rec
      ? `Rebook via ${rec.candidate.label.replace(' · via', '')}: protects the 08:30 signing for $${rec.metrics.fareDiffUsd}.`
      : 'Recovery plan ready.',
    summary: rec
      ? `The deterministic engine searched ${analysis.constraintResult.totalCandidates} alternatives and ranked ${analysis.constraintResult.survivors.length} viable finalists. Option ${rec.label} scores R=${rec.recoveryScore} — it preserves the Marunouchi signing with ${rec.residualRisk < 20 ? 'low' : 'moderate'} residual risk (${rec.residualRisk}/100) while using only $${rec.metrics.fareDiffUsd} of the $${budget} rebooking budget.`
      : '',
    tradeoffs: [
      rec
        ? { option: rec.label, verdict: 'RECOMMENDED', text: `${rec.reason} Residual trip risk drops from 87 to ${rec.residualRisk}/100.` }
        : { option: '-', verdict: 'RECOMMENDED', text: '' },
      second
        ? { option: second.label, verdict: 'SECONDARY', text: second.reason }
        : { option: '-', verdict: 'SECONDARY', text: '' },
      rejected
        ? { option: rejected.label, verdict: 'ALTERNATIVE', text: rejected.reason }
        : { option: '-', verdict: 'ALTERNATIVE', text: '' },
    ],
    confidenceNote:
      'All scores, counts, and rankings were computed by the deterministic engine; this explanation is generated from those values only.',
    source: 'TEMPLATE',
    model: 'deterministic-template',
    latencyMs: 0,
    factPayload: payload,
  };
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

/** Raw completion text plus the model label surfaced to the UI as evidence. */
type BackendResult = { text: string; model: string };

/** Alibaba Cloud Model Studio (DashScope) via its OpenAI-compatible REST surface. */
async function callQwen(prompt: string): Promise<BackendResult> {
  if (!DASHSCOPE_API_KEY) throw new Error('DASHSCOPE_API_KEY is not set');
  const res = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
    // Releases the socket if Model Studio stalls; the outer race still guards latency.
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Model Studio HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    model: `alibaba-cloud-model-studio · ${QWEN_MODEL}`,
  };
}

/** z-ai-web-dev-sdk — the original backend, unchanged. */
async function callZai(prompt: string): Promise<BackendResult> {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    thinking: { type: 'disabled' },
  });
  return {
    text: completion.choices[0]?.message?.content ?? '',
    model: 'z-ai-web-dev-sdk · Qwen-family chat completion',
  };
}

/** Generates the plain-English trade-off explanation (LLM → template fallback).
 *  Phase 5: receives the deterministic fact payload to embed in the LLM prompt
 *  and to expose on the response as evidence. */
export async function generateExplanation(
  analysis: RecoveryAnalysis,
  itinerary: Itinerary,
  factPayload: LlmFactPayload,
): Promise<LlmExplanation> {
  const started = Date.now();
  const backend = selectBackend();
  try {
    if (backend === 'TEMPLATE') throw new Error('LLM disabled by LLM_PROVIDER=template');
    const prompt = buildPrompt(analysis, itinerary, factPayload);
    const { text, model } = await Promise.race([
      backend === 'QWEN' ? callQwen(prompt) : callZai(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), LLM_TIMEOUT_MS),
      ),
    ]);

    const parsed = JSON.parse(stripFences(text)) as LlmExplanation;
    if (!parsed.headline || !parsed.summary || !Array.isArray(parsed.tradeoffs)) {
      throw new Error('LLM response missing required fields');
    }
    return {
      headline: String(parsed.headline).slice(0, 160),
      summary: String(parsed.summary).slice(0, 900),
      tradeoffs: parsed.tradeoffs.slice(0, 4).map((t) => ({
        option: String(t.option ?? '-').slice(0, 4),
        verdict: String(t.verdict ?? '').slice(0, 16),
        text: String(t.text ?? '').slice(0, 420),
      })),
      confidenceNote: String(parsed.confidenceNote ?? '').slice(0, 300),
      source: 'LLM',
      model,
      latencyMs: Date.now() - started,
      factPayload,
    };
  } catch (err) {
    console.error('[flightresist] LLM explanation fell back to template:', err instanceof Error ? err.message : err);
    const fallback = templateExplanation(analysis, factPayload);
    return { ...fallback, latencyMs: Date.now() - started };
  }
}
