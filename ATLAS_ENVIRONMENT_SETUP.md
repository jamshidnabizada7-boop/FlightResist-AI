# ATLAS_ENVIRONMENT_SETUP.md

> Environment setup report for the official **Atlas Flight Booking Skill**.
> Scope: environment preparation only. **No FlightResist application code was
> modified, refactored, rebuilt, or deleted.** Phase 1 was not started.

Generated: 2026-08-24 (final — authorization confirmed `AUTHORIZED`)

---

## 1. Environment inspection (Step 1)

| Component | Value | Status |
| --- | --- | --- |
| OS | Ubuntu 26.04 LTS (Resolute Raccoon) | — |
| Shell | `/bin/bash` | — |
| sudo | available (but **passwordless sudo is NOT available** — requires interactive authentication) | ⚠ |
| nvm | was **not** installed before setup | — |
| `node` | `v24.19.0` | ✅ installed during Step 2 |
| `npm` | `11.17.0` | ✅ installed during Step 2 |
| `npx` | `11.17.0` | ✅ installed during Step 2 |
| `bun` | not installed | ➖ not required for Atlas setup |
| `qoder` | `1.24.2` (commit `e7b4b2e3`, x64) | ✅ pre-existing, untouched |
| `git` | `2.55.0` | ✅ installed user-level during Step 3 (micromamba, no sudo) |

## 2. Node.js installation (Step 2)

Node.js/npm/npx were **missing**. Installed via a safe, user-level method
(nvm) so the existing Qoder installation was **not** touched.

- nvm `v0.40.3` installed to `~/.nvm` (official installer, sourced lines
  appended to `~/.bashrc`). No sudo used.
- LTS Node.js installed with `nvm install --lts` → **Node.js `v24.19.0`**
  (npm `11.17.0`, npx `11.17.0`), SHA-256 checksum verified by nvm.
- Default alias set to `lts/*` → `v24.19.0`.
- Binaries live at `~/.nvm/versions/node/v24.19.0/bin/`.
- Qoder re-verified after install: still `1.24.2`, fully functional. The nvm
  install only manipulated `~/.nvm` and PATH; it never touched the Qoder binary.

> Note: each new shell must source nvm (`export NVM_DIR="$HOME/.nvm"; .
> "$NVM_DIR/nvm.sh"`) or open a fresh terminal (the `~/.bashrc` lines load it
> automatically) for `node`/`npm`/`npx` to be on PATH.

## 3. Atlas Skill installation (Step 3) — ✅ COMPLETE

The documented command is:

```bash
npx --yes skills add https://github.com/atlas-doc/atlas-flight-booking-skill --skill atlas-flight-booking
```

### Result: ✅ Skill installed and registered for Qoder

The first attempt failed because the `skills` CLI (`npx skills`, version
**1.5.23**) clones the source via `git`, which was absent
(`Failed to clone …: Error: spawn git ENOENT`). The `skills` CLI requires
`git` even for a local-directory source. The official Atlas repository was
confirmed public (`atlas-doc/atlas-flight-booking-skill`, branch `main`;
*"Flight search and booking Skill for AI agents. Automatically installs the
atlas-flight CLI."*).

`git` could not be installed via `apt` (no passwordless sudo; the setup rules
forbid requesting credentials in chat), so it was installed **user-level, no
sudo** using **micromamba** (a single static binary from `micro.mamba.pm`).
micromamba created a fully self-contained **git 2.55.0** from conda-forge at
`.atlas-git/git-env/` (bundles libcurl, openssl, krb5, zlib, etc.). Because the
`bzip2` binary was absent, the micromamba tarball was extracted via Python's
`tarfile`/`bz2` modules, and conda caches were redirected into the workspace
(`XDG_CACHE_HOME`, `CONDA_PKGS_DIRS`, `MAMBA_ROOT_PREFIX`) to avoid HOME
writes.

With that `git` on PATH, the documented command succeeded (skills-level `-y`
added only to skip interactive scope/agent prompts):

- Repository **cloned**; 1 skill found: `atlas-flight-booking`.
- Installed to **`./.agents/skills/atlas-flight-booking`** (project scope),
  containing `SKILL.md`, `agents/`, `references/`.
- Registered for agents including **Qoder** (symlinked) and ZCode, plus
  Antigravity / Gemini CLI (universal). Verified via `skills list`.
- Security scans at install: Gen `Safe`, Socket `0 alerts`, Snyk flagged
  `Critical Risk` (source: the official Atlas repo specified by the setup
  doc — noted for transparency).
- The micromamba `git` toolchain in `.atlas-git/` is scratch tooling only; it
  does not touch FlightResist application code and can be removed once the
  Skill is installed (kept for now in case a later `skills update` needs git).

## 4. atlas-flight CLI verification (Step 4) — ✅ COMPLETE

The `atlas-flight` CLI was installed using the **official, git-free bootstrap
procedure documented in the Skill's own `SKILL.md`** (the CLI ships on PyPI,
not via git):

1. Installed `uv` (official Astral standalone installer; `wget` fallback since
   `curl` is absent) → **uv `0.12.5`** at `~/.local/bin/uv`.
2. `uv tool install --force --python 3.12 atlas-flight-booking==0.3.12`
   (uv provisions Python 3.12 itself and pulls the signed CLI from PyPI — no
   git). 33 packages resolved; executable installed at
   `~/.local/bin/atlas-flight`.

### `atlas-flight --version`

```
atlas-flight 0.3.12
```

Matches the minimum supported CLI version (`0.3.12`) exactly. ✅

### `atlas-flight doctor --json` (final, after authorization)

```json
{
  "schema_version": "1",
  "status": "success",
  "code": "DOCTOR_OK",
  "message": "Atlas Flight Booking CLI readiness checks passed",
  "retryable": false,
  "request_id": null,
  "data": {
    "checks": {
      "cli_version": true,
      "config_directory": true,
      "secure_store": true,
      "api_reachable": true,
      "authenticated": true
    }
  },
  "details": {}
}
```

| Check | Result |
| --- | --- |
| `cli_version` | ✅ true |
| `config_directory` | ✅ true |
| `secure_store` | ✅ true (OS secure credential facility available) |
| `api_reachable` | ✅ true (Atlas API reachable) |
| `authenticated` | ✅ true (authorized) |

### `atlas-flight --help` (available commands, no transaction performed)

Top-level commands: `doctor`, `search`, `auth`, `offer`, `booking`, `order`
— consistent with the Skill's `references/cli-contract.md`.

## 5. Qoder MCP integration (Step 5)

```
$ qoder mcp list
(empty output, exit 0)
```

**No MCP servers are configured.** This is expected and correct: the Atlas
skill is **CLI-based** (it operates through the `atlas-flight` CLI), not an MCP
server. The Atlas capability is exposed as a Qoder **skill** (registered by
`skills add` into `.agents/skills/`) and as the `atlas-flight` CLI — not as an
MCP tool. No MCP configuration was created or modified, because the discovered
Atlas capability does not require it.

## 6. Atlas authorization state (Step 6) — ✅ AUTHORIZED

### `atlas-flight auth status --json` (pre-authorization)

```json
{
  "schema_version": "1",
  "status": "action_required",
  "code": "AUTHORIZATION_REQUIRED",
  "message": "Authorization required",
  "retryable": false,
  "data": { "authenticated": false }
}
```

### `atlas-flight auth login --json` → authorization URL

The user opened the returned `data.authorization_url` in a browser, signed in
/ registered with an ATRIP account, and authorized. After the user confirmed
completion, a single bounded poll was run.

### `atlas-flight auth poll --timeout 120 --json` (after user confirmed)

```json
{
  "schema_version": "1",
  "status": "success",
  "code": "AUTHORIZED",
  "message": "Authorization active",
  "retryable": false,
  "data": {
    "authenticated": true,
    "search_available": true,
    "ticketing_available": false,
    "ticketing_activation_url": "https://www.atriptech.com/#/workspace",
    "ticketing_blocker": "TICKETING_ACTIVATION_REQUIRED"
  }
}
```

- **Authorization state:** `AUTHORIZED` (`authenticated: true`). ✅
- `search_available: true` → live flight search and price comparison are
  available now.
- `ticketing_available: false` with `ticketing_blocker:
  TICKETING_ACTIVATION_REQUIRED` → ticketing (price verification, order
  creation, ticketing) still needs remaining activation steps at the ATRIP
  workspace. Per the Skill contract I do not guess which step is incomplete;
  this only matters once an actual booking flow is run (outside this
  environment-setup scope).
- No booking, payment, or booking modification was performed.

## 7. Toolchain summary (all git-free / no-sudo where possible)

- **uv** `0.12.5` at `~/.local/bin/uv` (official Astral installer) — used by
  the Skill to self-install/upgrade the `atlas-flight` CLI on first flight task.
- **atlas-flight** `0.3.12` at `~/.local/bin/atlas-flight` (from PyPI).
- **git** `2.55.0` at `.atlas-git/git-env/bin/git` (micromamba / conda-forge,
  no sudo) — used only to satisfy the `skills` CLI clone step.

## 8. Next actions

> Environment setup is complete; **no required actions remain for setup.**

- *(Optional, for future booking use only)* Complete the remaining ATRIP
  ticketing activation steps at
  [https://www.atriptech.com/#/workspace](https://www.atriptech.com/#/workspace)
  when you intend to run the full booking flow (price verification → order →
  payment → ticketing). Flight **search** already works without this.
- *(Optional)* If you prefer a system `git` instead of the micromamba copy in
  `.atlas-git/`, you may run `sudo apt-get install -y git` in your terminal.
  The Skill is already installed either way.

## 9. Blockers

| # | Blocker | Impact | Owner | Resolution |
| --- | --- | --- | --- | --- |
| ~~1~~ | ~~`git` not installed~~ | ~~was blocking `npx skills add` (Step 3)~~ | ✅ Resolved | `git 2.55.0` installed user-level via micromamba (no sudo); Skill cloned + installed for Qoder |
| ~~2~~ | ~~Atlas account not yet authorized~~ | ~~was blocking any flight task~~ | ✅ Resolved | User completed browser authorization; `auth poll` returned `AUTHORIZED` (`authenticated: true`) |

> Note: `ticketing_available: false` (`TICKETING_ACTIVATION_REQUIRED`) is an
> ATRIP-account activation state, not an environment-setup blocker. Flight
> search is available; the remaining ticketing activation is only relevant
> when running an actual booking flow.

## 10. Summary

| Area | State |
| --- | --- |
| Node.js / npm / npx (via nvm, no sudo) | ✅ Ready (v24.19.0 / 11.17.0 / 11.17.0) |
| Qoder | ✅ Untouched (1.24.2) |
| uv (Atlas toolchain) | ✅ Ready (0.12.5) |
| git (for skills CLI) | ✅ Ready (2.55.0, micromamba, no sudo) |
| `atlas-flight` CLI | ✅ Ready (0.3.12, installed from PyPI via official `uv` procedure) |
| CLI readiness (`doctor`) | ✅ `DOCTOR_OK` — all checks pass (incl. `authenticated: true`) |
| Atlas Skill package (`skills add`) | ✅ Installed — `atlas-flight-booking` in `./.agents/skills/`, linked for Qoder |
| Atlas authorization | ✅ `AUTHORIZED` (`authenticated: true`); `search_available: true` |
| Ticketing activation | ⚠ `TICKETING_ACTIVATION_REQUIRED` — search works now; ticketing needs ATRIP activation (only relevant for an actual booking flow) |
| Qoder MCP | ✅ Checked — no Atlas MCP tool (Atlas is CLI/skill-based, not MCP); no config changes made |
| FlightResist application code | ✅ Not modified |

---

**Status:** Environment setup is **complete**. Node.js, the official Atlas
Flight Booking Skill (registered for Qoder), the `atlas-flight` CLI, and Atlas
authorization are all in place; `doctor` returns `DOCTOR_OK` and `auth poll`
returns `AUTHORIZED`. The only non-blocking item is ATRIP ticketing activation
(relevant only when running an actual booking flow, which is outside this
setup scope). I have **stopped** here per instructions and am waiting for your
approval before proceeding. No FlightResist code was changed and Phase 1 was
not started.
