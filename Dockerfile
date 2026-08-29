# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:24-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install bun
RUN npm install -g bun

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY prisma ./prisma/
# Note: no --frozen-lockfile here; bun.lock was generated on Windows and
# must be allowed to resolve platform-specific (Linux) binaries in Docker.
RUN bun install

# Generate Prisma client
RUN npx prisma generate

# Copy source and build standalone
COPY . .
ENV DEPLOY_TARGET=standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:24-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install uv and Atlas CLI.
# UV_TOOL_BIN_DIR forces uv to place the atlas-flight shim in /usr/local/bin
# (already on the system PATH). The uv binary itself is invoked via its full
# path since PATH may not include /root/.local/bin at RUN time.
# `atlas-flight --version` fails the build immediately if the shim is broken.
ENV UV_TOOL_BIN_DIR="/usr/local/bin"
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    /root/.local/bin/uv tool install --force --python python3 atlas-flight-booking==0.3.12 && \
    atlas-flight --version

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=10000

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Install prisma CLI directly so all transitive dependencies (effect, @prisma/config,
# etc.) are present. Copying individual prisma packages from the builder misses them.
RUN npm install prisma@6.11.1

EXPOSE 10000

# Try migrations, then start the server regardless of migration outcome.
# A failed migration (e.g. DIRECT_DATABASE_URL unset or DB timeout) logs a
# visible WARNING instead of blocking startup — the app still boots so at
# least Demo mode remains usable.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 || echo 'WARNING: Migration failed, starting server anyway'; node server.js"]
