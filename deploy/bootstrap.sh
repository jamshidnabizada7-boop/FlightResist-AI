#!/usr/bin/env bash
#
# FlightResist AI — one-shot provisioning for a fresh Alibaba Cloud ECS instance.
#
#   Target:  Ubuntu 24.04 LTS, 2 vCPU / 4 GB, public IP assigned
#   Run as:  root, from anywhere
#   Usage:   FLIGHTRESIST_DOMAIN=your.host.name ./bootstrap.sh
#
# Idempotent: safe to re-run. Installs Node 24 and Caddy, clones or updates the
# repo into /opt/flightresist, builds it, and starts it behind TLS.
#
# It does NOT write any secret. To enable the Qwen explanation backend, create
# /etc/flightresist.env afterwards (see the end of this script's output).

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/jamshidnabizada7-boop/FlightResist-AI.git}"
APP_DIR="/opt/flightresist"
APP_USER="flightresist"

if [[ $EUID -ne 0 ]]; then
	echo "error: run as root (sudo -i)" >&2
	exit 1
fi

if [[ -z "${FLIGHTRESIST_DOMAIN:-}" ]]; then
	cat >&2 <<-'EOF'
		error: FLIGHTRESIST_DOMAIN is not set.

		If you own a domain, point an A record at this instance's public IP and use it.
		If you do not, sslip.io gives you a free hostname that resolves to any IP —
		replace the dashes with your own address:

		    FLIGHTRESIST_DOMAIN=203-0-113-7.sslip.io ./bootstrap.sh
	EOF
	exit 1
fi

echo "==> Installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || [[ "$(node -v)" != v24.* ]]; then
	echo "==> Installing Node.js 24 (NodeSource)"
	curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
	apt-get install -y -qq nodejs
fi
echo "    node $(node -v), npm $(npm -v)"

if ! command -v bun >/dev/null; then
	# The project's lockfile is bun.lock, so bun is what reproduces the exact
	# dependency tree this build was tested against. There is no package-lock.json.
	echo "==> Installing bun"
	npm install -g --silent bun
fi
echo "    bun $(bun --version)"

if ! command -v caddy >/dev/null; then
	echo "==> Installing Caddy"
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
		gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		>/etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq
	apt-get install -y -qq caddy
fi
echo "    $(caddy version)"

echo "==> Creating service account"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

echo "==> Fetching source into $APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
	git -C "$APP_DIR" fetch --quiet --depth 1 origin main
	git -C "$APP_DIR" reset --quiet --hard FETCH_HEAD
else
	git clone --quiet --depth 1 --branch main "$REPO_URL" "$APP_DIR"
fi

echo "==> Writing .env"
# The app reads DATABASE_URL from the systemd unit in production; this file
# exists so that build-time tooling (prisma generate) has a value too.
cat >"$APP_DIR/.env" <<-EOF
	DATABASE_URL="file:$APP_DIR/db/custom.db"
	ATLAS_MODE=demo
EOF

echo "==> Installing dependencies and building (this takes a few minutes)"
cd "$APP_DIR"
bun install --frozen-lockfile
npx prisma generate
DATABASE_URL="file:$APP_DIR/db/custom.db" npx prisma db push --accept-data-loss --skip-generate
npm run build

echo "==> Setting ownership"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Installing systemd unit"
install -m 644 "$APP_DIR/deploy/flightresist.service" /etc/systemd/system/flightresist.service
systemctl daemon-reload
systemctl enable --now flightresist

echo "==> Configuring Caddy for $FLIGHTRESIST_DOMAIN"
install -d -m 755 /var/log/caddy
chown caddy:caddy /var/log/caddy
install -m 644 "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
install -d -m 755 /etc/systemd/system/caddy.service.d
cat >/etc/systemd/system/caddy.service.d/domain.conf <<-EOF
	[Service]
	Environment=FLIGHTRESIST_DOMAIN=$FLIGHTRESIST_DOMAIN
EOF
systemctl daemon-reload
FLIGHTRESIST_DOMAIN="$FLIGHTRESIST_DOMAIN" caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl restart caddy

echo "==> Waiting for the app to answer"
for i in $(seq 1 30); do
	if curl -fsS -o /dev/null "http://127.0.0.1:3000/api/trip/current"; then
		echo "    app is up"
		break
	fi
	[[ $i -eq 30 ]] && {
		echo "    app did not start; run: journalctl -u flightresist -n 50" >&2
		exit 1
	}
	sleep 2
done

cat <<-EOF

	========================================================================
	  Deployed.  https://$FLIGHTRESIST_DOMAIN

	  Verify from your laptop:
	    node tests/phase6-safety.mjs     https://$FLIGHTRESIST_DOMAIN
	    node tests/atlas-golden-flow.mjs https://$FLIGHTRESIST_DOMAIN
	    node tests/mcp-smoke.mjs         https://$FLIGHTRESIST_DOMAIN

	  Logs:      journalctl -u flightresist -f
	  Restart:   systemctl restart flightresist
	  Redeploy:  ./bootstrap.sh   (re-runnable)

	  Optional — enable the Qwen explanation backend:
	    printf 'LLM_PROVIDER=qwen\\nDASHSCOPE_API_KEY=REPLACE_ME\\n' > /etc/flightresist.env
	    chmod 600 /etc/flightresist.env
	    systemctl restart flightresist
	========================================================================
EOF
