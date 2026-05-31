#!/usr/bin/env bash
# Prévisualisation QA en une commande : génère un .env de démo (secrets aléatoires,
# données de démonstration), puis lance toute la stack via Docker Compose.
#
#   bash scripts/demo.sh
#
# Puis ouvrir http://localhost:3000 et se connecter avec les identifiants affichés.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker est requis. Installez Docker Desktop puis relancez." >&2
  exit 1
fi

ADMIN_EMAIL="admin@alpha-imagerie.local"
ADMIN_PASSWORD="Demo!Admin2026"

if [ ! -f .env ]; then
  echo "→ Création d'un .env de démonstration…"
  cp .env.example .env
  # Secrets aléatoires
  ENC=$(openssl rand -base64 32)
  SVC=$(openssl rand -hex 32)
  JA=$(openssl rand -hex 32)
  JR=$(openssl rand -hex 32)
  # Remplacements (compatibles BSD/GNU sed)
  sed -i.bak \
    -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${ENC}|" \
    -e "s|^SERVICE_API_KEY=.*|SERVICE_API_KEY=${SVC}|" \
    -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${JA}|" \
    -e "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JR}|" \
    -e "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=${ADMIN_PASSWORD}|" \
    -e "s|^MFA_REQUIRED=.*|MFA_REQUIRED=false|" \
    .env
  rm -f .env.bak
  # Active les données de démo
  if grep -q '^SEED_DEMO=' .env; then
    sed -i.bak "s|^SEED_DEMO=.*|SEED_DEMO=true|" .env && rm -f .env.bak
  else
    echo "SEED_DEMO=true" >> .env
  fi
fi

echo "→ Démarrage de la stack (build au premier lancement, patientez)…"
docker compose up --build -d

echo
echo "=========================================================="
echo " Prévisualisation prête :"
echo "   Back-office : http://localhost:3000"
echo "   API santé   : http://localhost:4000/api/health"
echo "   Connexion   : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}"
echo
echo " Pages à tester : /calls /callbacks /knowledge /followups /supervision"
echo " Logs  : docker compose logs -f core-api"
echo " Arrêt : docker compose down   (purge données : docker compose down -v)"
echo "=========================================================="
