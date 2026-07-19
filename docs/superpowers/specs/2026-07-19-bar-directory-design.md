# Annuaire public des bars & demandes pour rejoindre — design

Date: 2026-07-19

## Contexte

Depuis les phases 1 et 2, l'application est multi-tenant : chacun peut créer
son bar et inviter des membres par pseudo. Mais il n'existe aucun moyen de
*découvrir* les bars des autres — rejoindre un bar suppose déjà connaître
le pseudo de son propriétaire, qui doit vous inviter explicitement. Ce
projet ajoute un annuaire public des bars existants, une demande pour
rejoindre un bar (avec acceptation/refus du propriétaire), et une nouvelle
page d'accueil qui remplace l'actuelle : elle montre ton bar actif, la
prochaine soirée tous bars confondus, et cet annuaire.

C'est la deuxième étape (sur deux) de la demande initiale — la première
étape (rebrand vers "OpenBar" + connexion plus intuitive) est déjà livrée.

## Décisions issues du brainstorming

- L'annuaire liste **tous** les bars de la plateforme (nom, propriétaire,
  nombre de membres) — jamais le contenu privé (stock, recettes, soirées)
  d'un bar dont on n'est pas membre.
- "Public" signifie accessible à **tout compte connecté**, pas un accès
  anonyme — cohérent avec le reste de l'app, qui exige déjà une session
  partout (y compris l'actuelle page d'accueil).
- Rejoindre un bar se fait désormais par **demande** (en plus de
  l'invitation directe par pseudo, qui reste possible) : le visiteur
  clique "Demander à rejoindre", le propriétaire accepte ou refuse depuis
  `/membres`.
- Une demande refusée peut être **renvoyée** plus tard (elle repasse à
  l'état "en attente" plutôt que de créer une nouvelle ligne).
- Pas de notification (email, push) — le propriétaire découvre les
  demandes en attente en visitant `/membres`.
- La nouvelle page d'accueil **remplace** l'actuelle (déjà décidé lors du
  brainstorming initial, avant la scission en deux étapes).

## 1. Modèle de données (Prisma)

```prisma
enum JoinRequestStatus {
  PENDING
  ACCEPTED
  DECLINED
}

model BarJoinRequest {
  id        String            @id @default(cuid())
  barId     String
  bar       Bar               @relation(fields: [barId], references: [id], onDelete: Cascade)
  userId    String
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  status    JoinRequestStatus @default(PENDING)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@unique([barId, userId])
}
```

`Bar` gagne `joinRequests BarJoinRequest[]`, `User` gagne
`barJoinRequests BarJoinRequest[]`.

La contrainte `@@unique([barId, userId])` empêche les doublons : une
demande refusée n'est pas re-créée, elle est **mise à jour** (`status:
PENDING`, `updatedAt` rafraîchi) si l'utilisateur redemande.

## 2. API (NestJS)

Nouvelles méthodes sur `BarsService`/`BarsController` (`api/src/bars/`,
suit le pattern existant) :

- **`findDirectory(userId)`** — `GET /bars/directory`. Retourne tous les
  bars : `{ id, name, ownerUsername, memberCount, myStatus }`, où
  `myStatus` vaut `'OWNER' | 'MEMBER' | 'PENDING' | 'NONE'` selon la
  situation de l'appelant vis-à-vis de **ce** bar (déduit de sa
  `BarMembership` si elle existe, sinon de sa `BarJoinRequest` `PENDING`
  si elle existe, sinon `'NONE'`). `ownerUsername` vient de la
  `BarMembership` `role: OWNER` de ce bar ; `memberCount` est un
  `_count` Prisma sur les `memberships`.
- **`createJoinRequest(barId, userId)`** — `POST /bars/:id/join-requests`.
  Rejette (`ConflictException`) si l'appelant est déjà membre
  (`getMembership` existant) ou a déjà une demande `PENDING`. Sinon, si
  une ligne existe déjà pour ce `[barId, userId]` (`DECLINED`, ou
  `ACCEPTED` mais la personne n'est plus membre aujourd'hui — après un
  départ ou un retrait), elle est **remise à `PENDING`** (update, pas de
  nouvelle ligne, respecte la contrainte `@@unique`). Sinon crée une
  nouvelle ligne `PENDING`.
- **`findPendingRequests(barId, requesterId)`** — `GET
  /bars/:id/join-requests`. Réservé au propriétaire (`assertOwner`
  existant). Retourne les demandes `PENDING` avec le pseudo du demandeur.
- **`respondToJoinRequest(barId, requesterId, requestId, accept:
  boolean)`** — `PATCH /bars/:id/join-requests/:requestId`. Réservé au
  propriétaire. Si `accept` : crée la `BarMembership` (`role: MEMBER`,
  `vip: false`) et passe la demande à `ACCEPTED`. Si refus : passe la
  demande à `DECLINED`. Rejette (`NotFoundException`) si la demande
  n'existe pas ou n'appartient pas à ce bar, ou si elle n'est plus
  `PENDING`.

Toutes ces routes sont derrière `JwtAuthGuard` uniquement (tout compte
connecté peut consulter l'annuaire et faire une demande ; seul le
propriétaire peut lister/traiter les demandes de **son** bar).

## 3. Frontend

### Page d'accueil (`src/app/page.tsx`) — remplace l'actuelle

Trois sections :

1. **Ton bar actif** : reprend le contenu KPI existant (bouteilles,
   volume, cocktails prêts, propriétaire/membre) pour le bar actif
   résolu via `resolveActiveBar` (déjà en place). Si aucun bar, invite à
   en créer un (comme aujourd'hui).
2. **Prochaine soirée (tous bars confondus)** : pour chaque bar retourné
   par `listMyBars()`, appelle `listEvents(bar.id)` (endpoint existant,
   aucun nouveau code API), fusionne toutes les soirées, filtre celles à
   venir, trie par date, affiche la plus proche avec le nom du bar
   concerné.
3. **Annuaire des bars** : `listBarsDirectory()` (nouvelle fonction
   `api-client.ts`), affiche chaque bar avec son statut (`myStatus`) :
   badge "Propriétaire"/"Membre" si déjà dedans, "Demande envoyée" si
   `PENDING` (bouton désactivé), sinon bouton "Demander à rejoindre".

### `/membres` (`src/app/membres/page.tsx`)

Nouvelle section "Demandes en attente" au-dessus de la liste des membres
existante, visible uniquement par le propriétaire (page déjà réservée à
`myRole === "OWNER"`) : liste les demandes `PENDING` avec boutons
Accepter/Refuser.

## 4. Tests

- `api/src/bars/bars.service.spec.ts` : nouveaux cas pour
  `findDirectory` (statut correct selon membership/demande),
  `createJoinRequest` (rejet si déjà membre, rejet si déjà `PENDING`,
  réactivation d'une demande `DECLINED`), `findPendingRequests` (rejet
  pour un non-propriétaire), `respondToJoinRequest` (acceptation crée la
  membership, refus ne la crée pas, rejet si la demande n'est plus
  `PENDING`).
- Vérification manuelle : un compte crée une demande vers le bar d'un
  autre, le propriétaire la voit sur `/membres`, l'accepte, le demandeur
  devient membre et voit le bar dans son sélecteur ; un refus laisse le
  demandeur pouvoir redemander plus tard.

## Hors scope

- Notifications (email, push, badge de notification dans l'en-tête).
- Recherche/filtrage de l'annuaire au-delà d'une liste simple.
- Demander à rejoindre plusieurs bars en même temps depuis un autre point
  d'entrée que l'annuaire.
- Annulation d'une demande `PENDING` par le demandeur lui-même (il peut
  seulement attendre ou, une fois refusée, redemander).
