#!/usr/bin/env bash
# Configure l'envoi SMTP IONOS (support@talkeo.fr) dans /opt/crypt/.env
# Usage sur le VPS :
#   sudo TALKEO_SMTP_PASS='votre_mot_de_passe' bash infra/configure-ionos-mail.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/crypt/.env}"
PASS="${TALKEO_SMTP_PASS:-${1:-}}"

if [ "$(id -u)" -ne 0 ] && [ ! -w "$(dirname "${ENV_FILE}")" ]; then
  echo "Lancez avec sudo." >&2
  exit 1
fi

if [ -z "${PASS}" ]; then
  echo "Usage: sudo TALKEO_SMTP_PASS='...' bash $0" >&2
  exit 1
fi

mkdir -p "$(dirname "${ENV_FILE}")"
touch "${ENV_FILE}"

# Retire les anciennes lignes mail pour éviter les doublons
grep -v '^TALKEO_MAIL_' "${ENV_FILE}" 2>/dev/null | grep -v '^TALKEO_SMTP_' > "${ENV_FILE}.tmp" || true
mv "${ENV_FILE}.tmp" "${ENV_FILE}"

cat >> "${ENV_FILE}" <<EOF

# E-mail vérification (IONOS)
TALKEO_MAIL_FROM=support@talkeo.fr
TALKEO_MAIL_FROM_NAME=Talkeo
TALKEO_SMTP_HOST=smtp.ionos.fr
TALKEO_SMTP_PORT=465
TALKEO_SMTP_SECURE=true
TALKEO_SMTP_USER=support@talkeo.fr
TALKEO_SMTP_PASS=${PASS}
EOF

chmod 600 "${ENV_FILE}"

if systemctl is-active talkeo-api >/dev/null 2>&1 || systemctl list-unit-files talkeo-api.service >/dev/null 2>&1; then
  systemctl restart talkeo-api.service
  echo "OK — SMTP IONOS configuré, service talkeo-api redémarré."
else
  echo "OK — SMTP configuré dans ${ENV_FILE} (service talkeo-api non trouvé, redémarrez manuellement)."
fi

echo "Vérif : grep TALKEO_SMTP_HOST ${ENV_FILE}"
