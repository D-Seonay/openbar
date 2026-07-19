# Rebrand & login UX — design

Date: 2026-07-19

## Contexte

L'application s'appelait jusqu'ici "Le Bar de Noa" — un nom personnel, hérité
de l'époque où l'app ne gérait qu'un seul bar. Depuis les phases 1 et 2
(multi-tenant : chacun a son bar), ce nom ne correspond plus au produit.
Par ailleurs, l'écran de connexion et le composant de compte dans l'en-tête
sont restés conçus pour un seul admin : ils étiquettent tout "Admin" même
pour un compte VIP/propriétaire de bar ordinaire, et un utilisateur connecté
non-admin ne voit aucune indication qu'il est connecté (pas de nom
d'utilisateur, pas de bouton de déconnexion) — juste un lien "Connexion
Admin" comme s'il n'était pas connecté du tout.

Ce projet est la première des deux étapes convenues pour la demande
"renommer + rendre la connexion plus intuitive + nouvelle page d'accueil
avec annuaire des bars" : cette étape couvre uniquement le rebrand et la
connexion. L'annuaire public des bars, les demandes pour rejoindre un bar,
et la nouvelle page d'accueil font l'objet d'une deuxième spec séparée,
après celle-ci.

## Décisions issues du brainstorming

- Nouveau nom : **OpenBar** (nom volontairement un peu ironique — l'accès
  reste sur invitation, pas vraiment "open" — mais générique et mémorable).
- Le problème principal de connexion à corriger : le vocabulaire "Admin"
  employé partout (lien d'en-tête, placeholder du mot de passe, intitulé de
  la page) alors que n'importe quel compte (VIP, propriétaire de bar,
  simple membre) doit passer par cet écran.
- `package.json` (`"name": "bardenoa"`) et `favicon.ico` restent inchangés
  — identifiants internes/techniques, pas de la marque visible par
  l'utilisateur final.

## 1. Rebrand — remplacement du nom partout où il est visible

Remplacer "Le Bar de Noa" par "OpenBar" (et adapter le texte environnant si
besoin) dans :

- `src/app/layout.tsx` :
  - `metadata.title` : `"Le Bar de Noa — Mixologie & Cave Privée"` →
    `"OpenBar — Mixologie & Cave Privée"`
  - Le badge logo dans l'en-tête : la lettre `N` devient `O`
  - Le texte du logo : `Le Bar <span ...>de Noa</span>` devient
    `Open<span ...>Bar</span>` (même effet de dégradé orange/or sur la
    seconde partie du nom)
  - Le pied de page : `"Le Bar de Noa · Salon privé de mixologie © {année}"`
    → `"OpenBar · Salon privé de mixologie © {année}"`
- `src/app/login/page.tsx` : le titre `"Le Bar de Noa"` devient `"OpenBar"`
- `src/app/signup/page.tsx` : `"Rejoindre Bardenoa"` devient
  `"Rejoindre OpenBar"`
- `src/app/cocktails/CocktailStudio.tsx` : le filigrane
  `"Le Bar de Noa · Carte Cocktails"` devient `"OpenBar · Carte Cocktails"`
- `src/app/stock/StockStudio.tsx` : le filigrane
  `"Le Bar de Noa · Studio Cave"` devient `"OpenBar · Studio Cave"`

Aucun changement de logique, uniquement du texte et la lettre du badge logo.

## 2. Connexion — `AdminBadge` devient `AccountMenu`

### Le problème précis

`src/components/AdminBadge.tsx` ne connaît que deux états, pilotés par une
seule prop `isAdmin: boolean` :
- `isAdmin === false` → affiche un lien `"Connexion Admin"` vers `/login`,
  **qu'il y ait une session active ou non**.
- `isAdmin === true` → affiche le menu déroulant complet (badge "Mode
  Admin", lien "Gestion des comptes", déconnexion).

Un compte VIP ou propriétaire de bar connecté (donc avec une session
valide, mais `role !== 'ADMIN'`) tombe dans le premier cas : rien
n'indique qu'il est connecté, et il n'a aucun moyen de se déconnecter
depuis l'en-tête.

### Le nouveau composant

Renommer `AdminBadge.tsx` en `AccountMenu.tsx`, avec une prop `session:
SessionUser | null` (le type existant de `src/lib/session.ts`) à la place
de `isAdmin: boolean`. Trois états :

1. **`session` est `null`** (pas connecté) : afficher deux liens côte à
   côte, `"Se connecter"` (→ `/login`) et `"Créer un compte"` (→
   `/signup`), tous deux visibles.
2. **`session` existe, `session.role !== 'ADMIN'`** : menu déroulant
   affichant le nom d'utilisateur et un bouton `"Se déconnecter"` — pas de
   lien "Gestion des comptes" (réservé aux admins).
3. **`session` existe, `session.role === 'ADMIN'`** : comportement actuel
   inchangé (badge "Mode Admin", menu avec "Gestion des comptes" et
   déconnexion) — un admin plateforme reste un cas légitimement spécial,
   ce texte reste exact pour lui.

`src/app/layout.tsx` passe déjà `session` (récupéré via `getSession()`) —
il suffit de le transmettre à `AccountMenu` à la place de `isAdmin` seul
(la prop `isAdmin` reste utilisée ailleurs dans `layout.tsx` pour
`Navigation`, elle n'est pas supprimée, juste plus passée à ce composant
précis).

## 3. Page de connexion — dé-admin-ifier le texte

Dans `src/app/login/page.tsx` :
- Le kicker `"ESPACE RÉSERVÉ"` devient `"CONNEXION"`
- Le placeholder `"Mot de passe d'administration"` devient simplement
  `"Mot de passe"`
- Ajouter, en bas du formulaire (symétrique au lien déjà présent sur la
  page d'inscription), un lien `"Pas de compte ? "` +
  `"Créer un compte"` (→ `/signup`)

La page d'inscription (`src/app/signup/page.tsx`) a déjà ce lien réciproque
(`"Déjà un compte ? Se connecter"`) — aucun changement nécessaire là, à
part le titre (section 1).

## 4. Tests

Aucun changement d'API ni de logique métier — uniquement du texte et la
logique d'affichage à 3 états d'`AccountMenu`. Le frontend n'a pas de
framework de test ; la vérification se fait via `npx tsc --noEmit -p .`
et une vérification manuelle des 3 états (anonyme, connecté non-admin,
connecté admin) dans le navigateur.

## Hors scope

- L'annuaire public des bars, les demandes pour rejoindre un bar, et la
  nouvelle page d'accueil — deuxième spec séparée, après celle-ci.
- `package.json` (`"name": "bardenoa"`) et `favicon.ico`.
- Tout changement de logique d'authentification (JWT, cookies, guards) —
  uniquement l'affichage.
