# Déployer SecureHub sur Hostinger

## Option A — GitHub + déploiement manuel (recommandé)

1. Clonez [github.com/YTFeez/crypt](https://github.com/YTFeez/crypt).
2. Sur votre PC :
   ```bash
   git clone https://github.com/YTFeez/crypt.git
   cd crypt
   cp .env.example .env
   # Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
   npm ci
   npm run build
   ```
3. Dans **Hostinger → Fichiers** (ou File Manager), ouvrez `public_html`.
4. Uploadez **tout le contenu** du dossier `dist/` (pas le dossier lui-même).
5. Vérifiez que `.htaccess` est présent (copié depuis `public/.htaccess` par Vite).

## Option B — GitHub Actions

1. Dans GitHub : **Settings → Secrets → Actions**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Chaque push sur `main` génère l’artifact `secure-hub-dist`.
3. Téléchargez l’artifact et uploadez-le dans `public_html`.

## Variables Supabase côté build

Les clés `VITE_*` sont injectées **au build**. Sur Hostinger, vous devez rebuild si vous changez Supabase.

## Domaine & HTTPS

- Activez le certificat SSL gratuit Hostinger.
- Pour une sous-route (`mondomaine.com/app`), configurez `base` dans `vite.config.ts`.

## Supabase (production)

- **Authentication → URL Configuration** : ajoutez `https://votredomaine.com`
- Exécutez le SQL : `supabase/migrations/001_initial_schema.sql`
