# Dockerfile back-office — build depuis la RACINE du repo (contexte monorepo pnpm).
FROM node:22-slim AS builder
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile=false
# NEXT_PUBLIC_* est inline au build : fourni via build args en production.
ARG NEXT_PUBLIC_CORE_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_CORE_API_URL=$NEXT_PUBLIC_CORE_API_URL
RUN pnpm --filter @alpha/back-office build

FROM node:22-slim AS runner
WORKDIR /repo
RUN corepack enable
ENV NODE_ENV=production
COPY --from=builder /repo /repo
EXPOSE 3000
CMD ["pnpm", "--filter", "@alpha/back-office", "start"]
