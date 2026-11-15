FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=18080
ENV HOSTNAME=0.0.0.0
ENV CADDYWEB_DATA_DIR=/app/data

LABEL org.opencontainers.image.title="CaddyWeb" \
      org.opencontainers.image.description="Flat-design control panel for the Caddy Admin API" \
      org.opencontainers.image.version="0.7.1" \
      org.opencontainers.image.licenses="MIT"

RUN addgroup -S nodejs -g 1001 \
  && adduser -S nextjs -u 1001 \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 18080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:18080/login || exit 1

CMD ["node", "server.js"]
