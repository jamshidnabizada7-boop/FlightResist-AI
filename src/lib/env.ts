/**
 * Environment variable validation — imported early to fail fast on misconfiguration.
 *
 * Every variable the app reads is declared here with its default / optional status.
 * See `.env.example` for the canonical reference.
 */

function optional(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

function optionalUrl(name: string): string | undefined {
  const value = process.env[name];
  if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
    console.warn(`[env] ${name} does not look like a valid URL: ${value}`);
  }
  return value;
}

// --- Validate on import ---

export const env = {
  // Runtime
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  // Database (Prisma + SQLite)
  DATABASE_URL: optional('DATABASE_URL', 'file:./db/custom.db'),

  // Travel provider selection (demo | atlas | auto)
  ATLAS_MODE: optional('ATLAS_MODE', 'demo'),

  // LLM explanation layer (auto | qwen | zai | template)
  LLM_PROVIDER: optional('LLM_PROVIDER', 'auto'),

  // Alibaba Cloud Model Studio (DashScope) — OpenAI-compatible endpoint
  DASHSCOPE_API_KEY: optional('DASHSCOPE_API_KEY'),
  DASHSCOPE_BASE_URL: optionalUrl('DASHSCOPE_BASE_URL'),
  QWEN_MODEL: optional('QWEN_MODEL', 'qwen-plus'),
} as const;

// --- Informational warnings ---------------------------------------------------

if (env.ATLAS_MODE === 'demo') {
  console.info('[env] Running in DEMO mode — no real bookings will be made');
}
if (!env.DASHSCOPE_API_KEY) {
  console.info('[env] No DASHSCOPE_API_KEY configured — LLM will use template fallback');
}
