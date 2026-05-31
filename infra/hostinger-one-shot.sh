#!/usr/bin/env bash
# Installation en une commande (copier-coller sur le VPS Hostinger)
#
#   curl -fsSL https://raw.githubusercontent.com/YTFeez/Crypt/main/infra/hostinger-one-shot.sh | sudo DOMAIN=mondomaine.fr EMAIL=admin@mondomaine.fr bash
#
set -euo pipefail

DOMAIN="${DOMAIN:?}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
TMP="/tmp/crypt-setup-$$"

git clone --depth 1 https://github.com/YTFeez/Crypt.git "${TMP}"
bash "${TMP}/infra/setup-vps.sh"
rm -rf "${TMP}"
