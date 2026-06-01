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

## Supabase (optionnel)

L’app **fonctionne sans Supabase** (mode local, données dans le navigateur de chaque visiteur).

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
