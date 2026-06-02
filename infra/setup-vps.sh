#!/usr/bin/env bash
# Installation Crypt sur Hostinger VPS (Ubuntu 22/24)
# Usage: sudo DOMAIN=votredomaine.fr EMAIL=admin@votredomaine.fr bash setup-vps.sh
set -euo pipefail

DOMAIN="${DOMAIN:?Définissez DOMAIN=votredomaine.fr}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
APP_DIR="${APP_DIR:-/opt/crypt}"
SRC_DIR="${SRC_DIR:-${APP_DIR}/src}"
REPO_URL="${REPO_URL:-https://github.com/YTFeez/Crypt.git}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Relancez en root : sudo DOMAIN=${DOMAIN} bash $0" >&2
  exit 1
fi

echo "==> Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git nginx certbot python3-certbot-nginx curl rsync

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  echo "==> Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

echo "==> Dossiers application"
mkdir -p "${APP_DIR}/web-dist" "${SRC_DIR}"

if [ ! -d "${SRC_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${SRC_DIR}"
fi

if [ ! -f "${APP_DIR}/.env" ]; then
  cat > "${APP_DIR}/.env" <<'EOF'
# Optionnel — laissez vide pour mode local (fonctionne sans Supabase)
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EOF
  echo "Fichier créé : ${APP_DIR}/.env"
fi

echo "==> nginx (HTTP — SSL via certbot)"
# Supprime toute config existante pour ce domaine pour éviter les doublons
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/crypt 2>/dev/null || true
rm -f /etc/nginx/conf.d/crypt.conf 2>/dev/null || true
sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "${SRC_DIR}/infra/nginx-http-only.conf" > /etc/nginx/sites-available/crypt
ln -sf /etc/nginx/sites-available/crypt /etc/nginx/sites-enabled/crypt
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> Premier déploiement"
bash "${SRC_DIR}/infra/deploy.sh"

echo "==> Certificat HTTPS (Let's Encrypt)"
if certbot --nginx -d "${DOMAIN}" --redirect --agree-tos -m "${EMAIL}" --non-interactive; then
  echo "==> Passage à la config nginx HTTPS complète"
  # Certbot a déjà modifié la config — on remplace proprement sans doublon
  sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "${SRC_DIR}/infra/nginx.conf" > /etc/nginx/sites-available/crypt
  nginx -t && systemctl reload nginx
  echo "==> Suppression de la config HTTP-only redondante"
  # Vérifie que seul sites-available/crypt est actif
  ls /etc/nginx/sites-enabled/ | grep -v crypt | while read f; do
    rm -f "/etc/nginx/sites-enabled/${f}"
  done
else
  echo "WARN: certbot a échoué — le site reste en HTTP. Vérifiez le DNS (A → IP du VPS)."
fi

echo ""
echo "============================================"
echo " Crypt installé sur https://${DOMAIN}"
echo " Éditez ${APP_DIR}/.env puis : bash ${SRC_DIR}/infra/deploy.sh"
echo "============================================"
