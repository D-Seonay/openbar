# OpenBar 🍸

Application web pour organiser les soirées d'un groupe : tenir le stock d'alcool, savoir qui ramène quoi, calculer les cocktails réalisables avec ce qu'il y a réellement en cave, et partager les photos après coup.

Plusieurs **bars** peuvent coexister — chacun avec ses membres, son stock et ses soirées.

## Fonctionnalités

### Stock

- **Cave** (`/stock`) — bouteilles avec quantité, catégorie, tags, formats (70cl, 1L…), photo, notes et seuil d'alerte. Tous ces champs restent modifiables après création.
- **Scanner de code-barres** — la caméra lit le code, le produit est cherché dans Open Food Facts et le formulaire est prérempli. Un code déjà en stock ouvre directement la bouteille pour ajuster la quantité.
- **Réserve VIP** — bouteilles visibles seulement des membres marqués VIP.
- **Liste de courses** — les références sous leur seuil d'alerte, copiables ou exportables en CSV.

### Cocktails

`/cocktails` calcule à partir du stock réel ce qui est réalisable maintenant, ce qui nécessite la réserve VIP, et ce qu'il manque pour le reste. Le matching se fait sur les tags des bouteilles.

### Soirées

- **Planification** (`/soirees`) — date, lien d'invitation, et un rappel quand une soirée passée n'a pas eu son bilan.
- **Qui ramène quoi** — l'hôte liste ce qu'il faut, avec le **nombre de personnes attendues** par item ; les invités se déclarent, avatars à l'appui, et l'item se ferme une fois complet.
- **Bilan** — ajustement du stock en fin de soirée, historisé.
- **Galerie** — photos et vidéos, téléchargeables une par une ou toutes en une archive zip.
- **Calendrier** — une soirée s'ajoute à l'agenda en `.ics`, et un flux d'abonnement personnel tient Google Agenda / iPhone à jour automatiquement.

### Discord *(optionnel)*

Chaque membre peut lier son compte Discord depuis `/profil`. Un bar peut ensuite être relié à un salon, ce qui donne :

- le tableau **« à ramener »** publié dans le salon et mis à jour à chaque changement, les invités liés apparaissant en mention ;
- l'**annonce d'une soirée en message privé** aux membres qui ont lié leur compte ;
- des **sondages** natifs Discord lancés depuis la soirée.

Sans configuration Discord, ces fonctions sont simplement absentes.

### Administration

- **Comptes** (`/comptes`), **membres du bar** (`/membres` — `/annuaire` y redirige de façon permanente, les deux montraient les mêmes personnes), **découverte des bars publics** (`/decouvrir`).
- **Journal** (`/journal`) — qui a fait quoi : bouteilles ajoutées ou retirées, quantités ajustées, soirées créées, bilans validés. Réservé au propriétaire du bar.

## Architecture

Deux services, une base Postgres.

```
navigateur ──► web (Next.js 16)  ──►  api (NestJS)  ──►  Postgres
                    │                      │
                    │                      └──► Open Food Facts, Discord
                    └── /uploads/* réécrit vers l'API
```

**L'API n'a pas de port publié.** Le navigateur ne l'appelle jamais directement : les pages passent par des Server Actions côté serveur, et les images uploadées transitent par une réécriture `/uploads/*` du service web. Seule l'API sort vers l'extérieur (Open Food Facts, Discord).

| | |
|---|---|
| Web | Next.js 16 (App Router, Server Actions), Tailwind CSS v4 |
| API | NestJS 11, Prisma 6, Postgres 16 |
| Auth | JWT en cookie httpOnly, comptes et rôles par bar |

> Les guides Next.js de la version installée sont dans `node_modules/next/dist/docs/` — cette version a des ruptures d'API par rapport aux versions antérieures (le middleware s'appelle `proxy.ts`, par exemple).

## Démarrer

### Avec Docker (recommandé)

```bash
cp .env.example .env      # renseigner au moins JWT_SECRET
docker compose up --build
```

L'application écoute sur [http://localhost:8080](http://localhost:8080).

### En local

```bash
# API
cd api
npm install
npx prisma migrate deploy
npm run start:dev          # port 3001

# Web, dans un autre terminal
npm install
npm run dev                # port 3000
```

L'API attend une base Postgres joignable via `DATABASE_URL` (voir `api/.env`).

## Configuration

| Variable | Service | Rôle |
|---|---|---|
| `JWT_SECRET` | web + api | Signature des sessions. **À changer.** |
| `DATABASE_URL` | api | Connexion Postgres. |
| `NEST_API_URL` | web | Adresse interne de l'API. |
| `WEB_ORIGIN` | api | Origine publique, utilisée dans les liens sortants. |
| `COOKIE_SECURE` | web | `true` derrière un reverse proxy TLS. |
| `DISCORD_CLIENT_ID` | web + api | Application Discord. Vide = intégration désactivée. |
| `DISCORD_CLIENT_SECRET` | api | **Secret.** Jamais côté web, jamais commité. |
| `DISCORD_REDIRECT_URI` | web + api | `https://<hôte>/api/discord/callback` |
| `DISCORD_BOT_TOKEN` | api | **Secret.** Nécessaire pour publier le tableau, les MP et les sondages. |

Les secrets se renseignent côté serveur (`.env` non versionné, ou le gestionnaire de secrets du déploiement) — jamais dans le dépôt.

### Activer Discord

1. Créer une application sur [discord.com/developers](https://discord.com/developers/applications).
2. **OAuth2** → ajouter `https://<hôte>/api/discord/callback` en *redirect URI*, relever le *Client ID* et le *Client Secret*.
3. **Bot** → créer le bot, relever le *token*, l'inviter sur le serveur avec le droit d'écrire dans le salon voulu.
4. Renseigner les quatre variables ci-dessus, puis lier le salon dans `/membres` et son compte dans `/profil`.

Le bot n'a **pas besoin d'être joignable depuis Internet** : il n'utilise que l'API REST de Discord, en sortant. Seule la redirection OAuth requiert une URL publique, servie par le web.

## Déploiement

`ansible/` contient les playbooks : création de VM Proxmox, installation du runner GitHub, et ingress Traefik avec certificat Let's Encrypt. Le web est exposé derrière l'ingress ; l'API et Postgres restent sur le réseau interne.

## Tests

```bash
npm test                   # web — unitaires (Vitest), dont les contrastes de palette
npm run audit               # web — audit navigateur (Playwright) : cibles tactiles, plancher de texte, palette
npm run lint                # web
cd api && npx jest         # tests unitaires de l'API
cd api && npm run lint     # api
```

`npm run audit` s'exécute contre un build (`npm run build && npx next start`) et attend trois comptes de test (voir `e2e/fixtures.ts`) plus un jeton d'invitation actif :

| Variable | Rôle |
|---|---|
| `AUDIT_USERNAME` / `AUDIT_PASSWORD` | Compte `USER`, propriétaire d'un bar. |
| `AUDIT_ADMIN_USERNAME` / `AUDIT_ADMIN_PASSWORD` | Compte `ADMIN` global, pour `/admin` et le bilan. |
| `AUDIT_NOBAR_USERNAME` / `AUDIT_NOBAR_PASSWORD` | Compte sans aucun bar, seul état qui laisse `/creer` afficher son formulaire plutôt que rediriger vers `/`. |
| `AUDIT_INVITE_TOKEN` | Jeton d'invitation actif, pour auditer `/rejoindre/[token]`. Absent, les tests concernés se sautent explicitement plutôt que d'échouer. |

Le commentaire en tête d'`e2e/audit.spec.ts` prévient : une page absente de la liste couverte n'est pas auditée, donc pas terminée.

## Documents

- [`CAHIER_DES_CHARGES.md`](CAHIER_DES_CHARGES.md) — périmètre fonctionnel et modèle de données.
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — palette, composants et **règles mobile obligatoires**.
- [`AGENTS.md`](AGENTS.md) — consignes pour les agents travaillant sur le dépôt.
