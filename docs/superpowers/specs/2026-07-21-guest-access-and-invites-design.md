# Accès invité, bars publics/privés & invitations — design

Date: 2026-07-21

## Contexte

Depuis la phase précédente, tout compte connecté peut parcourir un annuaire
de tous les bars de la plateforme et demander à en rejoindre un. Cette phase
ajoute trois choses liées entre elles : (1) un visiteur sans compte peut
consulter un annuaire des bars **publics**, (2) chaque bar a désormais un
statut public/privé choisi par son propriétaire, et (3) le propriétaire peut
inviter des personnes plus facilement — en cherchant parmi les comptes
existants, ou via un lien réutilisable pour des personnes qui n'ont pas
encore de compte. L'écran d'accueil post-connexion ne change pas : sa
section "prochaine soirée" couvre déjà "les événements où je suis invité"
au sens où l'entend l'utilisateur (les soirées des bars dont il est membre).

## Décisions issues du brainstorming

- Un visiteur sans compte ne voit que l'annuaire des bars publics (nom,
  propriétaire, nombre de membres) — jamais le contenu d'un bar (cave,
  cocktails, soirées), qu'il soit public ou privé.
- `/login` reste la page d'accueil par défaut ; un lien "Voir les bars sans
  compte" mène à ce nouvel annuaire public.
- Le statut public/privé est choisi par le propriétaire depuis `/membres`,
  **privé par défaut** pour un bar nouvellement créé.
- Un bar privé est invisible **partout** sauf invitation directe (par
  pseudo) ou lien d'invitation — y compris dans l'annuaire des comptes
  connectés, et la demande à rejoindre (`POST /bars/:id/join-requests`) est
  refusée pour un bar privé même si son id est deviné.
- Les bars qui existent déjà en production restent visibles (rétro-compatibilité) :
  seuls les bars créés après ce déploiement sont privés par défaut.
- Deux améliorations à l'invitation directe : chercher parmi les comptes
  existants au lieu de taper un pseudo exact, et un lien d'invitation
  réutilisable par bar (régénérable pour invalider l'ancien) permettant à
  quelqu'un sans compte de rejoindre directement après inscription/connexion.

## 1. Modèle de données (Prisma)

```prisma
model Bar {
  # ... champs existants inchangés ...
  isPublic    Boolean @default(true)
  inviteToken String? @unique
}
```

Le défaut `@default(true)` au niveau de la colonne sert uniquement à ce que
la migration remplisse automatiquement `true` pour toutes les lignes
existantes (rétro-compatibilité, décision ci-dessus) — la valeur par défaut
pour un bar **nouvellement créé** est en réalité `false` (privé), appliquée
explicitement par le code de `BarsService.create()` qui passe désormais
`isPublic: false` dans les données de création (voir section 2). C'est le
même principe expand-contract déjà utilisé dans ce projet (colonne avec
défaut au niveau DB pour absorber les lignes existantes, comportement
applicatif différent pour les nouvelles écritures).

`inviteToken` est `null` tant que le propriétaire n'a pas généré de lien ;
régénérer le lien remplace la valeur (l'ancien token devient invalide
immédiatement, aucune ligne supplémentaire n'est créée).

## 2. API (NestJS)

### `BarsService` — méthodes modifiées

- **`create(name, userId)`** : ajoute `isPublic: false` dans les données de
  création (nouveaux bars privés par défaut, malgré le défaut `true` de la colonne).
- **`findDirectory(userId?: string)`** : le paramètre devient optionnel.
  Filtre désormais `where: { isPublic: true }` dans tous les cas (visiteur
  ou compte connecté — un bar privé n'apparaît dans aucun des deux
  annuaires). Si `userId` est `undefined` (visiteur sans compte), la
  détection `myMembership`/`pendingBarIds` est sautée et `myStatus` vaut
  toujours `'NONE'`.
- **`createJoinRequest(barId, userId)`** : ajoute une vérification
  `if (!bar.isPublic) throw new ForbiddenException('Ce bar est privé')`
  juste après `getBar(barId)`, avant les vérifications existantes.

### `BarsService` — nouvelles méthodes

- **`searchUsers(query: string)`** — recherche des comptes par pseudo
  (`contains`, insensible à la casse, limite 10 résultats), retourne
  `{ id, username }[]`. Utilisée par le formulaire d'invitation pour
  proposer des comptes existants au lieu d'exiger un pseudo exact.
- **`generateInviteLink(barId, requesterId)`** — réservé au propriétaire
  (`assertOwner`). Génère un token aléatoire (`crypto.randomBytes(16).toString('hex')`),
  l'enregistre sur `Bar.inviteToken` (remplace l'ancien s'il existait), le
  retourne.
- **`previewInviteLink(token: string)`** — trouve le bar par `inviteToken`,
  retourne `{ barName }` ; `NotFoundException` si le token est invalide.
  Ne révèle rien d'autre que le nom du bar.
- **`joinViaInviteLink(token: string, userId: string)`** — trouve le bar
  par `inviteToken` (`NotFoundException` si invalide), crée la
  `BarMembership` (`role: MEMBER`, `vip: false`) si l'appelant n'est pas
  déjà membre ; **idempotent** — si déjà membre, ne fait rien et retourne
  simplement l'état actuel plutôt que de lever une erreur (un lien peut
  être cliqué plusieurs fois par la même personne sans que ce soit une
  erreur utilisateur).

### `BarsController` — routes

- `GET /bars/directory` — le guard passe de `JwtAuthGuard` à
  `OptionalJwtAuthGuard` (déjà utilisé ailleurs dans ce projet pour
  `GET /events/:slug/contributions`, précédent direct à suivre) ;
  `req.user` peut être `undefined`, transmis tel quel à `findDirectory`.
- `GET /bars/search-users?q=` — `JwtAuthGuard`. Appelle `searchUsers`.
- `POST /bars/:id/invite-link` — `JwtAuthGuard`. Appelle `generateInviteLink`.
- `GET /bars/invite/:token/preview` — `OptionalJwtAuthGuard` (accessible
  sans compte, mais un guard optionnel suffit puisqu'aucune donnée
  utilisateur n'est nécessaire ; garde la cohérence avec le reste du
  contrôleur plutôt que de retirer complètement le guard).
- `POST /bars/invite/:token/join` — `JwtAuthGuard` (il faut être connecté
  pour rejoindre). Appelle `joinViaInviteLink`.

Toutes les routes existantes (membres, demandes à rejoindre) restent
inchangées à part `findDirectory`/`createJoinRequest` ci-dessus.

## 3. Frontend

### `/login` (`src/app/login/page.tsx`)

Ajoute un lien "Voir les bars sans compte" vers `/decouvrir`. Le formulaire
de connexion garde son comportement actuel, y compris le champ caché
`redirectTo` déjà supporté par l'action `login` (aucun changement côté
action nécessaire).

### `/decouvrir` (nouvelle page, `src/app/decouvrir/page.tsx`)

Page publique (aucune redirection si pas de session). Appelle
`listBarsDirectory()` (fonctionne maintenant sans cookie de session grâce
au guard optionnel) et affiche la même liste que la section annuaire de la
page d'accueil, mais en lecture seule : pour chaque bar, au lieu du bouton
"Demander à rejoindre", un lien "Créer un compte pour rejoindre" vers
`/signup`. Réutilise la logique d'affichage de `BarDirectory.tsx` via une
prop `guestMode` (ou un composant frère plus simple selon ce que la mise en
œuvre juge le plus lisible).

### `/membres` (`src/app/membres/page.tsx`)

Deux nouvelles sections (propriétaire uniquement, page déjà réservée aux
`OWNER`) :

- **Public/privé** : un interrupteur affichant l'état actuel du bar
  (`activeBar` a besoin d'exposer `isPublic` — ajouté au type `Bar` et à
  `findMine`), avec une action serveur pour basculer.
- **Lien d'invitation** : affiche le lien actuel (construit à partir de
  `inviteToken`, ex. `https://.../rejoindre/{token}`) avec un bouton copier,
  ou "Générer un lien" si `inviteToken` est `null` ; un bouton "Régénérer"
  remplace l'ancien.

`InviteMemberForm.tsx` : le champ pseudo devient un champ de recherche —
saisie déclenche `searchUsers(query)` (nouvelle fonction `api-client.ts`)
après un court debounce, affiche une liste de suggestions, sélectionner un
résultat remplit le pseudo à soumettre. Le reste du formulaire (VIP,
soumission) ne change pas.

### `/rejoindre/[token]` (nouvelle page, `src/app/rejoindre/[token]/page.tsx`)

Page serveur. Récupère `previewInviteLink(token)` :

- Token invalide → message d'erreur simple, lien vers `/login`.
- Token valide, session active → appelle immédiatement une action serveur
  `joinViaInviteLinkAction(token)` puis redirige vers `/`.
- Token valide, pas de session → affiche le nom du bar avec deux liens :
  "Se connecter" (`/login?redirectTo=/rejoindre/{token}`) et "Créer un
  compte" (`/signup?inviteToken={token}`).

### `login`/`signup` (actions serveur)

- `login` (`src/app/login/actions.ts`) : déjà fonctionnel avec
  `redirectTo`, aucun changement.
- `signup` (`src/app/bar-actions.ts`) : ajoute un champ optionnel
  `inviteToken`. S'il est présent, après création du compte et pose du
  cookie de session, appelle `joinViaInviteLink` (au lieu de rediriger vers
  `/creer`) puis redirige vers `/`. Sans `inviteToken`, comportement
  actuel inchangé (redirection vers `/creer`).
- La page `/signup` doit lire `?inviteToken=` dans `searchParams` et le
  passer en champ cachén du formulaire.

## 4. Tests

- `api/src/bars/bars.service.spec.ts` : cas pour `findDirectory` sans
  `userId` (myStatus toujours `NONE`, filtre `isPublic: true`),
  `createJoinRequest` rejetant un bar privé, `create` posant
  `isPublic: false`, `searchUsers` (résultats filtrés/limite),
  `generateInviteLink`/`previewInviteLink`/`joinViaInviteLink` (token
  invalide, jointure idempotente si déjà membre, jointure réussie sinon).
- Vérification manuelle : un visiteur sans compte voit l'annuaire public
  et ne voit pas un bar rendu privé entre-temps ; un lien d'invitation
  généré puis régénéré invalide l'ancien ; s'inscrire via un lien
  d'invitation rejoint directement le bar sans passer par `/creer`.

## Hors scope

- Notifications de nouvelle demande à rejoindre ou d'utilisation du lien
  d'invitation.
- Expiration automatique du lien d'invitation (seule la régénération
  l'invalide).
- Contenu de bar (cave, cocktails, soirées) visible aux visiteurs sans
  compte, même pour un bar public — seul l'annuaire l'est.
- Modification du système `Contribution` (invités de soirée) — reste
  inchangé, comme dans toutes les phases précédentes.
- Changement de l'écran d'accueil post-connexion au-delà du filtre
  `isPublic` déjà appliqué transparemment par `findDirectory`.
