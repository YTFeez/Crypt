# Talkeo — Messagerie entreprise sécurisée

> Dépôt GitHub : [github.com/YTFeez/Crypt](https://github.com/YTFeez/Crypt)

Plateforme professionnelle : messagerie E2E, contacts, groupes, appels audio/vidéo, dossiers partagés et tableaux collaboratifs.

## Fonctionnalités

| Module | Description |
|--------|-------------|
| **Comptes** | Inscription avec vérification e-mail, profils (navigateur ou Supabase optionnel) |
| **Messages** | Texte chiffré (AES-GCM), vocaux et fichiers via Storage |
| **Contacts** | Demandes d'amitié, acceptation, DM automatique |
| **Groupes** | Création d'équipes multi-membres |
| **Appels** | Salons audio/vidéo (WebRTC local + tokens pour Daily/Livekit) |
| **Dossiers** | Arborescence personnelle + dossiers communs avec partage |
| **Tableaux** | Canvas collaboratif synchronisé (Supabase Realtime) |

## Déploiement production (Hostinger VPS)

C’est le mode utilisé en production : le site est servi en **fichiers statiques** sur votre VPS Hostinger (nginx). **Aucun Supabase n’est requis.**

Voir **[DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md)** — installation HTTPS, mises à jour, e-mails de vérification.

```bash
bash /opt/crypt/src/infra/deploy.sh
```

## Où sont stockés les comptes ?

| Mode | Stockage |
|------|----------|
| **Hostinger VPS (recommandé)** | Base SQLite `/opt/crypt/data/talkeo.db` sur le serveur — voir `VITE_API_URL` |
| **Sans API (legacy)** | Navigateur uniquement (`localStorage` + IndexedDB) |
| **Supabase (optionnel)** | PostgreSQL cloud + sync |

**Sur le VPS** : le mot de passe est stocké en **hash Argon2id** (jamais en clair). Messages et fichiers sont dans un **coffre AES-256-GCM** — illisible sans le mot de passe de l’utilisateur.

**Outil admin pour déchiffrer** (avec le mot de passe du compte) : [tools/vault-decrypt/README.md](./tools/vault-decrypt/README.md)

## Installation locale (développement)

### Supabase (optionnel — sync cloud)

1. Projet sur [supabase.com](https://supabase.com/dashboard)
2. SQL : `supabase/migrations/001_initial_schema.sql` et `004_email_verified.sql`
3. Auth → **Confirm email** + redirect `https://votredomaine.fr/auth/callback`
4. `.env` : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`

### Lancer l’app

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:5175](http://localhost:5175).

**Compte démo :** `demo@talkeo.app` / `demo1234` (déjà vérifié)  
**Hostinger / sans `.env` Supabase :** mode local navigateur (comportement production actuel).

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

## Prochaines étapes (optionnel)

- Intégrer **Daily.co** ou **Livekit** pour les appels multi-participants
- Notifications push (Supabase Edge Functions + web push)
- Audit logs entreprise (table `audit_events`)
- SSO SAML via Supabase Auth

## Licence

Usage interne Veragrow — adaptez selon vos besoins.
