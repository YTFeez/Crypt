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

| Déploiement | Où ? | Conséquence |
|-------------|------|-------------|
| **Hostinger (sans Supabase)** | Dans le **navigateur** de chaque utilisateur | Comptes, messages et fichiers restent sur l’appareil utilisé (pas de serveur central Talkeo). |
| **Avec Supabase (optionnel)** | Base PostgreSQL Supabase + Auth | Sync multi-appareils, messagerie cloud. |

Détail **mode Hostinger** (par utilisateur, dans le navigateur) :

| Donnée | Emplacement technique |
|--------|------------------------|
| Identifiants (e-mail, mot de passe hashé Argon2) | `localStorage` → clé `crypt-users-v2` |
| Session connectée | `localStorage` → `crypt-session-v1` |
| Messages, dossiers, studio… (chiffrés AES-GCM) | **IndexedDB** → base `crypt-store` |
| Index profils (recherche contacts) | `localStorage` → `crypt-profile-index-v1` |
| Code de vérification e-mail en attente | `localStorage` → `crypt-email-pending-v1` |

> Le VPS Hostinger héberge uniquement le **site web** (HTML/JS/CSS). Il ne reçoit pas les mots de passe ni les messages.

**E-mails de vérification sur Hostinger :** sans Supabase, configurez un webhook d’envoi (`VITE_VERIFICATION_EMAIL_URL` dans `/opt/crypt/.env`) ou utilisez le code affiché en mode développement. Voir DEPLOY-HOSTINGER.md.

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
