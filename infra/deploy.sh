#!/usr/bin/env bash
# Talkeo — déploiement Hostinger VPS (nginx + build Vite)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/crypt}"
SRC_DIR="${SRC_DIR:-${APP_DIR}/src}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
WEB_DIST="${APP_DIR}/web-dist}"
REPO_URL="${REPO_URL:-https://github.com/YTFeez/Crypt.git}"

log() { echo "==> $*"; }

if ! command -v node >/dev/null 2>&1; then
  echo "ERREUR: Node.js requis. Lancez infra/setup-vps.sh" >&2
  exit 1
fi

log "Node $(node -v) · npm $(npm -v)"

if [ ! -d "${SRC_DIR}/.git" ]; then
  log "Clone du dépôt"
  mkdir -p "$(dirname "${SRC_DIR}")"
  git clone "${REPO_URL}" "${SRC_DIR}"
fi

cd "${SRC_DIR}"
git fetch origin main
git checkout main
git pull --ff-only origin main

if [ -f "${ENV_FILE}" ]; then
  log "Variables .env (Supabase optionnel)"
  cp "${ENV_FILE}" .env
else
  log "Aucun ${ENV_FILE} — build en mode local (sans Supabase cloud)"
  printf '%s\n' "# Mode local — ajoutez VITE_SUPABASE_* pour synchronisation cloud" > .env
fi

log "Installation des dépendances"
npm ci --prefer-offline --no-audit

log "Build production"
npm run build

if [ ! -f dist/index.html ]; then
  echo "ERREUR: build échoué (dist/index.html manquant)" >&2
  exit 1
fi

log "Publication vers ${WEB_DIST}"
mkdir -p "${WEB_DIST}"
rsync -a --delete dist/ "${WEB_DIST}/"

if id www-data >/dev/null 2>&1; then
  chown -R www-data:www-data "${WEB_DIST}" 2>/dev/null || true
fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-active nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx
  log "nginx rechargé"
fi

VER=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "?")
log "Talkeo v${VER} déployé — $(date -u +%Y-%m-%dT%H:%MZ)"
