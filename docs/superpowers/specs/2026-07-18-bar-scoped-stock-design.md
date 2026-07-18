# Stock (et dépendances) rattachés à un bar — design (phase 2)

Date: 2026-07-18

## Contexte

La phase 1 (`docs/superpowers/specs/2026-07-17-bars-and-access-design.md`) a
introduit le modèle `Bar`/`BarMembership` (propriétaire + membres invités,
VIP par bar) mais était volontairement additive : `/stock`, `/cocktails` et
`/soirees` restaient globaux, partagés par tout le monde, gérés par le seul
rôle `ADMIN` plateforme.

Le but de cette phase est de rattacher les bouteilles, recettes, soirées
(et ce qui en dépend) à un bar précis, pour que chaque bar ait son propre
stock, ses propres recettes custom et ses propres soirées — gérés par son
propriétaire, visibles uniquement par ses membres.

Cette phase touche plusieurs modules interdépendants (`Bottle`, `Recipe`,
`Event`, `Contribution`, `StockAdjustment`, le calcul de faisabilité des
cocktails) et est traitée comme un tout, comme décidé lors du brainstorming :
les scinder créerait des états intermédiaires incohérents (par exemple des
recettes encore globales calculant leur faisabilité sur un stock déjà filtré
par bar).

## Décisions issues du brainstorming

- Rattachement en une fois de `Bottle`, `Recipe` et `Event` à un `Bar`
  (`Contribution`/`StockAdjustment` restent scopés indirectement via leur
  `Event`).
- Gestion du stock/des soirées d'un bar : réservée à son **propriétaire**
  (ou à un `ADMIN` plateforme), sur le même principe que la gestion des
  membres en phase 1 — remplace le contrôle `@Roles('ADMIN')` global
  actuel.
- Le contenu d'un bar (stock, recettes, soirées, y compris non-VIP) devient
  **privé aux membres de ce bar** : connexion et appartenance obligatoires
  pour consulter quoi que ce soit — fin de l'accès anonyme actuel
  (`OptionalJwtAuthGuard`) sur ces ressources.
- La visibilité VIP d'une ressource d'un bar dépend désormais du flag
  **VIP par bar** (`BarMembership.vip`) introduit en phase 1, et non plus
  du flag global `User.vip` — un `ADMIN` plateforme voit toujours tout,
  partout.
- Les données existantes (bouteilles, soirées, recettes custom déjà en
  base, actuellement globales) sont **rattachées au bar du compte ADMIN**
  le plus ancien, sans perte de données.
- `barId` est passé **explicitement en paramètre** par le frontend (query
  param en lecture, champ du body en écriture) plutôt que de restructurer
  les routes existantes en `/bars/:barId/...`.

## 1. Modèle de données (Prisma)

```prisma
model Bottle {
  // ... champs existants inchangés
  barId String
  bar   Bar    @relation(fields: [barId], references: [id], onDelete: Cascade)
}

model Event {
  // ... champs existants inchangés
  barId String
  bar   Bar    @relation(fields: [barId], references: [id], onDelete: Cascade)
}

model Recipe {
  // ... champs existants inchangés
  barId String
  bar   Bar    @relation(fields: [barId], references: [id], onDelete: Cascade)
}
```

`Bar` gagne les back-relations `bottles Bottle[]`, `events Event[]`,
`recipes Recipe[]` correspondantes.

`Contribution` et `StockAdjustment` ne gagnent **pas** de `barId` propre :
ils sont déjà rattachés à un `Event` via `eventId`, et le bar se déduit de
`event.barId` — ajouter un `barId` redondant sur ces deux modèles créerait
un risque d'incohérence (un `barId` qui ne correspond pas à celui de
l'`Event` référencé) sans bénéfice, puisqu'aucune requête ne les liste
jamais indépendamment de leur soirée.

### Migration en 3 étapes (expand → backfill → contract)

Comme des lignes existent déjà en base sans bar, `barId` ne peut pas être
`NOT NULL` dès la première migration :

1. **Migration Prisma `add_bar_id_nullable`** : ajoute `barId String?` sur
   `Bottle`, `Event`, `Recipe` (nullable, pas encore de contrainte).
2. **Script ponctuel** `api/scripts/backfill-bar-data.ts` (exécuté une
   fois manuellement après déploiement, pas dans le pipeline de
   migration automatique) :
   - Trouve le compte `role: 'ADMIN'` le plus ancien (`orderBy: { createdAt: 'asc' }`).
     S'il n'en existe aucun, le script échoue explicitement (rien à
     backfiller sans admin — cas qui ne devrait pas arriver en pratique).
   - Cherche si cet admin possède déjà une `BarMembership` avec
     `role: 'OWNER'`. Si oui, réutilise ce bar. Sinon, crée un `Bar` nommé
     `"Le Bar de Noa"` avec une `BarMembership` `OWNER`/`vip: true` pour
     cet admin.
   - Met à jour en masse (`updateMany`) tous les `Bottle`/`Event`/`Recipe`
     où `barId IS NULL` vers l'id de ce bar.
   - Log un résumé (nombre de lignes mises à jour par table) à la fin.
3. **Migration Prisma `add_bar_id_required`** : repasse `barId` en
   `NOT NULL` sur les 3 modèles (échoue si le script de l'étape 2 n'a pas
   été exécuté — comportement voulu, pour ne pas passer une contrainte
   `NOT NULL` silencieusement sur des données encore incohérentes).

## 2. Permissions (`BarAccessService`)

Nouveau service partagé `api/src/bars/bar-access.service.ts`, exporté par
`BarsModule` :

```ts
interface BarAccess {
  canSeeVip: boolean;
  isOwnerOrAdmin: boolean;
}

assertMember(barId: string, user: JwtPayload): Promise<BarAccess>
```

- Si `user.role === 'ADMIN'` : retourne `{ canSeeVip: true, isOwnerOrAdmin: true }`
  sans lookup — un admin plateforme a accès à tout, partout, sans avoir
  besoin d'une ligne `BarMembership`.
- Sinon : cherche la `BarMembership` de `user.sub` sur `barId`. Absente →
  `ForbiddenException` ("Vous n'avez pas accès à ce bar"). Présente →
  `canSeeVip = membership.vip`, `isOwnerOrAdmin = membership.role === 'OWNER'`.

Ce service centralise une logique de permission identique utilisée par
6 modules (Bottles, Events, Recipes, Cocktails, Contributions,
StockAdjustments) ; la dupliquer dans chacun risquerait une divergence
silencieuse d'un module à l'autre sur une logique de sécurité.

### Application par module

| Module | Lecture | Écriture |
|---|---|---|
| Bottles | `assertMember(barId, user)` (barId en query param), `JwtAuthGuard` obligatoire (fin de l'accès anonyme) | `isOwnerOrAdmin` requis (au lieu de `@Roles('ADMIN')`) |
| Events | idem | idem |
| Recipes | `findVisible` filtre par `barId` + `canSeeVip` du bar | création : `barId` ajouté au DTO, `canSeeVip` du bar (au lieu du `canSeeVip(user)` global) ; modification/suppression : logique auteur-ou-admin existante inchangée |
| Cocktails | `GET /cocktails?barId=...`, `JwtAuthGuard` obligatoire, `assertMember` avant `evaluate` | — |
| Contributions | bar déduit de l'`Event` trouvé par `slug` ; `assertMember(event.barId, user)` avant de lister | création : tout membre du bar peut contribuer (inchangé, pas de restriction owner) ; suppression : inchangé (auteur uniquement) |
| StockAdjustments | idem (bar déduit de l'event) | `isOwnerOrAdmin` requis (au lieu de `@Roles('ADMIN')`) |

## 3. API — changements de routes

- `GET /bottles`, `GET /events`, `GET /cocktails` : gagnent un paramètre
  `barId` obligatoire en query string.
- `POST /bottles`, `POST /events` : gagnent un champ `barId` obligatoire
  dans le DTO.
- `GET /bottles/:id`, `GET /events/:slug` (lookup par identifiant unique) :
  **pas** de paramètre `barId` — le bar se déduit de la ressource trouvée
  (`assertMember(bottle.barId, user)` / `assertMember(event.barId, user)`
  après le `findOne`/`findBySlug`), même principe que les routes
  imbriquées sous `/events/:slug/...` ci-dessous. Un `barId` séparé serait
  redondant et risquerait de désynchroniser du `barId` réel de la
  ressource.
- `POST /recipes` : le DTO gagne un champ `barId` obligatoire.
- `GET/POST /events/:slug/contributions`, `GET/POST /events/:slug/stock-adjustments` :
  signature de route inchangée, mais gagnent en interne la vérification
  `assertMember(event.barId, user)`.
- Toutes ces routes passent de `OptionalJwtAuthGuard`/pas de guard à
  `JwtAuthGuard` obligatoire.

## 4. Frontend

- `src/lib/api-client.ts` : chaque fonction concernée
  (`listBottles`, `addBottle`, `listEvents`, `createEvent`,
  `evaluateCocktails`, `createRecipe`, etc.) gagne un paramètre `barId`.
- Chaque page qui consomme ces fonctions (`/`, `/stock`, `/cocktails`,
  `/soirees`, `/soirees/[slug]`) résout le bar actif via
  `resolveActiveBar` (déjà en place depuis la phase 1) et redirige vers
  `/creer` si l'utilisateur n'a accès à aucun bar — même pattern que
  `src/app/membres/page.tsx`.
- Les actions serveur correspondantes (`src/app/actions.ts`) gagnent un
  paramètre `barId`, transmis depuis la page appelante.

## 5. Tests

- Tests unitaires du nouveau `BarAccessService` (bypass admin, membre
  VIP/non-VIP, non-membre rejeté).
- Mise à jour des tests existants de `BottlesService`, `EventsService`,
  `RecipesService`, `CocktailsService`, `ContributionsService`,
  `StockAdjustmentsService` pour couvrir le filtrage par `barId`.
- Test du script de backfill (`api/scripts/backfill-bar-data.ts`) contre
  une base de données de test avec des données existantes non rattachées.
- Vérification manuelle : deux bars distincts avec des stocks différents,
  confirmation qu'un membre du bar A ne voit pas le stock du bar B, qu'un
  propriétaire peut gérer son propre stock mais pas celui d'un autre bar.

## Hors scope

- Transfert de propriété ou suppression d'un bar (déjà hors scope en
  phase 1).
- Partage d'une bouteille/recette/soirée entre plusieurs bars.
- Fusion de deux bars.
- Notification ou confirmation particulière lors du changement de bar
  actif (le sélecteur de la phase 1 suffit).
- Suppression du flag global `User.vip` en base (devient inutilisé pour
  le stock/les recettes, mais sa suppression du schéma n'est pas traitée
  ici).
