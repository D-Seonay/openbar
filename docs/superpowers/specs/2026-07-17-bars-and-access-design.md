# Bars & accès — design (phase 1)

Date: 2026-07-17

## Contexte

L'application est aujourd'hui mono-tenant : un seul stock de bouteilles, une
seule liste de recettes, une seule liste de soirées, partagés par tout le
monde. Les seuls niveaux d'accès sont un rôle global `ADMIN`/`USER` et un
flag `vip` global sur `User`. Les comptes sont créés manuellement par un
admin (pas d'auto-inscription).

Le but de ce projet est de permettre à plusieurs personnes d'avoir chacune
leur propre bar, et de choisir qui y a accès. Vu l'ampleur du changement
(quasiment toutes les ressources existantes devraient à terme être
rattachées à un bar), le projet est découpé en deux specs séparées :

1. **Cette spec (phase 1)** : le modèle `Bar`/`BarMembership`, l'auto-
   inscription, la création de bar, l'invitation/révocation de membres, et
   le sélecteur de bar actif. Cette phase est **additive** : elle n'affecte
   pas encore le comportement de `/stock`, `/cocktails`, `/soirees`, qui
   restent globaux exactement comme aujourd'hui.
2. **Phase 2 (spec séparée, plus tard)** : rattacher `Bottle`, `Recipe`,
   `Event`, `Contribution`, `StockAdjustment` à un `Bar`, et filtrer toutes
   les routes/pages par bar actif.

## Décisions issues du brainstorming

- Auto-inscription publique ajoutée (aujourd'hui réservée à un admin).
- Le rôle global `ADMIN`/`USER` est conservé comme rôle **plateforme**
  (gestion de tous les comptes via `/comptes`), indépendant des rôles par
  bar.
- Un bar a un **propriétaire** (`OWNER`) et des **membres** invités
  (`MEMBER`). Un membre peut être marqué VIP **pour ce bar précis**
  (remplace, à terme en phase 2, le flag `vip` global pour ce qui concerne
  le contenu d'un bar).
- Invitation par **username existant** (pas de lien d'invitation, pas
  d'email dans le système) ; accès accordé immédiatement.
- Un utilisateur ne peut posséder **qu'un seul bar** (en tant que `OWNER`),
  mais peut être **membre** de plusieurs bars appartenant à d'autres
  personnes.
- Le bar actif est choisi via un **sélecteur en session** (pas de bar dans
  l'URL), indépendant du JWT d'authentification.
- Le bar n'est **pas** créé automatiquement à l'inscription : l'utilisateur
  passe par un écran dédié pour lui donner un nom.

## 1. Modèle de données (Prisma)

```prisma
enum BarRole {
  OWNER
  MEMBER
}

model Bar {
  id          String          @id @default(cuid())
  name        String
  createdAt   DateTime        @default(now())
  memberships BarMembership[]
}

model BarMembership {
  id        String   @id @default(cuid())
  barId     String
  bar       Bar      @relation(fields: [barId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      BarRole
  vip       Boolean  @default(false)
  createdAt DateTime @default(now())

  @@unique([barId, userId])
}
```

`User` gagne `barMemberships BarMembership[]`. Les champs globaux `role`
(ADMIN/USER) et `vip` sur `User` sont **inchangés** dans cette phase — ils
continuent de gouverner `/stock`, `/cocktails`, `/soirees` comme
aujourd'hui, et le rôle `ADMIN` reste le rôle plateforme.

La ligne `OWNER` d'un bar a systématiquement `vip: true` (posée à la
création du bar). La colonne `vip` est donc la seule source de vérité pour
"cette personne voit le contenu VIP de ce bar" ; `role` sert uniquement à
distinguer/protéger la ligne du propriétaire (voir permissions ci-dessous)
et à l'affichage ("Propriétaire" vs "Membre").

Une migration Prisma (`add_bar_model`) sera générée et appliquée.

## 2. API (NestJS)

### Auto-inscription

`POST /auth/signup` (public, pas de guard) dans `auth.controller.ts` :
valide `username`/`password` (mêmes contraintes que `CreateUserDto`),
réutilise `UsersService.create({ username, password })` (role `USER`, vip
`false` par défaut, inchangé), puis connecte directement (même réponse que
`POST /auth/login` : `{ token, user }`).

### Nouveau module `bars/`

Suit le pattern de `recipes/` (service + controller + dto).

- `POST /bars` — `JwtAuthGuard`. Body `{ name }`. Crée le `Bar` et sa
  `BarMembership` (`role: OWNER`, `vip: true`) en une transaction. Rejette
  avec `ConflictException` si l'utilisateur possède déjà un bar
  (`BarMembership` où `userId = req.user.sub AND role = OWNER`).
- `GET /bars/mine` — `JwtAuthGuard`. Retourne les bars où l'utilisateur a
  une `BarMembership` (`include: { memberships: { where: { userId } } }`
  pour exposer son propre rôle/vip dans chaque bar), triés par nom.
  Alimente le sélecteur de bar.
- `GET /bars/:id/members` — `JwtAuthGuard`. Visible par tout membre du bar
  (`ForbiddenException` si l'utilisateur n'a pas de `BarMembership` sur ce
  bar). Retourne les memberships avec `username`.
- `POST /bars/:id/members` — `JwtAuthGuard`. Réservé au `OWNER` du bar.
  Body `{ username, vip? }`. Résout le username via
  `UsersService.findByUsername` (`NotFoundException` si inconnu),
  `ConflictException` si déjà membre, sinon crée `BarMembership(role:
  MEMBER, vip: vip ?? false)`.
- `PATCH /bars/:id/members/:membershipId` — `JwtAuthGuard`. Réservé au
  `OWNER`. Body `{ vip: boolean }`. Refuse de modifier une ligne `OWNER`
  (`ForbiddenException`).
- `DELETE /bars/:id/members/:membershipId` — `JwtAuthGuard`. Autorisé si
  `req.user.sub` est le `OWNER` du bar, **ou** si
  `membership.userId === req.user.sub` (un membre peut quitter le bar
  lui-même). Refuse dans tous les cas de supprimer une ligne `OWNER`
  (`ForbiddenException` — pas de suppression de bar ni de transfert de
  propriété dans cette phase).

### Permissions — résumé

| Action | Qui |
|---|---|
| Créer un bar | Tout utilisateur connecté n'ayant pas déjà un bar |
| Voir la liste de ses bars | Le propriétaire ou tout membre |
| Voir le roster d'un bar | Tout membre de ce bar |
| Inviter / toggle VIP / révoquer un membre | Le `OWNER` du bar uniquement |
| Quitter un bar | Le membre lui-même (sauf s'il est `OWNER`) |

## 3. Frontend

### Pages

- `src/app/signup/page.tsx` — formulaire public (username, password,
  confirmation), calque sur `src/app/login/`. Appelle un server action
  `signup(formData)` (`POST /auth/signup`), pose le cookie de session comme
  le fait déjà `login`.
- Écran "crée ton bar" — affiché à la place du contenu normal (dans le
  layout ou une page dédiée `src/app/bar/new/page.tsx`) quand
  `GET /bars/mine` ne retourne aucun bar où l'utilisateur est `OWNER`.
  Formulaire à un seul champ (`name`), server action `createBar(formData)`.
- `src/app/bar/membres/page.tsx` — page de gestion, visible seulement si
  l'utilisateur est `OWNER` de son bar actif : liste des membres (avec
  toggle VIP inline), formulaire d'invitation par username, bouton
  révoquer par ligne.

### Sélecteur de bar actif

- Nouveau cookie `bardenoa_active_bar` (id du bar), distinct du cookie de
  session JWT, posé/lu côté serveur (`src/lib/active-bar.ts`, miroir de
  `src/lib/session.ts`).
- `getActiveBar()` : lit le cookie, vérifie via `GET /bars/mine` que
  l'utilisateur a toujours accès à ce bar (sinon retombe sur son bar
  `OWNER` s'il en a un, sinon `null`).
- Composant `BarSwitcher` dans le header/nav (visible si l'utilisateur a
  accès à au moins un bar) : dropdown listant `GET /bars/mine`, sélection
  → server action qui pose le cookie et rafraîchit la page.
- Cette phase n'utilise le bar actif que pour l'affichage
  ("Membres"/propriétaire) — aucune page existante (`/stock`,
  `/cocktails`, `/soirees`) ne change de comportement.

### `src/lib/api-client.ts`

Ajout de `signup`, `createBar`, `listMyBars`, `listBarMembers`,
`inviteBarMember`, `updateBarMemberVip`, `removeBarMember`, suivant le
pattern existant des autres fonctions du fichier.

## 4. Tests

- `api/src/bars/bars.service.spec.ts` (nouveau) : création (rejet si déjà
  propriétaire), invitation (rejet si non-owner, rejet si déjà membre,
  rejet si username inconnu), toggle VIP (rejet sur ligne OWNER), révocation
  (owner sur un membre, membre sur lui-même, rejet si cible = OWNER, rejet
  si un non-owner tente de révoquer quelqu'un d'autre).
- `api/src/auth/auth.service.spec.ts` (existant) : ajouter un cas pour
  `signup` (création + connexion, rejet si username déjà pris — réutilise
  la validation existante de `UsersService.create`).
- Vérification manuelle dans le navigateur : inscription, création de bar,
  invitation d'un second compte par username, connexion avec ce second
  compte et vérification qu'il voit le bar dans son sélecteur, révocation
  et vérification que le bar disparaît de son sélecteur.

## Hors scope

- Rattacher `Bottle`, `Recipe`, `Event`, `Contribution`, `StockAdjustment` à
  un bar (phase 2, spec séparée).
- Suppression d'un bar, transfert de propriété.
- Visibilité admin plateforme sur l'ensemble des bars (pour le support).
- Invitations par lien/code pour des personnes sans compte existant.
- Rôles intermédiaires au sein d'un bar au-delà de `OWNER`/`MEMBER` (+VIP).
