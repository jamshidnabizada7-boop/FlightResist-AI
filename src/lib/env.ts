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

  // Database (Prisma + SQLite) — only default to SQLite in development.
  // In production the env var must be provided explicitly (e.g. Postgres on
  // Render); a silent SQLite fallback would mask a missing DATABASE_URL.
  DATABASE_URL: optional('DATABASE_URL', process.env.NODE_ENV === 'production' ? undefined : 'file:./db/custom.db'),

  // Travel provider selection (demo | atlas | auto)
  ATLAS_MODE: optional('ATLAS_MODE', 'demo'),

  // LLM explanation layer (auto | dashscope | qwen | groq | gemini | openrouter | template)
  LLM_PROVIDER: optional('LLM_PROVIDER', 'auto'),

  // Alibaba Cloud Model Studio (DashScope) — preferred Qwen endpoint
  DASHSCOPE_API_KEY: optional('DASHSCOPE_API_KEY'),
  DASHSCOPE_BASE_URL: optionalUrl('DASHSCOPE_BASE_URL'),
  QWEN_MODEL: optional('QWEN_MODEL', 'qwen-plus'),

  // Fallback explanation backends (all OpenAI-compatible; tried in order)
  GROQ_API_KEY: optional('GROQ_API_KEY'),
  GROQ_MODEL: optional('GROQ_MODEL', 'qwen/qwen3.8-27b'),
  GEMINI_API_KEY: optional('GEMINI_API_KEY'),
  GEMINI_MODEL: optional('GEMINI_MODEL', 'gemini-2.5-flash'),
  OPENROUTER_API_KEY: optional('OPENROUTER_API_KEY'),
  OPENROUTER_MODEL: optional('OPENROUTER_MODEL', 'qwen/qwen-plus'),
} as const;

// --- Informational warnings ---------------------------------------------------

if (env.ATLAS_MODE === 'demo') {
  console.info('[env] Running in DEMO mode — no real bookings will be made');
}
if (!env.DASHSCOPE_API_KEY && !env.GROQ_API_KEY && !env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) {
  console.info('[env] No LLM provider keys configured — explanations use the deterministic template fallback');
}
