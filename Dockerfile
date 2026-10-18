# syntax=docker/dockerfile:1
# CloudE5 production image: Next.js standalone server + SQLite, running as a non-root user.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Toolchain for compiling the better-sqlite3 native module if no prebuilt binary matches.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build \
 && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CLOUDE5_DATABASE_PATH=/data/db/cloude5.db \
    CLOUDE5_EVIDENCE_DIR=/data/evidence
WORKDIR /app

# Web server (standalone bundle) and static assets.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Production dependencies, operations CLI, and versioned migrations for db:* / admin:create.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/data ./data
COPY --from=build --chown=node:node /app/migrations/sqlite ./migrations/sqlite
COPY --chown=node:node deploy/docker-entrypoint.sh /usr/local/bin/cloude5-entrypoint
RUN chmod 0755 /usr/local/bin/cloude5-entrypoint \
 && mkdir -p /data /app/.next/cache \
 && chown -R node:node /data /app/.next/cache

USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["tini", "--", "cloude5-entrypoint"]
CMD ["serve"]
