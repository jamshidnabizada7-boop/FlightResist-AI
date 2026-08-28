/**
 * FlightResist AI 2.0 — Session Constants (edge-safe)
 *
 * Pure constants shared between the Edge-runtime middleware and the Node
 * server code. Must NOT import anything (no node: APIs) — middleware runs in
 * the Edge runtime where Node built-ins are unavailable.
 */

/** Cookie carrying the opaque session ID (isolation only — NOT authentication). */
export const SESSION_COOKIE_NAME = 'fr-session';

/** Session lifetime / idle TTL: 30 minutes. */
export const SESSION_TTL_SECONDS = 30 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

/**
 * Shared legacy session. Cookie-less clients (curl, smoke tests, the MCP
 * JSON-RPC endpoint) resolve to this session — exactly the pre-multi-user
 * single-session behavior, so every existing flow keeps working unchanged.
 */
export const DEFAULT_SESSION_ID = 'default';
