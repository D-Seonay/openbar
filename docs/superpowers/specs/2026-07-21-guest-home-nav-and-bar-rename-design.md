# Page d'accueil pour invités, navigation conditionnelle & renommage du bar — design

Date: 2026-07-21

## Contexte

La phase précédente a ajouté un accès invité limité à l'annuaire public
(`/decouvrir`), mais deux détails restent inconsistants avec cette
ouverture : la page d'accueil (`/`) redirige toujours un visiteur sans
compte vers `/login`, et la barre de navigation affiche les liens internes
au bar (Cave & Stock, Cocktails, Soirées) même quand personne n'est
connecté — ces liens ne mènent nulle part d'utile pour un invité, puisque
chaque page derrière eux redirige de toute façon vers `/login`. Cette phase
corrige les deux, et ajoute une fonctionnalité indépendante mais liée à la
gestion du bar : pouvoir renommer son bar depuis `/membres`.

## Décisions issues du brainstorming

- Le renommage du bar se fait via une nouvelle section sur la page
  `/membres` existante (aux côtés des sections visibilité et lien
  d'invitation déjà présentes), pas une page dédiée.
- La page d'accueil (`/`) devient une page de présentation générale de
  l'app pour un visiteur sans compte (tagline, boutons connexion/inscription,
  lien vers `/decouvrir` pour l'annuaire détaillé) — distincte du contenu de
  `/decouvrir`, qui reste la page dédiée à l'annuaire. Le comportement de
  `/` pour un compte connecté ne change pas du tout.
- La navigation masque les liens Cave & Stock/Cocktails/Soirées pour un
  visiteur sans compte (Membres/Comptes le sont déjà implicitement,
  puisqu'ils dépendent de `isBarOwner`/`isAdmin`, tous deux `false` sans
  session).

## 1. Navigation conditionnelle

`src/components/Navigation.tsx` gagne une prop requise `isLoggedIn:
boolean`. Le tableau `NAV` (Cave & Stock, Cocktails, Soirées) ne s'affiche
que si `isLoggedIn` est vrai :

```tsx
export default function Navigation({
  isAdmin,
  isBarOwner = false,
  isLoggedIn,
}: {
  isAdmin: boolean;
  isBarOwner?: boolean;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
      {isLoggedIn && NAV.map((item) => navLink(item, pathname))}
      {isBarOwner && OWNER_NAV.map((item) => navLink(item, pathname))}
      {isAdmin && ADMIN_NAV.map((item) => navLink(item, pathname))}
    </nav>
  );
}
```

`src/app/layout.tsx` passe `isLoggedIn={!!session}` (la variable `session`
est déjà résolue à cet endroit, aucune requête supplémentaire nécessaire).

## 2. Page d'accueil accessible sans compte

`src/app/page.tsx` : le `if (!session) redirect("/login");` actuel est
remplacé par un retour anticipé qui affiche une nouvelle section de
présentation au lieu de rediriger. Le reste de la fonction (tout le
contenu du tableau de bord pour un compte connecté) est **totalement
inchangé** — seul ce premier bloc change de comportement.

Contenu de la section invité (nouveau composant `src/app/GuestLanding.tsx`,
pas de logique serveur particulière, juste du JSX statique) :

- Titre/accroche présentant OpenBar.
- Deux boutons : "Se connecter" (`/login`) et "Créer un compte" (`/signup`).
- Un lien/carte vers "Découvrir les bars" (`/decouvrir`), reprenant le
  ton visuel des cartes déjà utilisées ailleurs sur cette page (`bg-ink-2/80
  border border-white/[0.08] rounded-2xl`).

## 3. Renommage du bar

### API

- **`BarsService.rename(barId, requesterId, name)`** — réservé au
  propriétaire (`assertOwner`, réutilisé). Valide `name` non vide (déjà
  fait par le DTO), met à jour `Bar.name`, retourne `{ id, name }`.
- **`PATCH /bars/:id/name`** — `JwtAuthGuard`. Nouveau DTO
  `RenameBarDto { @IsString() @MinLength(1) name: string }` (même forme que
  `CreateBarDto`).

### Frontend

- `src/lib/api-client.ts` : nouvelle fonction `renameBar(barId, name):
  Promise<{ id: string; name: string }>` — `PATCH /bars/:barId/name` avec
  `JSON.stringify({ name })`.
- `src/app/bar-actions.ts` : nouvelle action `renameBarAction(barId,
  name): Promise<{ error?: string }>` — même schéma que
  `setBarVisibilityAction`/`generateInviteLinkAction` (session, appel API,
  `revalidatePath("/membres")`, capture `ApiError`).
- Nouveau composant `src/app/membres/BarNameSection.tsx` : un champ texte
  pré-rempli avec le nom actuel, un bouton "Enregistrer", même style de
  carte que `BarVisibilitySection`/`InviteLinkSection`
  (`bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-3`).
- `src/app/membres/page.tsx` : ajoute `<BarNameSection barId={activeBar.id}
  name={activeBar.name} />` dans la colonne de gauche, aux côtés des deux
  sections existantes. Le titre de la page (`Membres de {activeBar.name}`)
  se met à jour automatiquement après un renommage grâce à
  `revalidatePath("/membres")`.

## 4. Tests

- `api/src/bars/bars.service.spec.ts` : nouveau describe `rename` — rejette
  un non-propriétaire (`ForbiddenException`, réutilise `assertOwner`), met
  à jour le nom pour le propriétaire.
- Vérification manuelle : un visiteur sans compte sur `/` voit la nouvelle
  page de présentation (pas de redirection) et ne voit pas les liens Cave &
  Stock/Cocktails/Soirées dans la navigation ; un propriétaire renomme son
  bar depuis `/membres` et voit le nouveau nom refléter partout
  (en-tête de `/membres`, sélecteur de bar, annuaire).

## Hors scope

- Contrainte d'unicité sur le nom du bar (deux bars peuvent partager le
  même nom, comme aujourd'hui).
- Modification du contenu de `/decouvrir` ou de son accessibilité.
- Tout changement au comportement de `/` pour un compte déjà connecté.
