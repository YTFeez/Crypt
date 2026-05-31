# Crypt — Messagerie entreprise chiffrée (Supabase)

> Dépôt GitHub : [github.com/YTFeez/Crypt](https://github.com/YTFeez/Crypt)

Plateforme professionnelle : messagerie E2E, contacts, groupes, appels audio/vidéo, dossiers partagés et tableaux collaboratifs.

## Fonctionnalités

| Module | Description |
|--------|-------------|
| **Comptes** | Inscription / connexion Supabase Auth, profils persistés |
| **Messages** | Texte chiffré (AES-GCM), vocaux et fichiers via Storage |
| **Contacts** | Demandes d'amitié, acceptation, DM automatique |
| **Groupes** | Création d'équipes multi-membres |
| **Appels** | Salons audio/vidéo (WebRTC local + tokens pour Daily/Livekit) |
| **Dossiers** | Arborescence personnelle + dossiers communs avec partage |
| **Tableaux** | Canvas collaboratif synchronisé (Supabase Realtime) |

## Installation rapide

### 1. Projet Supabase

1. Créez un projet sur [supabase.com](https://supabase.com/dashboard)
2. Ouvrez **SQL Editor** et exécutez le fichier :
   `supabase/migrations/001_initial_schema.sql`
3. Vérifiez **Database → Replication** : Realtime activé pour `messages`, `boards`, `calls`
4. **Authentication → Providers** : activez Email

### 2. Variables d'environnement

```bash
cd secure-hub
cp .env.example .env
```

Renseignez dans `.env` :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

(Ces valeurs sont dans **Project Settings → API**.)

### 3. Lancer l'application

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:5175](http://localhost:5175).

## Structure

```
secure-hub/
├── supabase/migrations/   # Schéma SQL + RLS
├── src/
│   ├── auth/              # Session Supabase
│   ├── lib/               # API, crypto, client Supabase
│   ├── pages/             # UI (messages, amis, groupes…)
│   └── layout/            # Navigation app
└── README.md
```

## Déploiement Hostinger

Voir **[DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md)** pour le guide complet (build, upload `dist/`, `.htaccess` SPA).

```bash
npm run build
```

Uploadez le contenu de `dist/` dans `public_html` sur Hostinger.

## Prochaines étapes (optionnel)

- Intégrer **Daily.co** ou **Livekit** pour les appels multi-participants
- Notifications push (Supabase Edge Functions + web push)
- Audit logs entreprise (table `audit_events`)
- SSO SAML via Supabase Auth

## Licence

Usage interne Veragrow — adaptez selon vos besoins.
