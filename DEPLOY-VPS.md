# Déployer Crypt sur ton VPS (remplacer Revise+)

Crypt est un **site statique** (React + Supabase). Pas besoin de PM2 ni PostgreSQL sur le VPS — seulement **nginx + Node** pour le build.

## Vue d’ensemble

| Avant (Revise+) | Après (Crypt) |
|-----------------|---------------|
| Repo `Revise` | Repo **[YTFeez/Crypt](https://github.com/YTFeez/Crypt)** |
| `/opt/revise-plus` | `/opt/crypt` |
| nginx + API Node + PM2 | nginx seul (fichiers dans `web-dist`) |
| Secrets sur repo Revise | Secrets sur repo **Crypt** |

---

## Étape 1 — GitHub (repo Crypt)

1. Ouvre **https://github.com/YTFeez/Crypt** → **Settings** → **Secrets and variables** → **Actions**
2. Ajoute les mêmes secrets que pour Revise+ (si tu les avais déjà) :
   - `VPS_HOST` — IP du VPS
   - `VPS_USER` — ex. `root` ou `ubuntu`
   - `VPS_SSH_KEY` — clé privée SSH complète
3. (Optionnel) pour le build CI : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`  
   Sur le VPS, le fichier `/opt/crypt/.env` suffit pour le déploiement SSH.

4. Sur le repo **Revise** : désactive ou supprime l’ancien workflow **Deploy Revise+** si tu ne veux plus qu’il écrase le serveur à chaque push.

---

## Étape 2 — Connexion SSH au VPS

```bash
ssh root@TON_IP_VPS
```

---

## Étape 3 — Arrêter Revise+ (si tu remplaces tout le site)

```bash
pm2 stop all
pm2 save
# Optionnel : désactiver l’ancien site nginx
rm -f /etc/nginx/sites-enabled/revise-plus
# ou le nom de ton ancien fichier dans sites-enabled/
```

---

## Étape 4 — Installer Crypt

```bash
export DOMAIN=ton-domaine.fr   # le domaine qui pointe vers le VPS

mkdir -p /opt/crypt
git clone https://github.com/YTFeez/Crypt.git /opt/crypt/src

# Variables Supabase (obligatoire pour le build)
nano /opt/crypt/.env
```

Contenu de `/opt/crypt/.env` (recommandé en production) :

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Sans ce fichier, le site se build en **mode local** (données uniquement côté navigateur de chaque visiteur). Pour une vraie messagerie multi-utilisateurs, configurez Supabase.

Puis :

```bash
bash /opt/crypt/src/infra/setup-vps.sh
bash /opt/crypt/src/infra/deploy.sh
certbot --nginx -d ton-domaine.fr --redirect --agree-tos -m ton@email.fr --non-interactive
```

---

## Étape 5 — Supabase (production)

Dans le dashboard Supabase → **Authentication** → **URL Configuration** :

- **Site URL** : `https://ton-domaine.fr`
- **Redirect URLs** : `https://ton-domaine.fr/**`

Exécute le SQL si ce n’est pas fait : `supabase/migrations/001_initial_schema.sql`

---

## Mises à jour automatiques (GitHub Actions)

À chaque `git push` sur `main` du repo **Crypt**, le workflow **Deploy Crypt (VPS)** exécute `infra/deploy.sh` sur le serveur.

Test manuel sur le VPS :

```bash
bash /opt/crypt/src/infra/deploy.sh
```

---

## Même domaine qu’avant

Si ton domaine servait déjà Revise+, il suffit que nginx pointe vers `/opt/crypt/web-dist` (le script `setup-vps.sh` le fait). Les routes `/api` et `/ws` de l’ancien Revise+ ne sont plus nécessaires pour Crypt.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Page blanche | Vérifier `/opt/crypt/.env` et refaire `deploy.sh` |
| 404 sur `/connexion` | `try_files` nginx + fichier `.htaccess` dans `dist` |
| Ancien site Revise+ | `nginx -T` puis corriger `root` vers `/opt/crypt/web-dist` |
| Deploy GitHub échoue | Vérifier les 3 secrets sur le repo **Crypt**, pas Revise |
