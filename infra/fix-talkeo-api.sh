#!/usr/bin/env bash
# Répare talkeo-api (JWT manquant, permissions data/, test démarrage)
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

touch "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

set_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

if ! grep -q '^TALKEO_JWT_SECRET=' "${ENV_FILE}" || [ "$(grep '^TALKEO_JWT_SECRET=' "${ENV_FILE}" | cut -d= -f2- | wc -c)" -lt 33 ]; then
  echo "==> Ajout TALKEO_JWT_SECRET"
  set_env "TALKEO_JWT_SECRET" "$(openssl rand -hex 32)"
fi

if ! grep -q '^TALKEO_ADMIN_KEY=' "${ENV_FILE}"; then
  echo "==> Ajout TALKEO_ADMIN_KEY"
  set_env "TALKEO_ADMIN_KEY" "$(openssl rand -hex 24)"
fi

if ! grep -q '^TALKEO_DATABASE_PATH=' "${ENV_FILE}"; then
  set_env "TALKEO_DATABASE_PATH" "${DATA_DIR}/talkeo.db"
fi

if ! grep -q '^TALKEO_API_PORT=' "${ENV_FILE}"; then
  set_env "TALKEO_API_PORT" "8787"
fi

if ! grep -q '^VITE_API_URL=' "${ENV_FILE}"; then
  DOMAIN=$(grep -rh 'server_name' /etc/nginx/sites-enabled/ 2>/dev/null | awk '{print $2}' | tr -d ';' | grep -v '^_' | head -1 || echo "talkeo.fr")
  set_env "VITE_API_URL" "https://${DOMAIN}"
  echo "==> VITE_API_URL=https://${DOMAIN}"
fi

mkdir -p "${DATA_DIR}"
chown -R www-data:www-data "${DATA_DIR}"
chmod 750 "${DATA_DIR}"

if [ -d "${SRC_DIR}/server" ]; then
  chown -R www-data:www-data "${SRC_DIR}/server/node_modules" 2>/dev/null || true
  chown www-data:www-data "${SRC_DIR}/server" 2>/dev/null || true
fi

echo "==> Test démarrage (www-data, 2 s)"
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a
if sudo -u www-data bash -c "cd '${SRC_DIR}/server' && timeout 2 node src/index.js" 2>/tmp/talkeo-test.log; then
  echo "OK — Node démarre"
else
  if grep -q "Talkeo API écoute" /tmp/talkeo-test.log 2>/dev/null; then
    echo "OK — API prête"
  else
    echo "WARN — voir /tmp/talkeo-test.log"
    tail -5 /tmp/talkeo-test.log 2>/dev/null || true
  fi
fi

echo "==> Redémarrage systemd"
systemctl daemon-reload
systemctl restart talkeo-api.service
sleep 2
systemctl status talkeo-api.service --no-pager || true

echo ""
echo "Si encore en échec : journalctl -u talkeo-api -n 40 --no-pager"
