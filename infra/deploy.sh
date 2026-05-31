#!/usr/bin/env bash
# Crypt — déploiement sur VPS (site statique + Supabase)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/crypt}"
SRC_DIR="${SRC_DIR:-${APP_DIR}/src}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
WEB_DIST="${APP_DIR}/web-dist"

echo "==> Mise à jour du code"
if [ ! -d "${SRC_DIR}/.git" ]; then
  echo "ERREUR: clone git manquant dans ${SRC_DIR}" >&2
  echo "  git clone https://github.com/YTFeez/Crypt.git ${SRC_DIR}" >&2
  exit 1
fi
cd "${SRC_DIR}"
git fetch origin
git checkout main
git pull --ff-only origin main

echo "==> Variables d'environnement (build Vite)"
if [ ! -f "${ENV_FILE}" ]; then
  echo "ERREUR: créez ${ENV_FILE} avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY" >&2
  exit 1
fi
cp "${ENV_FILE}" .env

echo "==> Install + build"
npm ci
npm run build

echo "==> Publication vers ${WEB_DIST}"
mkdir -p "${WEB_DIST}"
rsync -a --delete dist/ "${WEB_DIST}/"

echo "==> Reload nginx"
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx
fi

echo "Crypt v$(node -p "require('./package.json').version" 2>/dev/null || echo '?') déployé avec succès."
