# Talkeo sur Hostinger VPS — guide complet

## Prérequis

| Élément | Détail |
|---------|--------|
| VPS Hostinger | Ubuntu 22 ou 24, accès **root** SSH |
| Domaine | Enregistrement **A** pointant vers l’**IP du VPS** |
| GitHub | Repo [YTFeez/Crypt](https://github.com/YTFeez/Crypt) |

> **HTTPS obligatoire** pour le chiffrement navigateur (`crypto.subtle`). Le script installe Let's Encrypt automatiquement.

---

## Installation automatique (recommandé)

Connectez-vous en SSH :

```bash
ssh root@VOTRE_IP_VPS
```

Une seule commande (remplacez le domaine et l’e-mail) :

```bash
curl -fsSL https://raw.githubusercontent.com/YTFeez/Crypt/main/infra/hostinger-one-shot.sh | sudo DOMAIN=crypt.votredomaine.fr EMAIL=admin@votredomaine.fr bash
```

Ou manuellement :

```bash
git clone https://github.com/YTFeez/Crypt.git /opt/crypt/src
cd /opt/crypt/src
sudo DOMAIN=crypt.votredomaine.fr EMAIL=admin@votredomaine.fr bash infra/setup-vps.sh
```

---

## Où sont stockés les comptes (mode VPS — recommandé) ?

Avec `VITE_API_URL` configuré, tout est sur le **VPS** :

| Donnée | Emplacement |
|--------|-------------|
| Comptes (e-mail, hash Argon2id du mot de passe) | SQLite `/opt/crypt/data/talkeo.db` → table `users` |
| Coffre chiffré (messages, dossiers, studio…) | Même base → table `vaults` (AES-256-GCM, **illisible sans mot de passe**) |
| Meta coffre (sel Argon2) | Table `users` (`vault_salt`, `vault_verifier`) |
| Codes de vérification e-mail | Table `email_verifications` |

Le mot de passe **n’est jamais enregistré en clair** sur le serveur.

### Déploiement API + base

Dans `/opt/crypt/.env` (voir `.env.production.example`) :

```env
VITE_API_URL=https://votredomaine.fr
TALKEO_JWT_SECRET=...   # openssl rand -hex 32
TALKEO_ADMIN_KEY=...    # openssl rand -hex 24
TALKEO_DATABASE_PATH=/opt/crypt/data/talkeo.db
```

Puis : `bash /opt/crypt/src/infra/deploy.sh` (installe l’API systemd `talkeo-api` + proxy nginx `/api/`).

### Outil de déchiffrement (administration)

Sur le VPS ou en local : `tools/vault-decrypt/` — voir [tools/vault-decrypt/README.md](./tools/vault-decrypt/README.md).

```bash
node tools/vault-decrypt/decrypt.mjs --list --db /opt/crypt/data/talkeo.db
node tools/vault-decrypt/decrypt.mjs --db /opt/crypt/data/talkeo.db --email user@corp.fr --password "..." --out export.json
```

---

## Ancien mode navigateur uniquement (sans API)

Sans `VITE_API_URL`, le VPS ne stocke **aucun compte**. Il sert uniquement le site (fichiers dans `/opt/crypt/web-dist`).

Chaque visiteur garde ses données **dans son navigateur** :

| Donnée | Stockage |
|--------|----------|
| E-mail + mot de passe (hash Argon2) | `localStorage` → `crypt-users-v2` |
| Session | `localStorage` → `crypt-session-v1` |
| Messages, dossiers, studio (chiffrés) | **IndexedDB** → `crypt-store` |
| Profils pour la recherche | `localStorage` → `crypt-profile-index-v1` |

Conséquences :

- Un compte créé sur le PC **n’existe pas** sur le téléphone (sauf si vous ajoutez Supabase plus tard).
- Effacer les données du site dans le navigateur = perte du compte local.
- La vérification e-mail bloque l’accès à l’app tant que le code n’est pas validé.

### E-mails de vérification (`support@talkeo.fr` — IONOS)

L’API Talkeo envoie les codes depuis **`support@talkeo.fr`** (boîte **IONOS**, pas Hostinger).

1. Créez la boîte `support@talkeo.fr` dans l’espace client IONOS (domaine `talkeo.fr`).
2. Sur le VPS, ajoutez dans `/opt/crypt/.env` :

```env
TALKEO_MAIL_FROM=support@talkeo.fr
TALKEO_MAIL_FROM_NAME=Talkeo
TALKEO_SMTP_HOST=smtp.ionos.fr
TALKEO_SMTP_PORT=465
TALKEO_SMTP_SECURE=true
TALKEO_SMTP_USER=support@talkeo.fr
TALKEO_SMTP_PASS=mot_de_passe_de_la_boite_ionos
```

**Paramètres IONOS officiels** : serveur sortant `smtp.ionos.fr`, port **465** (SSL/TLS).  
Si l’envoi échoue depuis le VPS, essayez le port **587** :

```env
TALKEO_SMTP_PORT=587
TALKEO_SMTP_SECURE=starttls
```

3. **Sans nano** — script automatique sur le VPS :

```bash
cd /opt/crypt/src && git pull
sudo TALKEO_SMTP_PASS='votre_mot_de_passe_ionos' bash infra/configure-ionos-mail.sh
```

4. Ou redéployez :

```bash
bash /opt/crypt/src/infra/deploy.sh
```

Le client appelle automatiquement `https://votredomaine.fr/api/send-verification` via `VITE_API_URL` (aucun webhook PHP requis).

Sans SMTP, les codes restent visibles dans les logs serveur (`journalctl -u talkeo-api -f`).

---

## Supabase (optionnel)

L’app **fonctionne sans Supabase** — c’est le cas standard sur Hostinger (mode local, données dans le navigateur de chaque visiteur).

Pour une messagerie **multi-appareils / multi-utilisateurs cloud** :

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Exécutez le SQL : `supabase/migrations/001_initial_schema.sql`
3. Éditez sur le VPS :

```bash
nano /opt/crypt/.env
```

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. Dans Supabase → **Authentication → URL Configuration** :
   - Site URL : `https://crypt.votredomaine.fr`
   - Redirect URLs : `https://crypt.votredomaine.fr/**`

5. Redéployez :

```bash
bash /opt/crypt/src/infra/deploy.sh
```

---

## Mises à jour

### Manuelle (SSH)

```bash
bash /opt/crypt/src/infra/deploy.sh
```

### Automatique (GitHub Actions)

1. Repo **Crypt** → **Settings** → **Secrets** → **Actions**
2. Ajoutez :

| Secret | Exemple |
|--------|---------|
| `VPS_HOST` | `123.45.67.89` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | clé privée SSH complète |
| `VPS_SSH_PORT` | `22` (optionnel) |

3. Chaque push sur `main` redéploie le site.

---

## Structure sur le VPS

```
/opt/crypt/
  .env              # variables Vite (optionnel)
  web-dist/         # site servi par nginx (build)
  src/              # code source + git pull
```

nginx : `/etc/nginx/sites-available/crypt`

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Page blanche | `bash /opt/crypt/src/infra/deploy.sh` puis Ctrl+F5 |
| 404 sur `/connexion` | `nginx -t` — `try_files` doit pointer vers `index.html` |
| Inscription échoue | Effacer données du site dans le navigateur ; HTTPS actif |
| certbot échoue | DNS : le domaine doit pointer vers le VPS (propagation 5–30 min) |
| `npm ci` échoue | `curl -fsSL https://deb.nodesource.com/setup_20.x \| bash -` puis réinstaller node |
| Ancien site Revise+ | Désactiver l’ancien vhost : `rm /etc/nginx/sites-enabled/revise-plus` |

### Logs

```bash
tail -f /var/log/nginx/error.log
journalctl -u nginx -f
```

### Test local sur le VPS

```bash
curl -sI http://127.0.0.1 | head -5
ls -la /opt/crypt/web-dist/
```

---

## Hébergement Apache (public_html) — non VPS

Si vous utilisez un hébergement **mutualisé** Hostinger sans nginx :

1. Build en local : `npm ci && npm run build`
2. Uploadez le contenu de `dist/` dans `public_html/`
3. Le fichier `.htaccess` (routing SPA) est inclus dans `dist/`

Le VPS dédié avec nginx reste la méthode recommandée.
