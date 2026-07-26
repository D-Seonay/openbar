# Gestion admin de tous les bars — design

Date: 2026-07-27

## Contexte

Un compte ADMIN existe déjà (rôle, page `/comptes` pour gérer les
utilisateurs) et bénéficie déjà d'un accès complet au **contenu** de
n'importe quel bar au niveau API (`BarAccessService.assertMember` traite
tout ADMIN comme ayant un accès total, sans vérifier de membership réelle).
Mais rien ne permet aujourd'hui à un admin de :

- consulter la liste de **tous** les bars de la plateforme (publics et
  privés) ;
- gérer un bar dont il n'est pas membre (renommer, changer la visibilité,
  gérer les membres, générer un lien d'invitation) — ces actions passent
  par une vérification de propriétaire réelle (`assertOwner`) qui ne
  connaît pas encore le bypass admin ;
- naviguer dans le contenu (cave, cocktails, soirées) d'un bar arbitraire,
  puisque les pages actuelles résolvent le bar actif uniquement parmi les
  bars dont le compte est membre (`listMyBars`/`resolveActiveBar`).

Cette phase ajoute une section admin dédiée, séparée des pages normales,
qui couvre les trois.

## Décisions issues du brainstorming

- Section admin séparée (`/admin/bars`), pas une réutilisation du
  sélecteur de bar existant.
- Contenu complet : lecture **et** modification (cave, cocktails,
  soirées), pas seulement consultation.
- Réutilisation maximale des composants déjà existants
  (`BarNameSection`, `BarVisibilitySection`, `InviteLinkSection`,
  `InviteMemberForm`, `MemberRow`, `PendingRequests`, `StockStudio`,
  `CocktailStudio`) plutôt que de reconstruire des interfaces parallèles —
  ils prennent déjà `barId` en prop, sans dépendance au bar actif résolu
  par cookie.

## 1. API — bypass admin pour la gestion (pas de nouvelle route)

`BarsService` gagne un helper privé réutilisable :

```ts
private async isAdmin(userId: string): Promise<boolean> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}
```

Trois méthodes existantes l'utilisent pour court-circuiter leur
vérification de propriétaire/membre réelle :

- **`assertOwner(barId, userId)`** — après `getBar(barId)`, si
  `await this.isAdmin(userId)` retourne `true`, la méthode retourne
  immédiatement sans vérifier de `BarMembership`. Sinon, comportement
  actuel inchangé. Toutes les méthodes qui appellent déjà `assertOwner`
  (`inviteMember`, `updateMemberVip`, `setPublic`, `generateInviteLink`,
  `rename`, `findPendingRequests`, `respondToJoinRequest`) héritent du
  bypass **sans changement de signature** — aucune modification de
  contrôleur nécessaire.
- **`findMembers(barId, userId)`** — le rejet `ForbiddenException` actuel
  (`if (!membership) throw ...`) est sauté si `isAdmin(userId)`.
- **`removeMember(barId, requesterId, membershipId)`** — sa vérification
  `isOwner = requesterMembership?.role === 'OWNER'` devient
  `isOwner = requesterMembership?.role === 'OWNER' || (await this.isAdmin(requesterId))`.

Aucune route, aucun DTO, aucune signature de méthode publique ne change —
c'est un changement interne pur, donc **zéro modification de
`bars.controller.ts` pour cette partie**.

## 2. API — nouvelles routes pour l'annuaire admin

### `findAll()` + `GET /bars/all`

```ts
async findAll() {
  const bars = await this.prisma.bar.findMany({
    include: {
      memberships: {
        select: { role: true, user: { select: { username: true } } },
      },
      _count: { select: { memberships: true } },
    },
    orderBy: { name: 'asc' },
  });

  return bars.map((bar) => {
    const owner = bar.memberships.find((m) => m.role === 'OWNER');
    return {
      id: bar.id,
      name: bar.name,
      ownerUsername: owner?.user.username ?? '—',
      memberCount: bar._count.memberships,
      isPublic: bar.isPublic,
      createdAt: bar.createdAt,
    };
  });
}
```

Contrairement à `findDirectory` (filtré aux bars publics, pensé pour
l'annuaire des comptes normaux), `findAll` retourne **tous** les bars sans
filtre — réservé à l'admin.

Route : `GET /bars/all`, `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')`
(même pattern que `UsersController`).

### `findOne(barId)` + `GET /bars/:id`

Nécessaire pour que les nouvelles pages admin (`/admin/bars/[id]/stock`,
etc.) affichent le nom du bar consulté sans dépendre du bar actif résolu
par cookie :

```ts
async findOne(barId: string) {
  const bar = await this.getBar(barId);
  const [memberCount, ownerMembership] = await Promise.all([
    this.prisma.barMembership.count({ where: { barId } }),
    this.prisma.barMembership.findFirst({
      where: { barId, role: 'OWNER' },
      include: { user: { select: { username: true } } },
    }),
  ]);
  return {
    id: bar.id,
    name: bar.name,
    isPublic: bar.isPublic,
    inviteToken: bar.inviteToken,
    memberCount,
    ownerUsername: ownerMembership?.user.username ?? '—',
  };
}
```

Route : `GET /bars/:id`, même garde `@Roles('ADMIN')`.

**Point d'implémentation critique** : NestJS/Express matche les routes
dans leur ordre de déclaration. `GET /bars/:id` est un segment générique à
une position (`/bars/<n'importe quoi>`) qui **chevauche exactement**
`GET /bars/mine`, `GET /bars/directory`, `GET /bars/search-users` et
`GET /bars/all` (eux aussi à un seul segment). Cette nouvelle route doit
être déclarée **après** ces quatre routes dans `BarsController`, sinon
elle les intercepterait (une requête vers `/bars/mine` matcherait `:id`
avec `id="mine"` en premier). Les routes à deux segments et plus
(`:id/members`, `:id/visibility`, etc.) ne sont pas concernées, leur
nombre de segments diffère.

## 3. Frontend — annuaire admin

### `/admin/bars` (nouvelle page)

Garde `isAdminLoggedIn()` (comme `/comptes`), liste `findAll()` avec nom,
propriétaire, nombre de membres, statut public/privé, lien vers chaque
`/admin/bars/[id]`.

### `/admin/bars/[id]` (nouvelle page — hub de gestion)

Récupère `findOne(barId)` + la liste des membres + les demandes en
attente, puis rend les composants déjà existants, inchangés :
`BarNameSection`, `BarVisibilitySection`, `InviteLinkSection`,
`InviteMemberForm`, `MemberRow` (une par membre), `PendingRequests` — tous
prennent déjà `barId` en prop sans dépendance au bar actif du cookie.
Ajoute trois liens vers les pages de contenu (stock, cocktails, soirées).

### `/admin/bars/[id]/stock`, `/admin/bars/[id]/cocktails`, `/admin/bars/[id]/soirees` (nouvelles pages)

Copies allégées des pages existantes `/stock`, `/cocktails`, `/soirees` :
même logique de récupération de données, mais `barId` vient du paramètre
d'URL (`params.id`) au lieu de `resolveActiveBar(await listMyBars())`, et
rendent les **mêmes composants** (`StockStudio`, `CocktailStudio`, le
formulaire de création de soirée + la liste). Comme ces composants
dérivent déjà les droits de gestion via `session.role === "ADMIN"` (déjà
en place, ex. `canManageStock = session.role === "ADMIN" || activeBar.myRole === "OWNER"`),
aucune modification de composant n'est nécessaire — seule la page qui les
appelle change sa source de `barId`.

### Navigation

`ADMIN_NAV` dans `src/components/Navigation.tsx` gagne une entrée
`{ href: "/admin/bars", label: "Tous les bars" }`, à côté de l'entrée
existante `Comptes`.

## 4. Tests

- `api/src/bars/bars.service.spec.ts` : nouveaux cas pour `findAll`
  (retourne tous les bars, publics et privés confondus), `findOne`
  (retourne les détails d'un bar existant, `NotFoundException` sinon), et
  le bypass admin sur `assertOwner`/`findMembers`/`removeMember` (un
  compte ADMIN sans membership réelle peut renommer/lister les
  membres/retirer un membre d'un bar qu'il ne possède pas).
- Vérification manuelle : un admin visite `/admin/bars`, voit un bar privé
  qu'il ne possède pas, entre dedans, renomme le bar, ajoute/retire un
  membre, consulte et modifie sa cave — toutes les actions réussissent
  sans qu'il soit membre du bar.

## Hors scope

- Suppression d'un bar (aucune fonctionnalité de suppression n'existe
  pour personne actuellement, y compris les propriétaires — pas demandé
  ici).
- Transfert de propriété d'un bar.
- Pagination de l'annuaire admin (comme `findDirectory`, accepté sans
  pagination pour l'instant).
- Toute modification aux pages `/stock`, `/cocktails`, `/soirees`,
  `/membres` existantes (elles restent réservées au bar actif de l'admin,
  s'il en a un) — les nouvelles pages admin sont des copies parallèles,
  pas des modifications des pages existantes.
