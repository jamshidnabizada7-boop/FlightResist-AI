/**
 * FlightResist AI 2.0 — LLM Explanation & Trade-Off Reasoner
 *
 * ARCHITECTURAL INVARIANT: the LLM is explanation-only. It receives the
 * deterministic engine's computed scores and is prompt-locked from recomputing
 * or contradicting them. All arithmetic lives in the deterministic TypeScript
 * modules. If every LLM call fails or times out, a deterministic template
 * explanation is produced — the pipeline never blocks on the LLM.
 *
 * Backends (OpenAI-compatible chat completions; tried in order, first key wins,
 * and a failed/slow backend falls through to the next within a shared 9 s
 * budget — then to the deterministic template):
 *   DASHSCOPE   — Alibaba Cloud Model Studio (Qwen, preferred / first-class).
 *   GROQ        — Groq OpenAI-compatible endpoint; default model is a Qwen
 *                 instruct model (qwen/qwen3.8-27b) served by Groq.
 *   GEMINI      — Google Gemini via its OpenAI-compatible surface.
 *   OPENROUTER  — OpenRouter (e.g. qwen/qwen-plus) when funded.
 *   TEMPLATE    — deterministic template reasoner; instant and 100% offline-ready.
 */

import type { Itinerary, RecoveryAnalysis, LlmExplanation, LlmFactPayload, ScoredOption } from './types';

/** Strip or escape potential prompt-injection patterns from user-controlled fields. */
function sanitizeForPrompt(input: string): string {
  return input
    .replace(/\r?\n/g, ' ')           // Remove newlines that could break prompt structure
    .replace(/```/g, '')               // Remove code fences
    .replace(/\b(ignore|disregard|forget|override|system|assistant|user)\b.*?(instructions|prompt|above|previous)/gi, '[redacted]')
    .slice(0, 200);                     // Limit length to prevent flooding
}

/** Shared wall-clock budget across ALL backend attempts; template takes over after this. */
const LLM_TOTAL_TIMEOUT_MS = 9000;
/** A backend attempt shorter than this cannot produce a useful completion — stop the chain. */
const MIN_ATTEMPT_MS = 1500;

type LlmBackend = 'DASHSCOPE' | 'GROQ' | 'GEMINI' | 'OPENROUTER';

interface ProviderConfig {
  id: LlmBackend;
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  /** Honest, provider-accurate label surfaced to the UI as evidence. */
  label: string;
  /** Strict JSON mode via response_format — only enabled where verified. */
  jsonMode: boolean;
}

function providerConfigs(): ProviderConfig[] {
  return [
    {
      id: 'DASHSCOPE',
      apiKey: process.env.DASHSCOPE_API_KEY || process.env.ALIBABA_CLOUD_API_KEY,
      baseUrl: process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      model: process.env.QWEN_MODEL ?? 'qwen-plus',
      label: `alibaba-cloud-model-studio · ${process.env.QWEN_MODEL ?? 'qwen-plus'}`,
      jsonMode: true,
    },
    {
      id: 'GROQ',
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL ?? 'qwen/qwen3.8-27b',
      label: `groq · ${process.env.GROQ_MODEL ?? 'qwen/qwen3.8-27b'} (Qwen via Groq)`,
      jsonMode: false,
    },
    {
      id: 'GEMINI',
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      label: `google-gemini · ${process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'}`,
      jsonMode: false,
    },
    {
      id: 'OPENROUTER',
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL ?? 'qwen/qwen-plus',
      label: `openrouter · ${process.env.OPENROUTER_MODEL ?? 'qwen/qwen-plus'}`,
      jsonMode: false,
    },
  ];
}

/** Backends to try, in priority order. `LLM_PROVIDER` overrides; 'auto' = key presence. */
function resolveChain(): ProviderConfig[] {
  const all = providerConfigs();
  const override = (process.env.LLM_PROVIDER ?? 'auto').toLowerCase();
  if (override === 'template') return [];
  if (override === 'qwen') {
    // Legacy alias: prefer Alibaba Cloud Model Studio explicitly.
    return all.filter((p) => p.id === 'DASHSCOPE' && p.apiKey);
  }
  if (override !== 'auto') {
    const picked = all.find((p) => p.id.toLowerCase() === override && p.apiKey);
    return picked ? [picked] : [];
  }
  return all.filter((p) => Boolean(p.apiKey));
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

/** Raw completion text plus the honest model label surfaced to the UI as evidence. */
type BackendResult = { text: string; model: string };

/** One OpenAI-compatible chat completion against a provider config. */
async function callProvider(p: ProviderConfig, prompt: string, budgetMs: number): Promise<BackendResult> {
  if (!p.apiKey) throw new Error(`${p.id} API key is not set`);
  const body: Record<string, unknown> = {
    model: p.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  };
  if (p.jsonMode) body.response_format = { type: 'json_object' };
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify(body),
    // Bounds latency AND releases the socket if the provider stalls; the shared
    // budget across the chain is enforced by the caller.
    signal: AbortSignal.timeout(budgetMs),
  });
  if (!res.ok) {
    throw new Error(`${p.id} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    model: p.label,
  };
}

/** Raw completion plus its validated parse and the honest model label for the UI. */
type ChainResult = BackendResult & { parsed: LlmExplanation };

/**
 * Try every configured backend within the shared wall-clock budget.
 * A failing backend (bad key, 402 credits, stall, malformed JSON) falls through
 * to the next; exhausting the chain throws so the caller uses the template.
 */
async function callChain(prompt: string): Promise<ChainResult> {
  const chain = resolveChain();
  if (chain.length === 0) throw new Error('No LLM backend configured (LLM_PROVIDER=template or no keys)');
  const deadline = Date.now() + LLM_TOTAL_TIMEOUT_MS;
  let lastErr: unknown;
  for (const p of chain) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    try {
      const result = await callProvider(p, prompt, remaining);
      const parsed = JSON.parse(stripFences(result.text)) as LlmExplanation;
      if (!parsed.headline || !parsed.summary || !Array.isArray(parsed.tradeoffs)) {
        throw new Error('LLM response missing required fields');
      }
      return { ...result, parsed };
    } catch (err) {
      lastErr = err;
      console.warn(
        `[flightresist] LLM backend ${p.id} failed — falling through to next provider:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All LLM backends failed');
}

/** Generates the plain-English trade-off explanation (LLM chain → template fallback).
 *  Phase 5: receives the deterministic fact payload to embed in the LLM prompt
 *  and to expose on the response as evidence. */
export async function generateExplanation(
  analysis: RecoveryAnalysis,
  itinerary: Itinerary,
  factPayload: LlmFactPayload,
): Promise<LlmExplanation> {
  const started = Date.now();
  try {
    const prompt = buildPrompt(analysis, itinerary, factPayload);
    const { parsed, model } = await callChain(prompt);
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
