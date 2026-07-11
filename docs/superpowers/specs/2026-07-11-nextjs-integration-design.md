# Spec — Intégration Next.js + déploiement Docker (Plan 2)

Date : 2026-07-11
Statut : approuvé (prêt pour plan d'implémentation)
Réfère à : `docs/superpowers/specs/2026-07-10-nestjs-postgres-backend-design.md` (Plan 1, API NestJS + Postgres, déjà implémentée et poussée sur `main`)

## 1. Contexte

Le Plan 1 a livré une API NestJS + Postgres complète (auth JWT, comptes utilisateurs, stock, cocktails, soirées, contributions, bilan) sans toucher au Next.js existant. Cette spec couvre la seconde moitié de la migration : brancher le Next.js sur cette API (au lieu de `data/store.json`), remplacer les mécanismes d'identification ad hoc (mot de passe admin unique, vault VIP par mot de passe, prénom en `localStorage`) par le nouveau système de comptes, et livrer un déploiement Docker complet pour le serveur maison de l'utilisateur.

**Découverte importante en amont de cette spec** : le Plan 1 avait été conçu à partir du `CAHIER_DES_CHARGES.md` (v1), qui décrivait `/stock`, `/soirees` et `/cocktails` comme réservées à l'admin. Mais l'app réelle a évolué depuis (commits `0f03fe1`, `cf4834a`) : ces pages sont aujourd'hui **publiques en lecture** ; seules les mutations (créer/modifier/supprimer une bouteille ou une soirée, faire le bilan) et la page `/soirees/[slug]/bilan` exigent une authentification admin. Le stock VIP est aujourd'hui caché derrière un mot de passe "vault" déclenché en tapant `v-i-p`, une protection côté client uniquement (les données VIP sont déjà envoyées au navigateur). Cette spec aligne le nouveau système de comptes sur ce comportement réel, décision actée avec l'utilisateur :
- Le modèle "tout est lisible, seules les actions sont protégées" est conservé tel quel.
- Le vault VIP par mot de passe est supprimé, remplacé par l'attribut `vip` du compte connecté.

## 2. Révision de l'API NestJS (préalable à l'intégration)

Le Plan 1 a construit `BottlesController`, `EventsController` et `CocktailsController` avec un contrôle d'accès uniforme au niveau du contrôleur entier. Pour respecter le modèle "lecture publique, écriture protégée", ces trois contrôleurs doivent séparer leurs routes de lecture et d'écriture.

### 2.1 `OptionalJwtAuthGuard` (nouveau)

Un guard qui ne rejette jamais la requête : s'il y a un cookie `bardenoa_session` valide, il peuple `request.user` (même comportement que `JwtAuthGuard`) ; sinon, `request.user` reste `undefined` et la requête continue. Implémenté en étendant `AuthGuard('jwt')` avec `handleRequest()` surchargé pour ne jamais lancer d'exception sur `err`/`info` absence d'utilisateur.

### 2.2 `BottlesController`

- `GET /bottles` passe de `JwtAuthGuard + RolesGuard('ADMIN')` à `OptionalJwtAuthGuard` seul. `BottlesService.findAll()` reçoit un paramètre `includeVip: boolean` (déterminé par `request.user?.vip === true`) ; si `false`, les bouteilles `vip: true` sont exclues de la réponse (filtrage serveur, pas client — corrige au passage la fuite de données du vault actuel).
- `GET /bottles/:id`, `POST /bottles`, `PATCH /bottles/:id`, `DELETE /bottles/:id` restent `JwtAuthGuard + RolesGuard('ADMIN')` (gestion du stock reste une action admin).

### 2.3 `EventsController`

- `GET /events` et `GET /events/:slug` passent à `OptionalJwtAuthGuard` (aucune donnée sensible dans `Event` — nom, date, slug).
- `POST /events`, `DELETE /events/:slug` restent `JwtAuthGuard + RolesGuard('ADMIN')`.

### 2.4 `CocktailsController`

- `GET /cocktails` passe à `OptionalJwtAuthGuard`. `CocktailsService.evaluate()` reçoit le même paramètre `includeVip` ; si `false`, les bouteilles `vip: true` sont exclues du tableau passé à `evaluateRecipes()` avant le calcul (même principe que pour `BottlesController`, pas un post-traitement sur le résultat). Une recette qui ne serait réalisable qu'avec une bouteille VIP redevient donc naturellement "non réalisable, il manque tel ingrédient" pour un appelant non-VIP — `missingTags` reste cohérent avec `makeable`, pas de champ forcé artificiellement.

### 2.5 `ContributionsController`

Inchangé — reste `JwtAuthGuard` strict (contribuer à une soirée exige toujours un compte, décision actée au Plan 1).

### 2.6 `UsersController` / `UsersService` — réinitialisation de mot de passe

- `UpdateUserDto` gagne un champ optionnel `password?: string` (`@IsOptional() @MinLength(6)`).
- `UsersService.update()` : si `password` est fourni, le hash via bcrypt avant l'écriture Prisma, en plus des champs `role`/`vip` déjà gérés.

## 3. Intégration Next.js

### 3.1 Nouveau client API

`src/lib/api-client.ts` : wrapper `fetch` typé vers `process.env.NEST_API_URL`, transmettant le cookie `bardenoa_session` reçu par le Server Component/Action courant (via `cookies()` de Next.js) à chaque requête vers l'API. Expose des fonctions nommées équivalentes à celles de l'actuel `src/lib/db.ts` (`listBottles`, `addBottle`, `createEvent`, `applyStockAdjustments`, etc.) pour minimiser le diff dans les pages/actions qui les consomment, plus les nouvelles (`login`, `logout`, `listUsers`, `createUser`, `updateUser`, `deleteUser`).

### 3.2 Fichiers supprimés

- `src/lib/db.ts` — remplacé intégralement par `api-client.ts`.
- `src/lib/cocktails.ts` et `src/lib/cocktails.test.ts` — la logique de faisabilité vit désormais uniquement côté `api/` (Task 7 du Plan 1) ; le Next.js consomme le résultat déjà calculé via `GET /cocktails`.
- `src/lib/auth.ts` — hash maison et lecture de `ADMIN_PASSWORD` supprimés.
- `.env.local` : `ADMIN_PASSWORD` et `VIP_PASSWORD` supprimés, remplacés par `NEST_API_URL` et `JWT_SECRET` (ce dernier partagé avec `api/`, nécessaire pour que `src/proxy.ts` valide le cookie côté Next.js sans appel réseau).

### 3.3 Authentification

- `src/app/login/page.tsx` : le formulaire passe d'un champ "mot de passe" à deux champs (username + mot de passe).
- `src/app/login/actions.ts` : `login()` appelle `POST /auth/login` via `api-client`, relaie le `Set-Cookie` de la réponse au navigateur (Next.js Server Actions peuvent définir des cookies directement sur `cookies()`). `logout()` appelle `POST /auth/logout` puis supprime le cookie local.
- `src/proxy.ts` : la vérification par hash de mot de passe est remplacée par un décodage/validation du JWT (même secret que l'API) pour peupler une notion de rôle/vip disponible aux Server Components sans appel réseau. Continue de protéger uniquement `/soirees/[slug]/bilan` (comportement inchangé — la protection des autres mutations reste au niveau des Server Actions, comme aujourd'hui).
- `src/app/actions.ts` : `requireAdmin()` lit le rôle depuis le JWT décodé (au lieu de comparer un hash) ; chaque action mute via `api-client`. `verifyVipPassword` est supprimé.

### 3.4 Stock et réserve VIP

- `src/app/stock/page.tsx` : appelle `api-client.listBottles()` qui relaie le cookie de session — un visiteur non connecté reçoit uniquement les bouteilles non-VIP (filtrées côté API désormais, section 2.2), un utilisateur connecté VIP reçoit tout.
- `src/app/stock/VipSecretSection.tsx` : le mot de passe et la séquence clavier `v-i-p` sont retirés. Si l'API n'a pas retourné de bouteilles VIP (visiteur non-VIP), la section ne s'affiche simplement pas. Si elle en a retourné (utilisateur VIP connecté), elle s'affiche directement, sans étape de déverrouillage supplémentaire.

### 3.5 Page invité d'une soirée

- `src/app/soirees/[slug]/page.tsx` : appelle `api-client` pour l'event, les bouteilles, les cocktails (avec le cookie de session courant, donc filtré VIP comme partout ailleurs) et les contributions.
- `src/app/soirees/[slug]/GuestPanel.tsx` : le bloc `localStorage` + prénom est remplacé par un composant "connecte-toi pour participer" (réutilise le même formulaire que `/login`) si l'utilisateur n'est pas authentifié. Une fois connecté :
  - `isVip` vient de `user.vip` (JWT décodé), plus de comparaison à une liste `vipNames` par soirée.
  - Le formulaire de contribution ne contient plus de champ `guestName` — `api-client.addContribution(slug, { item, quantity })` transmet le cookie, l'API déduit l'auteur.
  - Le bouton "Retirer" une contribution compare `contribution.user.id` à l'id de l'utilisateur connecté (extrait du JWT) au lieu de comparer les prénoms.

### 3.6 Nouvelle page admin : gestion des comptes

`src/app/comptes/` (nouvelle route, protégée comme `/stock`/`/soirees` — les mutations passent par `requireAdmin()`) :
- Liste des comptes (`GET /users`) : username, rôle, VIP, date de création.
- Formulaire de création : username, mot de passe (généré ou saisi), case à cocher VIP, sélecteur de rôle.
- Par compte : bouton bascule rôle, bouton bascule VIP, bouton "réinitialiser le mot de passe" (la Server Action génère un mot de passe temporaire côté serveur, l'envoie via `PATCH /users/:id`, le renvoie une fois à l'écran pour transmission de vive voix — jamais stocké ni loggé), bouton supprimer (affiche le message d'erreur retourné par l'API si `409 Conflict` — compte encore référencé par des contributions).

## 4. Déploiement Docker (serveur maison)

Le `docker-compose.yml` actuel (issu du Plan 1, `postgres` seul pour le dev local) est étendu à 3 services pour la production :

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: bardenoa
      POSTGRES_PASSWORD: bardenoa
      POSTGRES_DB: bardenoa
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # pas de "ports:" — accessible uniquement depuis le réseau Docker interne

  api:
    build: ./api
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://bardenoa:bardenoa@postgres:5432/bardenoa
      JWT_SECRET: ${JWT_SECRET}
      WEB_ORIGIN: http://web:3000
    # pas de "ports:" — seul "web" lui parle, via le réseau Docker interne

  web:
    build: .
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NEST_API_URL: http://api:3001
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8080:3000"

volumes:
  postgres_data:
```

- Seul le port **8080** (choisi pour éviter le conflit avec l'autre projet fullstack déjà déployé sur le serveur) est exposé à l'extérieur. `api` et `postgres` restent strictement internes au réseau Docker (`bardenoa_default`), aucune surface de conflit de port supplémentaire.
- `api/Dockerfile` (nouveau) : image Node, `npm ci`, `npx prisma generate`, `npm run build`, au démarrage du conteneur exécute `npx prisma migrate deploy` puis lance `node dist/main.js`.
- `Dockerfile` (nouveau, racine, pour le Next.js) : image Node, `npm ci`, `npm run build`, `npm run start`.
- `.env` à la racine (non commité, `.env.example` fourni) : `JWT_SECRET` uniquement — le seul secret partagé entre les deux services applicatifs.
- La migration des données existantes (`npm run migrate:json` côté `api/`) reste une étape manuelle exécutée une fois, après le premier démarrage du conteneur `api`, avant d'ouvrir le site aux proches.

## 5. Hors périmètre (explicitement exclu)

- Auto-inscription des utilisateurs — inchangé depuis le Plan 1, l'admin crée toujours les comptes.
- Reverse proxy / TLS (nginx, Caddy, Let's Encrypt) devant le port 8080 — laissé à la charge de l'utilisateur sur son serveur, hors périmètre de cette spec.
- Désactivation de compte (`disabled: boolean`) comme alternative à la suppression bloquée par contrainte de clé étrangère — le comportement actuel (l'API retourne une erreur 409 claire, l'admin garde le compte) est jugé suffisant pour ce lot ; à réévaluer si le besoin se manifeste.
- Tout changement fonctionnel non lié à la migration (nouvelles fonctionnalités produit) — comme pour le Plan 1, cette spec est un travail d'intégration technique, pas une extension de périmètre.

## 6. Critères d'acceptation

- `docker compose up` (avec un `.env` contenant `JWT_SECRET`) démarre les 3 services ; le site est accessible sur `http://<serveur>:8080`.
- Un visiteur non connecté voit le dashboard, `/cocktails`, `/stock` (bouteilles non-VIP), `/soirees` (liste) et le contenu non-VIP d'une page `/soirees/[slug]` sans être authentifié.
- Un compte avec `vip: true` connecté voit en plus la réserve VIP sur `/stock`, les cocktails VIP sur `/cocktails` et sur toute page `/soirees/[slug]`, sans configuration par soirée.
- Un compte `vip: false` ne voit ni la réserve VIP ni les cocktails qui en dépendent, sur aucune page.
- Créer/modifier/supprimer une bouteille, créer/supprimer une soirée, faire le bilan post-soirée exigent toujours une session ADMIN valide (redirection vers `/login` sinon), comme aujourd'hui.
- Contribuer à une soirée exige désormais une session valide (n'importe quel rôle) ; la contribution est attribuée au compte connecté, pas à un nom saisi librement.
- L'admin peut créer un compte, en changer le rôle/VIP, réinitialiser son mot de passe, et le supprimer (avec message clair si bloqué par des contributions existantes) depuis `/comptes`.
- `npm run build` (Next.js) et `npm test` (api/, Jest) passent sans erreur.
- Aucune référence restante à `ADMIN_PASSWORD`, `VIP_PASSWORD`, `data/store.json` ou `src/lib/db.ts` dans le code Next.js.
