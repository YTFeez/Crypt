#!/usr/bin/env bash
# Installation initiale Crypt sur Ubuntu 22+ (Hostinger VPS)
# Usage: DOMAIN=crypt.example.fr bash setup-vps.sh
set -euo pipefail

DOMAIN="${DOMAIN:?Définissez DOMAIN= votre-domaine.fr}"
APP_DIR="${APP_DIR:-/opt/crypt}"
SRC_DIR="${SRC_DIR:-${APP_DIR}/src}"

echo "==> Paquets"
apt-get update
apt-get install -y git nginx certbot python3-certbot-nginx curl

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Dossiers"
mkdir -p "${APP_DIR}/web-dist" "${SRC_DIR}"

if [ ! -d "${SRC_DIR}/.git" ]; then
  git clone https://github.com/YTFeez/Crypt.git "${SRC_DIR}"
fi

echo "==> nginx"
sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "${SRC_DIR}/infra/nginx.conf" > /etc/nginx/sites-available/crypt
ln -sf /etc/nginx/sites-available/crypt /etc/nginx/sites-enabled/crypt
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo ""
echo "Étapes suivantes :"
echo "  1. Créez ${APP_DIR}/.env avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY"
echo "  2. bash ${SRC_DIR}/infra/deploy.sh"
echo "  3. certbot --nginx -d ${DOMAIN} --redirect --agree-tos -m admin@${DOMAIN}"
