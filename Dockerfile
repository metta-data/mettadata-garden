# ── Build stage ──────────────────────────────────────────────
FROM node:22-slim AS build

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

# Install dependencies first (better layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/garden/package.json apps/garden/
COPY packages/content-model/package.json packages/content-model/
COPY packages/remark-garden/package.json packages/remark-garden/
COPY packages/ui/package.json packages/ui/

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY packages/ packages/
COPY apps/garden/ apps/garden/

RUN pnpm build

# Create a standalone production bundle (no symlinks)
RUN pnpm --filter @mettadata/garden deploy --prod --legacy /app/deployed

# Copy built dist into the deployed bundle
RUN cp -r /app/apps/garden/dist /app/deployed/dist

# ── Production stage ─────────────────────────────────────────
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    rsync \
    git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the self-contained deployed bundle (deps + built output)
COPY --from=build /app/deployed/ ./

# Copy seed content (used by entrypoint on first boot)
COPY --from=build /app/apps/garden/src/content/ ./seed-content/

# Copy the data directory as seed data
COPY apps/data/ ./seed-data/

# Copy entrypoint
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV HOST=0.0.0.0
ENV PORT=8080
ENV CONTENT_DIR=/data/content
ENV DATA_DIR=/data

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/server/entry.mjs"]
