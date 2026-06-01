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

## Où sont stockés les comptes (Hostinger, sans Supabase) ?

Le VPS ne stocke **aucun compte utilisateur**. Il sert uniquement le site (fichiers dans `/opt/crypt/www`).

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

### Envoyer les e-mails de vérification (sans Supabase)

Par défaut, Talkeo génère un **code à 6 chiffres** côté client. Pour l’envoyer par e-mail en production :

1. Créez un petit endpoint (PHP sur Hostinger mutualisé, ou script Node sur le VPS) qui accepte un POST JSON : `{ "email", "code", "displayName" }`.
2. Sur le VPS :

```bash
nano /opt/crypt/.env
```

```env
VITE_VERIFICATION_EMAIL_URL=https://votredomaine.fr/api/send-verification.php
```

3. Redéployez : `bash /opt/crypt/src/infra/deploy.sh`

Sans cette URL, les utilisateurs doivent utiliser le code reçu si vous l’envoyez manuellement, ou configurer Supabase Auth (section ci-dessous).

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
