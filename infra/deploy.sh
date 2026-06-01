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
  log "Variables .env"
  cp "${ENV_FILE}" .env
else
  log "Création ${ENV_FILE} par défaut (API VPS)"
  JWT_GEN=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
  ADMIN_GEN=$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | xxd -p -c 48)
  mkdir -p "${APP_DIR}/data"
  cat > "${ENV_FILE}" <<EOF
VITE_API_URL=https://DOMAIN_PLACEHOLDER
TALKEO_JWT_SECRET=${JWT_GEN}
TALKEO_ADMIN_KEY=${ADMIN_GEN}
TALKEO_DATABASE_PATH=${APP_DIR}/data/talkeo.db
TALKEO_API_PORT=8787
EOF
  cp "${ENV_FILE}" .env
fi

# Renseigner VITE_API_URL si absent
if ! grep -q '^VITE_API_URL=' .env 2>/dev/null; then
  DOMAIN_GUESS=$(grep -oP 'server_name \K[^;]+' /etc/nginx/sites-available/crypt 2>/dev/null | head -1 || echo "")
  if [ -n "${DOMAIN_GUESS}" ]; then
    echo "VITE_API_URL=https://${DOMAIN_GUESS}" >> .env
  fi
fi

log "Installation des dépendances (frontend)"
npm ci --prefer-offline --no-audit

log "API Talkeo (serveur)"
mkdir -p "${APP_DIR}/data"
cd "${SRC_DIR}/server"
npm ci --prefer-offline --no-audit
cd "${SRC_DIR}"

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

if command -v systemctl >/dev/null 2>&1; then
  if [ -f "${SRC_DIR}/infra/talkeo-api.service" ]; then
    cp "${SRC_DIR}/infra/talkeo-api.service" /etc/systemd/system/talkeo-api.service
    systemctl daemon-reload
    systemctl enable talkeo-api.service 2>/dev/null || true
    systemctl restart talkeo-api.service
    log "API talkeo-api redémarrée"
  fi
  if systemctl is-active nginx >/dev/null 2>&1; then
    nginx -t
    systemctl reload nginx
    log "nginx rechargé"
  fi
fi

VER=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "?")
log "Talkeo v${VER} déployé — $(date -u +%Y-%m-%dT%H:%MZ)"
