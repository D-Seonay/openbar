# Auto-assignation sur la liste "à ramener" — design

Date: 2026-08-02

## Contexte

La liste "à ramener" (`WishlistItem`, livrée via la PR #35) est aujourd'hui
purement informative : l'hôte ajoute des items, tout le monde les voit,
personne ne peut indiquer "je m'en occupe". On ajoute la possibilité pour
un invité de s'auto-assigner à un item.

## Décisions issues du brainstorming

- **Plusieurs invités peuvent s'assigner au même item** (pas d'exclusivité)
  — si l'hôte veut plusieurs paquets de glaçons, rien n'empêche deux
  personnes de s'assigner en parallèle.
- **Un invité peut se retirer lui-même** d'un item qu'il a pris. Pas de
  retrait par l'hôte pour l'instant — non demandé, gardé simple (l'hôte
  garde son droit existant de supprimer l'item entier, ce qui retire aussi
  toutes ses assignations via `onDelete: Cascade`).
- L'assignation est ouverte à **tout membre connecté du bar** (pas réservée
  à l'hôte, contrairement à l'ajout/suppression d'items eux-mêmes) — c'est
  une action invité, symétrique au système de contributions existant.

## Modèle de données

Nouvelle table de jonction, sur le même schéma relationnel que
`Contribution` (chaque ligne = une assignation d'un utilisateur à un item) :

```prisma
model WishlistItemAssignment {
  id             String       @id @default(cuid())
  wishlistItemId String
  wishlistItem   WishlistItem @relation(fields: [wishlistItemId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  createdAt      DateTime     @default(now())

  @@unique([wishlistItemId, userId])
}
```

`@@unique([wishlistItemId, userId])` empêche un même utilisateur de
s'assigner deux fois au même item (idempotence naturelle, pas besoin de
logique applicative supplémentaire pour ce cas).

`WishlistItem` gagne `assignments WishlistItemAssignment[]`. `User` gagne
`wishlistAssignments WishlistItemAssignment[]` (même pattern que
`contributions Contribution[]` déjà présent sur `User`).

## API

Étend `api/src/wishlist/` (pas de nouveau module) :

- **`GET /events/:slug/wishlist`** — modifié pour inclure les assignations :
  `include: { assignments: { include: { user: { select: { id: true,
  username: true } } } } }`, orderBy interne des assignations par
  `createdAt: 'asc'`.
- **`POST /events/:slug/wishlist/:id/assign`** — `JwtAuthGuard` uniquement
  (pas de vérification `isOwnerOrAdmin` — n'importe quel membre du bar peut
  s'assigner). Vérifie que l'item appartient bien à l'événement résolu par
  `slug` (même garde que `remove` existant). Idempotent : si l'assignation
  existe déjà pour cet utilisateur, la retourne sans erreur au lieu de
  planter sur la contrainte unique.
- **`DELETE /events/:slug/wishlist/:id/assign`** — `JwtAuthGuard`. Retire
  **la propre assignation de l'appelant** (`userId` de la session), même
  pattern que `ContributionsService.remove` (vérifie
  `assignment.userId === user.sub`, sinon `NotFoundException` — pas
  `ForbiddenException`, pour ne pas révéler l'existence d'une assignation
  d'un tiers).

`WishlistService` gagne `assign(slug, itemId, userId)` et
`unassign(slug, itemId, userId)`.

## Frontend

- **`src/lib/types.ts`** : `WishlistItem` gagne
  `assignments: { id: string; user: { id: string; username: string } }[]`.
- **`src/lib/api-client.ts`** : `assignWishlistItem(slug, itemId)`,
  `unassignWishlistItem(slug, itemId)`.
- **`src/app/actions.ts`** : `assignWishlistItemAction(slug, itemId)`,
  `unassignWishlistItemAction(slug, itemId)` — même forme que les actions
  wishlist existantes (appel API, `revalidatePath`).
- **`WishlistSection.tsx`** : gagne une prop `currentUserId: string` (passée
  depuis `page.tsx`, `session.sub`). Sous le libellé de chaque item :
  - Liste des assignés (usernames), ou rien si personne.
  - Si `currentUserId` est déjà dans `item.assignments` : bouton
    "Je ne peux plus" → `unassignWishlistItemAction`.
  - Sinon : bouton "Je m'en occupe" → `assignWishlistItemAction`.
  - Ce bouton est visible pour **tout le monde** (pas seulement
    `canManage`) — c'est une action invité, indépendante du droit de
    gérer la liste elle-même.
- **`page.tsx`** : passe `currentUserId={session.sub}` à `WishlistSection`.

## Tests

- `api/src/wishlist/wishlist.service.spec.ts` : ajoute des cas pour
  `assign` (idempotent si déjà assigné) et `unassign` (rejette si
  l'appelant n'est pas l'auteur de l'assignation, ou si l'assignation
  n'existe pas).
- Vérification manuelle : un invité s'assigne à un item, voit son nom
  apparaître, se retire ; un deuxième invité s'assigne au même item sans
  bloquer le premier ; un invité ne peut pas retirer l'assignation d'un
  autre (testé via appel API direct, l'UI ne montre de toute façon le
  bouton "Je ne peux plus" que pour sa propre assignation).

## Hors scope

- Retrait d'une assignation par l'hôte (seul l'invité assigné peut se
  retirer lui-même).
- Limite du nombre de personnes assignables par item.
- Notifications quand quelqu'un s'assigne/se retire.
