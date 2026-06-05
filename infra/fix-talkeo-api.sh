#!/usr/bin/env bash
# Répare talkeo-api : JWT manquant, node introuvable, permissions data/
# Usage: sudo bash /opt/crypt/src/infra/fix-talkeo-api.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/crypt}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
SRC_DIR="${SRC_DIR:-${APP_DIR}/src}"
DATA_DIR="${APP_DIR}/data"

if [ "$(id -u)" -ne 0 ]; then
  echo "Lancez avec sudo." >&2
  exit 1
fi

echo "==> Vérification de Node.js"
NODE_BIN=$(which node 2>/dev/null || echo "")
if [ -z "${NODE_BIN}" ]; then
  echo "ERREUR: node introuvable. Installez Node.js 20." >&2
  exit 1
fi
echo "node : ${NODE_BIN} ($(node -v))"

echo "==> Vérification et complétion du .env"
touch "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

set_if_missing() {
  local key="$1" val="$2"
  if ! grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    echo "${key}=${val}" >> "${ENV_FILE}"
    echo "   + ${key}"
  fi
}

JWT_GEN=$(openssl rand -hex 32)
ADMIN_GEN=$(openssl rand -hex 24)

set_if_missing "TALKEO_JWT_SECRET" "${JWT_GEN}"
set_if_missing "TALKEO_ADMIN_KEY" "${ADMIN_GEN}"
set_if_missing "TALKEO_DATABASE_PATH" "${DATA_DIR}/talkeo.db"
set_if_missing "TALKEO_API_PORT" "8787"

if ! grep -q '^VITE_API_URL=' "${ENV_FILE}"; then
  DOMAIN=$(grep -rh 'server_name' /etc/nginx/sites-enabled/ 2>/dev/null \
    | awk '{print $2}' | tr -d ';' | grep -v '^_$' | grep '\.' | head -1 || echo "")
  if [ -n "${DOMAIN}" ]; then
    echo "VITE_API_URL=https://${DOMAIN}" >> "${ENV_FILE}"
    echo "   + VITE_API_URL=https://${DOMAIN}"
  else
    echo "WARN: VITE_API_URL absent — ajoutez-le manuellement dans ${ENV_FILE}"
  fi
fi

echo "==> Permissions dossier data/"
mkdir -p "${DATA_DIR}"
chown -R www-data:www-data "${DATA_DIR}"
chmod 750 "${DATA_DIR}"

echo "==> Permissions dossier server/"
if [ -d "${SRC_DIR}/server" ]; then
  chown -R www-data:www-data "${SRC_DIR}/server"
fi

echo "==> Mise à jour du fichier service systemd"
cat > /etc/systemd/system/talkeo-api.service <<EOF
[Unit]
Description=Talkeo API (stockage VPS SQLite)
After=network.target

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

echo "==> Test rapide (root, 3s)"
cd "${SRC_DIR}/server"
timeout 3 env $(grep -v '^#' "${ENV_FILE}" | grep -v '^$' | xargs) \
  "${NODE_BIN}" src/index.js 2>/tmp/talkeo-test.log || true

if grep -q "écoute" /tmp/talkeo-test.log 2>/dev/null; then
  echo "OK — API démarre correctement"
elif grep -q "ERREUR" /tmp/talkeo-test.log 2>/dev/null; then
  echo "ERREUR détectée :"
  cat /tmp/talkeo-test.log
else
  echo "OK (timeout attendu)"
fi

echo "==> Redémarrage talkeo-api"
systemctl daemon-reload
systemctl enable talkeo-api.service 2>/dev/null || true
systemctl restart talkeo-api.service
sleep 3
systemctl status talkeo-api.service --no-pager -l || true

echo ""
echo "Test : curl -s http://127.0.0.1:8787/api/health"
curl -s http://127.0.0.1:8787/api/health || echo "(pas de réponse)"
