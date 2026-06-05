#!/usr/bin/env bash
# Répare erreur 500 nginx + boucle talkeo-api sur VPS Hostinger
# Usage: sudo bash /opt/crypt/src/infra/fix-500.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/crypt}"
SRC_DIR="${SRC_DIR:-${APP_DIR}/src}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
WEB_DIST="${APP_DIR}/web-dist"
DATA_DIR="${APP_DIR}/data"

if [ "$(id -u)" -ne 0 ]; then
  echo "Lancez avec sudo." >&2
  exit 1
fi

echo "=== Talkeo fix-500 ==="

# ── 1. Code source présent ? ──
if [ ! -f "${SRC_DIR}/server/src/index.js" ]; then
  echo "ERREUR: ${SRC_DIR}/server/src/index.js introuvable"
  echo "Clonez le dépôt : git clone https://github.com/YTFeez/Crypt.git ${SRC_DIR}"
  exit 1
fi

# ── 2. Node.js ──
NODE_BIN=$(command -v node || true)
if [ -z "${NODE_BIN}" ]; then
  echo "Installation Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  NODE_BIN=$(command -v node)
fi
echo "Node: ${NODE_BIN} ($(node -v))"

# ── 3. Fichier .env (cause #1 boucle talkeo-api) ──
mkdir -p "${DATA_DIR}"
touch "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

add_env() {
  local k="$1" v="$2"
  if ! grep -q "^${k}=" "${ENV_FILE}" 2>/dev/null; then
    echo "${k}=${v}" >> "${ENV_FILE}"
    echo "  + ${k}"
  fi
}

JWT_GEN=$(openssl rand -hex 32)
ADMIN_GEN=$(openssl rand -hex 24)
add_env "TALKEO_JWT_SECRET" "${JWT_GEN}"
add_env "TALKEO_ADMIN_KEY" "${ADMIN_GEN}"
add_env "TALKEO_DATABASE_PATH" "${DATA_DIR}/talkeo.db"
add_env "TALKEO_API_PORT" "8787"

if ! grep -q '^VITE_API_URL=' "${ENV_FILE}"; then
  DOMAIN=$(grep -rh 'server_name' /etc/nginx/sites-enabled/ 2>/dev/null \
    | awk '{print $2}' | tr -d ';' | grep -v '^_$' | grep '\.' | head -1 || echo "")
  [ -n "${DOMAIN}" ] && add_env "VITE_API_URL" "https://${DOMAIN}"
fi

chown www-data:www-data "${DATA_DIR}" 2>/dev/null || true
chmod 750 "${DATA_DIR}"

# ── 4. Dépendances API ──
echo "==> npm ci (server)"
cd "${SRC_DIR}/server"
sudo -u www-data env HOME=/var/www npm ci --prefer-offline --no-audit 2>/dev/null \
  || npm ci --prefer-offline --no-audit
chown -R www-data:www-data "${SRC_DIR}/server" 2>/dev/null || true

# ── 5. Service systemd (chemin node + .env optionnel) ──
cat > /etc/systemd/system/talkeo-api.service <<EOF
[Unit]
Description=Talkeo API (stockage VPS SQLite)
After=network.target
ConditionPathExists=${SRC_DIR}/server/src/index.js

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${SRC_DIR}/server
EnvironmentFile=-${ENV_FILE}
Environment=NODE_ENV=production
ExecStart=${NODE_BIN} src/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=talkeo-api

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable talkeo-api.service 2>/dev/null || true
systemctl restart talkeo-api.service
sleep 2

if systemctl is-active --quiet talkeo-api; then
  echo "OK — talkeo-api actif"
else
  echo "ERREUR talkeo-api :"
  journalctl -u talkeo-api -n 20 --no-pager
fi

# ── 6. Site statique (cause #1 erreur 500 nginx) ──
if [ ! -f "${WEB_DIST}/index.html" ]; then
  echo "==> web-dist absent — rebuild frontend"
  if [ -f "${SRC_DIR}/infra/deploy.sh" ]; then
    bash "${SRC_DIR}/infra/deploy.sh"
  else
    echo "WARN: lancez manuellement : bash ${SRC_DIR}/infra/deploy.sh"
  fi
else
  echo "OK — ${WEB_DIST}/index.html présent"
  chmod -R a+rX "${WEB_DIST}" 2>/dev/null || true
fi

# ── 7. nginx ──
nginx -t
systemctl reload nginx

echo ""
echo "=== Tests ==="
curl -sf "http://127.0.0.1:8787/api/health" && echo "" || echo "API : pas de réponse"
curl -sfI "http://127.0.0.1" | head -3 || true
echo ""
echo "Si OK : ouvrez https://votre-domaine dans le navigateur"
