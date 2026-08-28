# DEPLOY.md

**Putting FlightResist AI on Alibaba Cloud ECS behind HTTPS.**

The hackathon requires Alibaba Cloud infrastructure, and judges need a URL they
can click. This runbook takes a fresh ECS instance to a working HTTPS deployment
in about 15 minutes, most of which is the build.

> **Status:** the scripts here are syntax-checked and the production bundle they
> start is verified locally (see [Verified locally](#verified-locally)). The ECS
> provisioning itself has **not** been executed — it needs an Alibaba Cloud
> account, so the first real run will be yours.

---

## What gets deployed

```
Internet ──443──▶ Caddy (TLS, auto-cert)  ──▶ 127.0.0.1:3000  Next.js standalone
                                                                └── SQLite (db/custom.db)
```

The Node process binds to loopback only, so Caddy is the sole public entry point.
`ATLAS_MODE=demo` is baked into the service unit: the deployed instance is
deterministic and **cannot book a real ticket**, which is what you want on a URL
strangers will click.

---

## Prerequisites

- An Alibaba Cloud account. The free trial or the USD 4,000 prize credits both
  cover this comfortably — a 2 vCPU / 4 GiB instance is a few dollars a month.
- The repo pushed to GitHub (the bootstrap script clones it).
- Optional: a domain name. If you do not have one, see [step 3](#3-point-a-hostname-at-the-instance).

---

## 1. Create the ECS instance

Console → **Elastic Compute Service** → *Instances* → **Create Instance**
(<https://ecs.console.alibabacloud.com/>).

| Setting | Value | Why |
|---|---|---|
| Billing | Pay-as-you-go | Cheapest for a demo you can release afterwards |
| Region | **Singapore (ap-southeast-1)** | Matches the hackathon and the `dashscope-intl` endpoint you would call for Qwen |
| Instance type | 2 vCPU / 4 GiB, e.g. `ecs.e-c1m2.large` | `next build` on 2 GiB can be OOM-killed; see [troubleshooting](#troubleshooting) if you must use a smaller one |
| Image | **Ubuntu 24.04 LTS 64-bit** | What the bootstrap script targets |
| System disk | 40 GiB ESSD Entry | Plenty |
| Public IP | **Assign** (or bind an EIP) | Judges need to reach it |
| Bandwidth | Pay-by-traffic, 5 Mbps peak | A demo page is tiny |
| Logon credentials | Your SSH key pair | Avoid passwords |

Note the **public IP** once it boots.

## 2. Open the firewall

Console → *Instance* → **Security Groups** → the attached group → **Inbound**:

| Protocol | Port | Source | Purpose |
|---|---|---|---|
| TCP | 22 | **your own IP/32** | SSH — do not open this to the world |
| TCP | 80 | 0.0.0.0/0 | Let's Encrypt HTTP-01 challenge, then redirect to HTTPS |
| TCP | 443 | 0.0.0.0/0 | The demo |

Port 3000 stays closed. The app is not listening on a public interface anyway.

## 3. Point a hostname at the instance

Caddy issues a real certificate automatically, but Let's Encrypt will only issue
for a hostname, never a bare IP.

- **If you own a domain:** add an `A` record for e.g. `demo.yourdomain.com`
  pointing at the public IP. Wait for it to resolve.
- **If you do not:** use `sslip.io`, a free public DNS service that resolves any
  dashed IP to that IP. For `203.0.113.7` the hostname is
  `203-0-113-7.sslip.io`. It works with Let's Encrypt and needs no signup.

## 4. Run the bootstrap script

SSH in, become root, and run it. Replace the hostname with yours.

```bash
ssh root@<public-ip>

apt-get update -qq && apt-get install -y -qq git
git clone --depth 1 https://github.com/jamshidnabizada7-boop/FlightResist-AI.git /tmp/fr
cd /tmp/fr
FLIGHTRESIST_DOMAIN=203-0-113-7.sslip.io ./deploy/bootstrap.sh
```

The script is idempotent — re-run it any time to redeploy the latest `main`. It:

1. installs Node 24, bun (the lockfile is `bun.lock`; there is no `package-lock.json`), and Caddy,
2. creates an unprivileged `flightresist` service account,
3. clones the repo to `/opt/flightresist` and builds it,
4. syncs the SQLite schema with an **absolute** `DATABASE_URL`,
5. installs and starts [`deploy/flightresist.service`](./deploy/flightresist.service),
6. installs [`deploy/Caddyfile`](./deploy/Caddyfile) and restarts Caddy,
7. waits until the app answers, then prints the URL.

## 5. Verify from your laptop

Point the real test suites at the public URL. This is the same evidence the
README offers judges, run against production:

```bash
node tests/phase6-safety.mjs     https://203-0-113-7.sslip.io   # → 91/91 passed
node tests/atlas-golden-flow.mjs https://203-0-113-7.sslip.io   # → ALL CHECKS PASSED
node tests/mcp-smoke.mjs         https://203-0-113-7.sslip.io   # → ALL CHECKS PASSED
```

Then open the URL and walk the flow by hand: **D** triggers the disruption,
**A** approves the recommended option, **R** resets.

## 6. Optional — enable the Qwen explanation backend

The app runs fine without this and produces deterministic template
explanations. To use Alibaba Cloud Model Studio, get a key from
<https://bailian.console.alibabacloud.com/> and write it **outside** the repo:

```bash
printf 'LLM_PROVIDER=qwen\nDASHSCOPE_API_KEY=sk-your-key\n' > /etc/flightresist.env
chmod 600 /etc/flightresist.env
systemctl restart flightresist
```

Confirm it took effect — `source` should read `QWEN`, not `TEMPLATE`:

```bash
node -e 'fetch("https://203-0-113-7.sslip.io/api/trip/current").then(r=>r.json()).then(d=>console.log(d.analysis?.explanation?.source, d.analysis?.explanation?.model))'
```

If the key is wrong the app does not break — it logs the upstream error and
falls back to the deterministic template with identical scores. That is by
design and is worth knowing before you record: **a bad key cannot ruin the demo.**

---

## Before you record the video

One thing to watch: **session state persists across restarts.** If the last
visitor left the trip in `RECOVERED`, that is what the next person sees. Before
recording, or before sharing the link with judges, reset it:

```bash
node -e 'fetch("https://203-0-113-7.sslip.io/api/session/reset",{method:"POST"}).then(r=>console.log("reset",r.status))'
```

Or just press **R** in the UI.

---

## Operations

| Task | Command |
|---|---|
| Follow logs | `journalctl -u flightresist -f` |
| Restart app | `systemctl restart flightresist` |
| Caddy logs | `journalctl -u caddy -f` and `/var/log/caddy/flightresist.log` |
| Redeploy latest `main` | re-run `./deploy/bootstrap.sh` |
| Check what is listening | `ss -ltnp` |

---

## Verified locally

The artifact this deploys — the Next.js standalone bundle running with
`NODE_ENV=production` — was verified on the development machine:

| Check | Result |
|---|---|
| Boot | `Ready in 61ms` |
| `tests/phase6-safety.mjs` | **91/91 passed, 0 failed** |
| `tests/atlas-golden-flow.mjs` | ALL CHECKS PASSED |
| `tests/mcp-smoke.mjs` | ALL CHECKS PASSED |
| Server log volume | 39 lines for the entire suite, 0 database errors |
| Engine determinism | risk 87, 42 candidates, 3 options, `opt_b` at R=82, `pnr: null` |

Getting there required fixing three production-only defects that dev had
concealed — a three-way SQLite path divergence, an unmigrated `AgentEvent.agent`
column that silently prevented the audit ledger from ever persisting, and
unconditional query logging. See commit `20b4cde`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build killed, `Killed` or exit 137 | Out of memory on a 2 GiB instance | Add swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`, then re-run |
| Certificate never issues | Port 80 blocked, or DNS not resolving yet | Confirm the security group has 80 open and `dig +short <hostname>` returns your IP |
| `502 Bad Gateway` | App not running | `journalctl -u flightresist -n 50` |
| App restarts in a loop | Usually the database path | Confirm `DATABASE_URL` in the unit is absolute and `/opt/flightresist/db` is writable by `flightresist` |
| Agent stream arrives all at once | A proxy is buffering SSE | The shipped Caddyfile already handles `/api/recovery/stream` with `flush_interval -1`; check you did not replace it |
| `bun install` fails | Lockfile drift | `bun install` without `--frozen-lockfile`, then commit the updated `bun.lock` |

---

## Cost and teardown

A `ecs.e-c1m2.large` pay-as-you-go instance with 5 Mbps pay-by-traffic bandwidth
runs a few dollars a month. **Release the instance** in the console when the
judging period ends, or it keeps billing.
