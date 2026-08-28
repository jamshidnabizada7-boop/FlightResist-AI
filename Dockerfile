# ---- Stage 1: builder ----
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN npm install -g bun && bun install --frozen-lockfile

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY . .
ENV DEPLOY_TARGET=standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ---- Stage 2: runner ----
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
