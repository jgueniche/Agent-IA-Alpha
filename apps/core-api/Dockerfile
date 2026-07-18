# Dockerfile core-api — build depuis la RACINE du repo (contexte monorepo pnpm).
# Voir docker-compose.yml : build.context = "." et build.dockerfile = apps/core-api/Dockerfile

# --- Etape build -------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /repo
# openssl est requis par Prisma (moteurs).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Installe les dependances de tout le workspace puis build core-api et tous
# ses packages internes (domain, messaging, providers, telephony) en ordre topologique.
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter "@alpha/core-api..." build

# --- Etape runtime -----------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV NODE_ENV=production

# On reprend l'arbre complet (node_modules workspace + dist + client Prisma genere).
COPY --from=builder /repo /repo

EXPOSE 4000
# Au demarrage : applique les migrations, seed idempotent, puis lance l'API.
CMD ["sh", "-c", "pnpm --filter @alpha/core-api prisma:migrate && pnpm --filter @alpha/core-api db:seed && node apps/core-api/dist/main.js"]
