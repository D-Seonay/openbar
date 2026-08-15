# Design System — OpenBar (Papier chaud)

Référence unique et définitive pour le style du projet **OpenBar**. Esthétique **« papier chaud »** : fond clair chaleureux, encre sombre, un seul accent terracotta, sans dégradés ni glassmorphism ni glow.

## 1. Palette

Déclarée dans `@theme` (`src/app/globals.css`) et verrouillée par `src/lib/contrast.test.ts` : changer une valeur sans relancer les tests casse la lisibilité.

| Token | Valeur | Rôle |
|---|---|---|
| `paper` | `#F3EFE7` | Fond principal de l'application |
| `paper-sunk` | `#E8E2D7` | Surface en creux : champs, filtres, badges de compteur |
| `ink` | `#26221D` | Texte principal, titres |
| `ink-soft` | `#6B6257` | Texte secondaire, libellés, méta |
| `rule` | `#D9D1C4` | Bordures, séparateurs |
| `terracotta` | `#A8452A` | Seul accent : CTA, liens actifs, alerte douce |
| `done` | `#4F6B43` | État positif (stock complet, succès) |
| `warn` | `#8A5A12` | État d'alerte (seuil bas, avertissement) |

**Aucun autre token de couleur.** Pas de `dark:` — l'application n'a qu'un thème.

**Aucun modificateur d'opacité sur une couleur de texte** (`text-ink-soft/70`, `text-terracotta/80`…) : `src/lib/contrast.test.ts` balaie `src/` par expression régulière et fait échouer le test si l'un apparaît. Un token de texte s'utilise plein, jamais atténué — s'il faut un ton plus doux, `ink-soft` existe déjà et vaut 5.22:1 sur `paper`. Les opacités sur `border-*` ou `bg-*` restent libres.

## 2. Typographie

- **Display (`font-display`)** : `Lora`, auto-hébergée (`src/app/fonts/`) — titres d'écran, noms de section. `font-weight: 400`, pas de `letter-spacing`.
- **Sans / UI (`font-sans`)** : `Plus Jakarta Sans`, auto-hébergée — tout le reste : boutons, formulaires, corps de texte.

### Échelle

| Token | Taille | Usage |
|---|---|---|
| `text-[27px]` (`--text-screen`) | 27px | `<h1>` d'écran, un seul par page |
| `text-[17px]` (`--text-section`) | 17px | Titres de section, `<h2>` de carte |
| `text-[15px]` (`--text-body`) | 15px | Corps de texte, libellés de bouton |
| `text-[13px]` (`--text-meta`) | 13px | Méta, légendes, eyebrow, labels de champ |

**Plancher 13px absolu, sans exception** — y compris pour un eyebrow ou une légende. Rien en `text-xs` (12px) nulle part dans `src/`.

Eyebrow : `text-[13px] uppercase tracking-caps text-terracotta font-semibold` (ou `text-ink-soft` hors contexte d'accent).

## 3. Les neuf primitives

Tout écran se compose à partir de `src/components/ui/*` et `src/components/ModalShell.tsx`. Une nouvelle UI n'invente pas de nouveau motif de carte, de liste ou de bouton — elle réutilise l'existant.

| Primitive | Fichier | Rôle |
|---|---|---|
| `Button` | `ui/Button.tsx` | Trois variantes : `principal` (plein terracotta, action par défaut), `discret` (contour, action secondaire **et tout déclencheur destructeur inline**), `danger` (plein terracotta, réservé au bouton qui **confirme** dans un dialogue — voir §5). `lienBoutonClasses` donne le même rendu à un `<Link>`. |
| `Card` | `ui/Card.tsx` | Conteneur de base, filet optionnel (`filet={false}` en liste dense). |
| `EmptyState` | `ui/EmptyState.tsx` | État vide standard : titre, message, action optionnelle. |
| `Field` | `ui/Field.tsx` | Label + aide/erreur pour un champ de formulaire ; `champClasses` pose le style du contrôle enfant. |
| `Badge` | `ui/Badge.tsx` | Pastille d'état : `neutre` / `complet` / `alerte`. |
| `Row` | `ui/Row.tsx` | Ligne de liste (titre, sous-titre, contenu de droite, chevron) ; rend un `<Link>`, un `<button>` ou un `<div>` selon les props reçues. |
| `Sheet` | `ui/Sheet.tsx` | Tiroir mobile ancré en bas, portalé, fermeture Échap et tap sur le voile. |
| `TabBar` | `ui/TabBar.tsx` | Barre d'onglets basse (voir §4). |
| `ModalShell` | `ModalShell.tsx` | Chrome commun à tous les dialogues : portail, animation, accent (`danger`/`warning`/`success`/`info`), Échap. `ConfirmDeleteModal` et `NoticeModal` s'appuient dessus plutôt que de le dupliquer. |

## 4. Navigation — barre d'onglets basse

`TabBar` (`src/components/ui/TabBar.tsx`) est fixée en bas de l'écran (`fixed bottom-0`), quatre entrées : Soirée, Cave, Cocktails, Moi. Aucune navigation en pilules ni tiroir hamburger — remplacés par cette barre. L'onglet actif se détermine par préfixe de chemin (`/soirees/xyz` garde « Soirée » allumé) et porte un anneau `focus-visible` clavier.

## 5. Danger vs. principal — la règle de confirmation

`danger` et `principal` sont **visuellement identiques** (plein terracotta) par choix : dans un dialogue de confirmation, « Annuler » (`discret`, contour) doit se distinguer d'un seul bouton plein qui confirme, qu'il soit positif ou destructeur. Cela ne fonctionne que si `danger` reste **exclusivement** ce bouton de confirmation.

- Un déclencheur inline qui ouvre un dialogue, ou qui agit directement sans confirmation, est en **`discret`** — jamais `danger`. Sinon il devient indiscernable d'un `principal` voisin (le bug qui a motivé cette règle : « Retirer VIP » et « Révoquer » côte à côte, tous deux pleins terracotta).
- Toute action irréversible ou de forte conséquence passe par `ConfirmDeleteModal` (ou `ModalShell` directement) plutôt que par un `confirm()` natif ou une exécution immédiate.

Le principe est documenté en commentaire au-dessus de la table `VARIANTS` dans `Button.tsx` — ne pas le laisser se reperdre.

## 6. Règles mobile obligatoires

L'application est consultée au téléphone pendant les soirées : **toute nouvelle UI doit être vérifiée à 390 px avant d'être considérée terminée.**

- **Cibles tactiles — 44px, sans exception.** `.tap-target` (`min-height: 44px; min-width: 44px`) est global, pas conditionné à `@media (pointer: coarse)` : un audit doit pouvoir le vérifier dans n'importe quel navigateur. `Button`, `Row` et les contrôles de `Field` l'appliquent déjà ; tout élément interactif ajouté à la main doit le porter.
- **Champs de formulaire** : en dessous de `sm` (640px), tout `input/select/textarea` passe à 16px automatiquement (`globals.css`) — en dessous, iOS zoome le viewport au focus. Ne pas contourner.
- **Troncature** : `truncate` n'a d'effet que si **tous** les parents flex portent `min-w-0`.
- **Lignes denses** : `flex-col sm:flex-row` pour les listes, `flex-wrap` pour les groupes de badges et de boutons d'action.
- **`.pb-safe` / `.pb-safe-0` / `.bottom-safe`** : `env(safe-area-inset-bottom)` pour l'encoche et la barre d'accueil iPhone — obligatoire sur `TabBar`, les tiroirs et les barres collantes.
- **Superpositions** : `<main>` porte `relative z-10`, ce qui crée un contexte d'empilement — une superposition `fixed` rendue à l'intérieur y est plafonnée à `z-10` et passe sous l'en-tête. Toute superposition plein écran est donc portée dans `<body>` via `createPortal` (voir `ModalShell`, `Sheet`).

## 7. Vérification

Deux harnais gardent ce document honnête :

- **`npm test`** (Vitest) — contrastes de la palette (`src/lib/contrast.test.ts`, y compris le balayage anti-opacité du §1) et autres unités pures.
- **`npm run audit`** (Playwright, `e2e/audit.spec.ts`) — parcourt les écrans réels (comptes `audit-bot` et `audit-admin`) et vérifie cibles tactiles ≥ 44px, plancher de texte 13px, et l'absence de tokens hors palette. Le commentaire en tête du fichier prévient : une page absente de la liste couverte n'est pas auditée, donc pas terminée — toute nouvelle route s'y ajoute.

Les deux doivent passer avant qu'un écran soit considéré fini.
