# Talkeo — outil de déchiffrement (administration)

Permet d’exporter le contenu d’un coffre utilisateur stocké sur le VPS **si vous connaissez le mot de passe du compte**.

Le serveur ne stocke **jamais** le mot de passe en clair — seulement un hash Argon2id. Le coffre (messages, dossiers…) est chiffré en **AES-256-GCM** ; le mot de passe sert à le déchiffrer.

## Installation (sur le VPS ou votre PC)

```bash
cd tools/vault-decrypt
npm ci
```

## Lister les comptes

```bash
node decrypt.mjs --list --db /opt/crypt/data/talkeo.db
```

## Déchiffrer via la base SQLite (accès SSH au VPS)

```bash
node decrypt.mjs \
  --db /opt/crypt/data/talkeo.db \
  --email utilisateur@entreprise.fr \
  --password "MotDePasseDuCompte" \
  --out export.json
```

## Déchiffrer via l’API (sans lire le fichier .db)

Utilise la clé `TALKEO_ADMIN_KEY` définie dans `/opt/crypt/.env` :

```bash
node decrypt.mjs \
  --api https://votredomaine.fr \
  --admin-key VOTRE_TALKEO_ADMIN_KEY \
  --email utilisateur@entreprise.fr \
  --password "MotDePasseDuCompte" \
  --out export.json
```

## Sécurité

- Conservez `TALKEO_ADMIN_KEY` comme un secret root (chmod 600 sur `.env`).
- N’utilisez cet outil que pour sauvegarde légale, support ou récupération autorisée.
- Sans le mot de passe utilisateur, le coffre reste illisible (conception zero-knowledge).
