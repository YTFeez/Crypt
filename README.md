# Talkeo — Messagerie entreprise sécurisée

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

### 2. Lancer l'application (fonctionne tout de suite)

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:5175](http://localhost:5175).

**Compte démo :** `demo@talkeo.app` / `demo1234`  
**Sans Supabase :** tout est stocké localement dans le navigateur.  
**Avec Supabase (production) :** copiez `.env.example` → `.env` et renseignez `VITE_SUPABASE_*`.

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

## Déploiement Hostinger VPS

**[DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md)** — installation, HTTPS, Supabase, GitHub Actions.

```bash
curl -fsSL https://raw.githubusercontent.com/YTFeez/Crypt/main/infra/hostinger-one-shot.sh | sudo DOMAIN=votredomaine.fr EMAIL=admin@votredomaine.fr bash
```

Mises à jour : `bash /opt/crypt/src/infra/deploy.sh`

## Prochaines étapes (optionnel)

- Intégrer **Daily.co** ou **Livekit** pour les appels multi-participants
- Notifications push (Supabase Edge Functions + web push)
- Audit logs entreprise (table `audit_events`)
- SSO SAML via Supabase Auth

## Licence

Usage interne Veragrow — adaptez selon vos besoins.
