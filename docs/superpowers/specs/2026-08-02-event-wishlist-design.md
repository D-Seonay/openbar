# Liste "à ramener" gérée par l'hôte de la soirée — design

Date: 2026-08-02

## Contexte

Aujourd'hui, `/soirees/[slug]` affiche 4 "promesses rapides" figées dans le
code de `GuestPanel.tsx` (Citrons Verts, Tonic & Soda, Glaçons, Menthe
Fraîche) — n'importe quel invité peut les ajouter en 1 clic à ses
contributions. L'hôte (propriétaire du bar, ou admin) n'a aucun moyen de
faire savoir aux invités ce dont il a spécifiquement besoin pour *cette*
soirée précise.

## Décisions issues du brainstorming

- La liste de l'hôte est **séparée** du système de contributions existant
  — purement informative, affichée à côté du bloc "Qui ramène quoi", sans
  lien avec les promesses rapides ni les contributions. Les 4 promesses
  rapides figées restent inchangées.
- L'hôte gère la liste **depuis la page de la soirée**, à tout moment
  (avant ou pendant), pas seulement à la création.
- Un item de liste est un simple libellé texte (`label`), sans champ
  quantité séparé — l'hôte peut inclure une quantité dans le texte lui-même
  ("2 sacs de glaçons") s'il le souhaite. Pas de champ structuré
  supplémentaire : YAGNI, cohérent avec la simplicité voulue pour une
  liste "purement informative".

## Modèle de données

Nouveau modèle Prisma, sur le même schéma relationnel que `Contribution`
(pas un champ JSON/array sur `Event` — moins flexible pour ajouter/retirer
des entrées individuellement) :

```prisma
model WishlistItem {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  label     String
  createdAt DateTime @default(now())
}
```

`Event` gagne `wishlistItems WishlistItem[]`.

Migration SQL (`api/prisma/migrations/<timestamp>_add_wishlist_item/migration.sql`),
au même format que les migrations existantes du repo (écrite à la main, pas
générée via `prisma migrate dev` — pas de Postgres local disponible dans cet
environnement) :

```sql
-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## API

Nouveau module `api/src/wishlist/`, architecture identique à
`api/src/contributions/` (module séparé, pas une méthode sur
`EventsController`) :

- **`GET /events/:slug/wishlist`** — `OptionalJwtAuthGuard`, même garde
  souple que la lecture des contributions (pas de vérification stricte
  d'appartenance au bar à ce niveau, cohérent avec l'existant).
- **`POST /events/:slug/wishlist`** — `JwtAuthGuard` + vérification
  `isOwnerOrAdmin` via `BarAccessService.assertMember(event.barId, user)`
  (même pattern que `EventsController.create`/`remove`). Body :
  `{ label: string }` (`CreateWishlistItemDto`, `@IsString() @MinLength(1)`).
  Rejette avec `ForbiddenException` si l'appelant n'est ni propriétaire du
  bar ni admin.
- **`DELETE /events/:slug/wishlist/:id`** — même vérification
  `isOwnerOrAdmin`. Vérifie que l'item appartient bien à l'événement
  résolu par `slug` avant suppression (comme `ContributionsService.remove`
  vérifie l'appartenance à l'utilisateur, ici on vérifie l'appartenance à
  l'événement).

`WishlistModule` importe `EventsModule` (pour `EventsService`, déjà
exporté) et `BarsModule` (pour `BarAccessService`, déjà exporté). Enregistré
dans `AppModule`.

## Frontend

- **`src/lib/types.ts`** : nouvelle interface
  `WishlistItem { id: string; eventId: string; label: string; createdAt: string }`.
- **`src/lib/api-client.ts`** : `listWishlistItems(slug)`,
  `addWishlistItem(slug, label)`, `deleteWishlistItem(slug, id)` — même
  forme que `listContributions`/`addContribution`/`deleteContribution`.
- **`src/app/actions.ts`** : `addWishlistItemAction(slug, formData)` et
  `deleteWishlistItemAction(slug, id)` — même forme que
  `addContribution`/`deleteContributionAction` (appel API,
  `revalidatePath(/soirees/${slug})`).
- **Nouveau composant `src/app/soirees/[slug]/WishlistSection.tsx`** :
  - Prop `canManage: boolean` (calculée dans `page.tsx` comme
    `activeBar?.myRole === "OWNER" || session.role === "ADMIN"` — l'
    application réelle de la règle reste côté API, ce booléen ne sert qu'à
    l'affichage).
  - Si `canManage` : formulaire d'ajout (`label` texte libre) + bouton
    supprimer sur chaque item.
  - Sinon : liste en lecture seule (juste les libellés).
  - Style visuel cohérent avec le reste de la page (mêmes classes
    `rounded-2xl border border-white/[0.08] bg-ink-2/80` que les sections
    voisines de `GuestPanel.tsx`).
- **`src/app/soirees/[slug]/page.tsx`** : appelle `listWishlistItems(slug)`
  en parallèle des autres fetches existants (`Promise.all`), calcule
  `canManage`, rend `<WishlistSection slug={slug} items={wishlistItems}
  canManage={canManage} />` à côté de `<GuestPanel />` (pas dans
  `GuestPanel.tsx` lui-même, puisque c'est une section indépendante).

## Tests

- `api/src/wishlist/wishlist.service.spec.ts` : mock Prisma comme
  `events.service.spec.ts` — vérifie que `create`/`findForEvent` résolvent
  bien le `slug` en `eventId` avant d'agir sur `WishlistItem`, et que
  `remove` rejette (`NotFoundException`) si l'item n'appartient pas à
  l'événement résolu.
- Vérification manuelle : l'hôte ajoute un item depuis `/soirees/[slug]`,
  le voit apparaître, le supprime ; un membre non-propriétaire du bar voit
  la liste en lecture seule (pas de formulaire, pas de bouton supprimer) ;
  un `POST`/`DELETE` direct par un non-propriétaire (ex: via curl) est
  rejeté avec 403 côté API, indépendamment de l'affichage frontend.

## Hors scope

- Lien entre la liste "à ramener" et le système de contributions
  (décidé : listes séparées).
- Champ quantité structuré sur `WishlistItem` (le libellé texte libre
  suffit).
- Notifications aux invités quand un item est ajouté/retiré.
- Édition d'un item existant (seulement ajout/suppression — modifier un
  libellé revient à le supprimer et en recréer un).
