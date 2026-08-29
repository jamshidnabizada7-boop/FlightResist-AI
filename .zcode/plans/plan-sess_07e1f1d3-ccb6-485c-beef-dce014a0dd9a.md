# Fix: BOOKING-stage 500 — make Atlas status honest and reads resilient

## Root cause (confirmed in code)

1. **The Render container cannot run the atlas-flight CLI for real.** The CLI stores credentials in an OS secure-credential facility; `node:24-slim` has none, so every real command returns `SECURE_STORE_UNAVAILABLE` (terminal_error). The Dockerfile only proves `--version` works.
2. **The probe is dishonest.** `probeAtlas()` (`src/lib/flightresist/providers/atlas-sandbox.ts:118-158`) only checks `--version` and swallows `auth status` failures ("non-fatal"), so the UI shows "Atlas Connected" while every live operation fails.
3. **3 CLI failures open the circuit breaker** (`src/lib/flightresist/providers/index.ts:64-74`), and
4. **Every read-only `GET /api/trip/current` calls `getActiveProvider()`** (`src/lib/flightresist/api.ts:39`), which *throws* for persisted-LIVE users when the probe fails or the breaker is OPEN (`index.ts:200-227`) → 500 → UI error state "Unable to load trip data".

The frontend already blocks *switching* to LIVE when `/api/atlas/status` says unavailable (`header-bar.tsx:140-143`), but a user whose preference is already persisted as LIVE (your account) still hits the throw on every poll.

## Changes

### 1. Honest probe — `src/lib/flightresist/providers/atlas-sandbox.ts`
- In `probeAtlas()`, after `--version` succeeds, parse `auth status --json` and branch on `code`:
  - `SECURE_STORE_UNAVAILABLE` → `available: false` with detail: the OS secure credential store is unavailable in this deployment, so live Atlas operations cannot run (self-hosted environments provide it).
  - `AUTHORIZATION_REQUIRED` / not-authenticated → keep `available: true` (CLI + store are fine) but include `authenticated: false` in the result/detail so the UI can show "needs authorization".
- Extend `AtlasProbeResult` with `authenticated?: boolean` and a machine-readable `reason` string; keep the 60 s TTL cache.

### 2. Accurate LIVE-mode error — `src/lib/flightresist/providers/index.ts`
- In the LIVE branch (lines 204-208), replace the hardcoded "CLI is not installed" message with one built from `probe.detail`/`reason`, so users see the real cause (e.g. secure store unavailable) instead of a wrong "not installed" claim.

### 3. Richer status endpoint — `src/app/api/atlas/status/route.ts`
- Return `{ available, reason, authenticated }` from the probe instead of only a hardcoded "CLI not found" reason.

### 4. Reads must not 500 on provider health — `src/lib/flightresist/api.ts`
- In `currentTripResponse()`, wrap the `getActiveProvider()` call: on failure, select the **demo provider** for the read and attach `live_unavailable: true` + `live_unavailable_reason` to the `CurrentTripResponse` payload. The trip data always loads (state lives in the session store/DB, independent of provider); the LIVE badge becomes an explicit, labeled degradation rather than a crash. This honors the "never *silently* fail over" principle — the payload loudly declares the fallback.

### 5. Frontend surfaces the degradation — `src/hooks/use-flightresist.ts` + `src/components/flightresist/header-bar.tsx`
- `use-flightresist.ts`: when the trip payload has `live_unavailable`, show a connection-warning banner with the reason (instead of the error state caused by the current HTTP 500).
- `header-bar.tsx`: use the dynamic `reason` from `/api/atlas/status` in the "Live mode unavailable on this deployment" dialog instead of the hardcoded "not installed" text; the "Atlas Connected / Not available" chip becomes accurate automatically via the honest probe.

## Out of scope (per your selection) — noted for later
- **GitHub OAuth `invalid_client`**: `GITHUB_ID`/`GITHUB_SECRET` on Render (`src/lib/auth.ts:84-88`) are wrong/expired — update them in the Render dashboard; no code change needed.
- **Transient Prisma/Neon "connection kind: Closed"** errors: not addressed.
- **Real live booking on Render** (dbus/gnome-keyring in Docker): not attempted. Note: even self-hosted, your ATRIP account shows `TICKETING_ACTIVATION_REQUIRED` (`ATLAS_ENVIRONMENT_SETUP.md`) — real ticketing needs activation at atriptech.com/#/workspace.

## Verification
1. `bun run build` (or `npm run build`) passes; lint clean.
2. Local with CLI present: behavior unchanged (probe available, LIVE selectable).
3. Simulate Render (PATH without `atlas-flight` or forced probe failure): `/api/atlas/status` returns `available: false` + reason; with a persisted LIVE user, `GET /api/trip/current` returns **200** with demo-labeled data + `live_unavailable_reason`; UI shows the banner and "Atlas Not available" chip; switching to LIVE shows the explainer dialog with the accurate reason.