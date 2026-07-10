# Spec — Backend NestJS + Postgres + comptes utilisateurs

Date : 2026-07-10
Statut : approuvé (prêt pour plan d'implémentation)
Réfère à : `CAHIER_DES_CHARGES.md` (v1), `docs/superpowers/specs/2026-07-08-bardenoa-v2-design.md` (v2, déjà implémentée)

## 1. Contexte et objectif

Le projet tourne aujourd'hui comme un monolithe Next.js : toute la logique et la persistance passent par `src/lib/db.ts` (fichier JSON `data/store.json`), et l'authentification admin est un mot de passe unique (`ADMIN_PASSWORD`) comparé à un cookie de session (`src/lib/auth.ts`).

Cette spec fait évoluer le projet vers :
- un **backend NestJS** séparé qui porte toute la logique métier et l'accès aux données ;
- une **base Postgres** en remplacement du fichier `data/store.json` ;
- de **vrais comptes utilisateurs** (admin + proches), remplaçant le mot de passe unique et l'identification par prénom libre ;
- un déploiement cible sur le **serveur maison** de l'utilisateur (Docker Compose).

Cette spec **révise deux points explicitement exclus par la v2** (`docs/superpowers/specs/2026-07-08-bardenoa-v2-design.md`, section 9) : la migration vers une base externe et l'authentification multi-utilisateurs sont désormais dans le périmètre — c'est l'objet même de cette itération.

**Non-objectif** : cette spec ne change aucun comportement fonctionnel visible (stock, moteur de cocktails, soirées, bilan post-soirée) autre que la façon dont les comptes et le VIP sont gérés. La migration technique constitue l'amélioration recherchée ; aucune nouvelle fonctionnalité n'est ajoutée dans ce lot.

## 2. Architecture globale

Deux services applicatifs distincts + une base de données, déployés ensemble via Docker Compose sur le serveur maison :

- **`web/`** — le Next.js existant (App Router, TypeScript, Tailwind), inchangé côté UI/DA. Les Server Actions deviennent de fins wrappers qui appellent l'API NestJS via un client HTTP interne, au lieu d'écrire dans `data/store.json`.
- **`api/`** — nouveau projet NestJS autonome (`package.json` propre), qui porte la logique métier (stock, cocktails, soirées, contributions, bilans, comptes) et parle à Postgres via Prisma.
- **`postgres`** — conteneur Postgres avec volume nommé persistant.

Choix explicite : **deux projets Node côte à côte**, pas un monorepo/workspaces npm. Ça évite de déplacer les chemins du Next.js existant et reste plus simple à maintenir pour un projet perso. Un `docker-compose.yml` à la racine du repo orchestre les trois services.

## 3. Modèle de données (Prisma / Postgres)

Changement structurant : les contributions référencent désormais un vrai `User` (plus de `guestName` en texte libre), et le statut VIP devient un attribut global du compte plutôt qu'une liste de prénoms par soirée.

```
User            id, username (unique), passwordHash, role (ADMIN | USER), vip (boolean), createdAt
Bottle          id, name, type (enum), quantity, tags (string[]), vip (boolean), notes?, lowStockThreshold?, imageUrl?, createdAt
BottleVolume    id, bottleId (FK), size, quantity
Event           id, slug (unique), name, date, createdAt        -- vipNames supprimé
Contribution    id, eventId (FK), userId (FK), item, quantity?, createdAt
StockAdjustment id, eventId (FK), bottleId (FK), bottleName (snapshot), quantityBefore, quantityAfter, createdAt
```

Règles conservées de la v1/v2 :
- `slug` généré depuis `name` (minuscule, sans accents, non-alphanumérique → `-`), suffixe `-2`, `-3`... en cas de collision.
- Supprimer un `Event` supprime en cascade ses `Contribution` et `StockAdjustment` (`onDelete: Cascade` en Prisma).
- Le calcul de faisabilité cocktail (correspondance de tags, priorité bouteille non-VIP, classement "réserve VIP") reste identique — seule sa source de données change (Postgres au lieu du JSON).
- `lowStockThreshold` (alertes stock bas, v2) est conservé tel quel.

Règle nouvelle :
- Un `User.vip = true` déverrouille la réserve VIP (bouteilles + cocktails) sur **toutes** les soirées auxquelles il participe, plus de notion de liste VIP par événement.

## 4. Comptes utilisateurs et rôles

- **Deux rôles** : `ADMIN` (l'hôte, gère stock/soirées/comptes) et `USER` (tout le monde d'autre, y compris les invités occasionnels — tout le monde a désormais un compte, plus de parcours anonyme par prénom).
- **VIP** est un booléen indépendant du rôle, porté par le compte `User`, géré uniquement par l'admin.
- **Création de comptes réservée à l'admin** : pas d'auto-inscription. L'admin crée un compte (username + mot de passe temporaire) pour chaque proche depuis une interface d'administration, et décide qui est VIP.
- Un compte `ADMIN` unique est créé à la mise en place du système (à partir de l'actuel `ADMIN_PASSWORD` ou d'un mot de passe choisi à ce moment-là).

## 5. Authentification & autorisation

- **Login** : `POST /auth/login` (username + mot de passe) → NestJS vérifie via bcrypt, signe un JWT, le pose en cookie `httpOnly` (`Secure` en prod, `SameSite=Lax`). `POST /auth/logout` l'efface.
- **Guards NestJS** : `JwtAuthGuard` (route authentifiée ou non), `RolesGuard` (`ADMIN` vs `USER`), vérification `vip` au niveau service pour les endpoints/données réservées à la réserve VIP.
- Le secret JWT est partagé entre `api/` et `web/` (variable d'env `JWT_SECRET`) pour que `web/` puisse valider le cookie côté SSR sans appel réseau supplémentaire à chaque requête.
- Côté Next.js : `src/lib/auth.ts` (hash maison + `ADMIN_PASSWORD`) est supprimé, remplacé par une vérification du JWT dans `proxy.ts` (déjà le point d'entrée du contrôle d'accès aujourd'hui). Le formulaire `/login` devient un vrai formulaire username + mot de passe qui appelle `POST /auth/login`.

## 6. Surface API NestJS (modules)

- **AuthModule** — login/logout, stratégie JWT (`@nestjs/passport` + `passport-jwt`), guards.
- **UsersModule** — CRUD comptes, réservé `ADMIN` (`POST /users`, `GET /users`, `PATCH /users/:id` pour rôle/VIP, `DELETE /users/:id`).
- **BottlesModule** — CRUD bouteilles + volumes, section VIP.
- **CocktailsModule** — recettes statiques (portées depuis `src/lib/cocktails.ts`) + calcul de faisabilité, exposé en lecture seule (`GET /cocktails`).
- **EventsModule** — CRUD soirées (`GET/POST /events`, `DELETE /events/:slug`).
- **ContributionsModule** — imbriqué sous un event (`GET/POST/DELETE /events/:slug/contributions`), lié à `userId` (l'utilisateur connecté, plus de saisie de nom libre).
- **StockAdjustmentsModule** — logique du bilan post-soirée (`GET/POST /events/:slug/stock-adjustments`).

Chaque module suit le triptyque Nest standard (`controller` → `service` → `module`). La logique de faisabilité cocktail et le `slugify` restent des fonctions pures testables indépendamment du framework, comme aujourd'hui.

## 7. Intégration côté Next.js

- Nouveau `src/lib/api-client.ts` : wrapper `fetch` vers `NEST_API_URL`, transmet le cookie JWT à chaque appel serveur→serveur. Remplace les imports de `src/lib/db.ts` dans les pages et Server Actions.
- Les Server Actions existantes (`actions.ts`, `login/actions.ts`, actions dans `stock/`, `soirees/`) gardent leur signature et leur usage côté formulaires, mais leur corps délègue à `api-client` au lieu d'écrire dans le fichier JSON.
- Page invité (`/soirees/[slug]`) : le champ "prénom" est remplacé par un vrai formulaire de connexion (username + mot de passe). Une fois connecté, `user.vip` détermine directement l'accès à la réserve VIP — plus de comparaison à une liste de prénoms par soirée.
- `src/lib/types.ts` : types miroir du schéma Prisma (pas d'import direct des types générés Prisma dans `web/`, pour garder les deux projets découplés).

## 8. Migration des données existantes

Script one-shot dans `api/` (`scripts/migrate-from-json.ts`), exécuté manuellement une fois lors du passage à cette version :
1. Importe `bottles` et leurs `volumes` tels quels.
2. Importe `events` (sans le champ `vipNames`, abandonné).
3. Pour chaque `guestName` unique rencontré dans les `contributions` du fichier JSON, crée un `User` (rôle `USER`, `vip = false` par défaut, mot de passe temporaire généré aléatoirement) — l'admin devra ensuite manuellement promouvoir les VIP et redistribuer les mots de passe à ses proches.
4. Importe `contributions` et `stockAdjustments` en les reliant aux `User` créés à l'étape 3.
5. Crée le compte `ADMIN` (username choisi manuellement au lancement du script, mot de passe basé sur l'actuel `ADMIN_PASSWORD` ou saisi à ce moment).

Le script n'est pas idempotent (usage prévu : une seule fois) et n'est pas exposé comme route API.

## 9. Déploiement (serveur maison)

- `docker-compose.yml` à la racine avec 3 services : `postgres` (volume nommé persistant), `api` (NestJS), `web` (Next.js).
- Variables d'environnement : `DATABASE_URL` (Postgres, service `api` uniquement), `JWT_SECRET` (partagé `api`/`web`), `NEST_API_URL` (côté `web`, pointe vers le service `api` interne au réseau Docker).
- Les migrations Prisma (`prisma migrate deploy`) s'exécutent au démarrage du conteneur `api`, avant que le serveur Nest n'écoute.
- Chaque service (`api/`, `web/`) a son propre `Dockerfile`.

## 10. Tests

- `src/lib/cocktails.test.ts` migre vers `api/` (Jest, défaut NestJS) puisque la logique de faisabilité y vit désormais ; couverture inchangée (faisabilité, priorité non-VIP, classement VIP, tri par ingrédients manquants).
- `src/lib/auth.test.ts` (hash maison) est supprimé, remplacé par des tests Nest sur `AuthService` (vérification bcrypt, émission/validation JWT) et sur les guards (`RolesGuard`, accès VIP).
- Les éventuels tests de rendu côté `web/` restent en Vitest, inchangés.

## 11. Arborescence des routes (inchangée côté comportement)

Aucune route Next.js n'est ajoutée ou supprimée par cette spec — seule la protection d'accès change de mécanisme (JWT au lieu du cookie de mot de passe unique) et la page invité passe d'une identification par prénom à un vrai login.

| Route | Protection (nouvelle) |
|---|---|
| `/` | JWT valide (tout rôle) |
| `/login` | publique — username + mot de passe |
| `/stock` | JWT + rôle `ADMIN` |
| `/cocktails` | JWT valide (tout rôle) ; VIP conditionné à `user.vip` |
| `/soirees` | JWT + rôle `ADMIN` |
| `/soirees/[slug]` | JWT valide (tout rôle) — login requis, plus de parcours anonyme |
| `/soirees/[slug]/bilan` | JWT + rôle `ADMIN` |

## 12. Critères d'acceptation

- `docker compose up` démarre les 3 services et sert l'app sur le port configuré, avec Postgres persistant entre redémarrages.
- Un compte créé par l'admin (`POST /users`) permet de se connecter via `/login` et d'accéder aux pages selon son rôle et son statut VIP.
- Un utilisateur `vip = true` voit la réserve VIP sur **toute** soirée à laquelle il participe, sans configuration par événement.
- Un utilisateur `vip = false` ne voit ni la réserve VIP ni les cocktails qui en dépendent.
- Le script de migration importe correctement les bouteilles, soirées, contributions et ajustements de stock existants depuis `data/store.json`, et crée un compte par `guestName` unique rencontré.
- `npm run test` (côté `api/`, Jest) passe pour les tests de faisabilité cocktail et d'authentification.
- Aucune régression fonctionnelle visible sur le stock, le moteur de cocktails ou le bilan post-soirée par rapport au comportement v2 actuel.

## 13. Hors périmètre (explicitement exclu)

- Auto-inscription des utilisateurs — seul l'admin crée des comptes.
- VIP par soirée (granularité événement) — le VIP est désormais global au compte.
- Toute nouvelle fonctionnalité produit (au-delà de ce que la v1/v2 couvrent déjà) — cette spec est une migration technique, pas une extension fonctionnelle.
- Monorepo / npm workspaces — `api/` et `web/` restent deux projets Node indépendants.
- Révocation de session immédiate (blacklist JWT) — accepté comme limite du choix JWT stateless ; à réévaluer si le besoin de déconnexion à distance apparaît.
