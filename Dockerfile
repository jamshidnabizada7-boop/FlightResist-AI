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

# Install uv and Atlas CLI
ENV PATH="/root/.local/bin:$PATH"
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    uv tool install --force --python python3 atlas-flight-booking==0.3.12

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
# Copy prisma CLI binary for runtime migrations (avoids npx downloading a mismatched version)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

EXPOSE 10000

# Run migrations then start server; use node directly to avoid npx issues
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma || true; node server.js"]
