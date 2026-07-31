# Design System — Le Bar de Noa (Cocktail Club & Codes Couleurs)

Référence unique et définitive pour le style du projet **Le Bar de Noa**. Basé sur l'esthétique **"Cocktail Club & Codes Couleurs"** : fond sombre feutré (`ink`), effets de verre poli sombre (*glassmorphism*), lueurs subtiles (*glows*) et codes couleurs distincts par catégorie d'alcool.

## 1. Principes Fondamentaux

- **Ambiance Cocktail Club Lounge** : Fonds sombres feutrés (`ink`, `ink-2`), contrastés par des typographies lumineuses et des bordures en verre poli à faible opacité (`border-white/[0.08]`).
- **Codes Couleurs Signatures par Alcool** : Chaque catégorie d'alcool possède sa couleur et son icône distinctives :
  - **Whisky & Bourbon** : Ambre doré (`#D97706`, `amber-400`)
  - **Gin Botanique** : Émeraude (`#10B981`, `emerald-400`)
  - **Rhum** : Cuivre ambré (`#F59E0B`, `orange-400`)
  - **Vodka Givrée** : Argent / Givré (`#94A3B8`, `slate-300`)
  - **Tequila & Mezcal** : Agave Or (`#EAB308`, `yellow-400`)
  - **Vin & Champagne** : Rubis / Bordeaux (`#E11D48`, `rose-400`)
  - **Mixers & Softs** : Menthe agrumée (`#34D399`, `teal-400`)
- **Cave et Réserve VIP séparées en deux univers** :
  - **Bar Principal (Invités)** : Grille et tableau de cave filtrables par catégorie colorée.
  - **Réserve Privée VIP** : Écrin "coffre-fort" dédié (`vip-vault-card`), bordure dorée luminescente (`border-gold/40`) et badge exclusif.
- **Carte des Cocktails — Menu de Bar de Luxe en Accordéon** :
  - Présentation inspirée d'une carte de bar imprimée haut de gamme.
  - Déploiement en accordéon au clic pour révéler la verrerie, les ingrédients sous forme de badges colorés, et les instructions de mixologie.
- **Soirées — Party Board Participatif** :
  - Page invité mobile-first avec identification fluide par prénom.
  - Flux dynamique *Qui ramène quoi* et consultation claire de ce qui est déjà disponible au Bar.

## 2. Palette de Couleurs & Utilitaires

Déclarée dans `@theme` (`src/app/globals.css`) et enrichie par `src/lib/categoryStyles.ts`.

| Token | Rôle |
|---|---|
| `ink` (`#110d0c`) | Fond principal de l'application |
| `ink-2` (`#1b1614`) | Surface de carte standard, filtres, modales |
| `brick-dark` (`#2a1711`) | Surface d'écrin VIP / survol accentué |
| `orange` (`#FF6B35`) | CTA principal et accents de mise en avant |
| `gold` (`#E8A563`) | Titres, badges VIP et hiérarchie importante |
| `cream` (`#FAF6F2`) | Texte principal |
| `muted` (`#A8988C`) | Texte secondaire, libellés techniques |

## 3. Typographie

- **Display (`font-display`)** : `Outfit` — utilisé pour les grands titres, noms de cocktails et en-têtes de section.
- **Sans / UI (`font-sans`)** : `Plus Jakarta Sans` — utilisé pour les boutons, formulaires, navigation et descriptions de recettes.
- **Eyebrow / Label** : `text-xs uppercase tracking-caps text-muted font-semibold`

## 4. Composants Clés & Micro-Interactions

- **Cartes Glassmorphism** : `.glass-card` combiné à `.glass-card-hover` pour une élévation douce au survol.
- **Filtres à Pilules Colorées** : Badges interactifs affichant le nombre de bouteilles ou recettes par catégorie.
- **Accordéon de Recette** : Animation de hauteur et de rotation d'icône au clic.

## 5. Mobile-First — Règles Obligatoires

L'application est consultée au téléphone pendant les soirées : **toute nouvelle UI doit être vérifiée à 360 px avant d'être considérée terminée.**

### Points de rupture

| Breakpoint | Largeur | Usage |
|---|---|---|
| *(défaut)* | < 400px | Petits téléphones (iPhone SE / mini) — tout s'empile |
| `xs:` | ≥ 400px | Téléphones standards — les paires côte à côte redeviennent possibles |
| `sm:` | ≥ 640px | Tablette et plus — densité « desktop », typographie compacte |
| `md:` | ≥ 768px | Navigation en pilules inline (en dessous : tiroir hamburger) |

### Utilitaires (`src/app/globals.css`)

- **`.tap-target` / `.tap-target-sm`** : hauteur minimale de 44px / 36px sur pointeur grossier (`@media (pointer: coarse)`). À appliquer à tout bouton-pilule qui ferait moins de 36px de haut. Combiner avec `flex items-center` pour que le libellé reste centré.
- **`.no-scrollbar`** : rails de filtres horizontaux défilables au doigt. Motif complet : `flex overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0` (le débord négatif fait filer les pilules jusqu'au bord de l'écran).
- **`.pb-safe` / `.pb-safe-0` / `.bottom-safe`** : marges `env(safe-area-inset-bottom)` pour l'encoche et la barre d'accueil iPhone. Obligatoire sur les tiroirs, les barres collantes et le pied de page.

### Règles de mise en page

- **Champs de formulaire** : en dessous de `sm`, tous les `input/select/textarea` passent à 16px automatiquement — en dessous, iOS zoome le viewport au focus. Ne pas contourner cette règle.
- **Troncature** : `truncate` n'a d'effet que si **tous** les parents flex portent `min-w-0`. Sans cela, un nom de bouteille long élargit la page.
- **Lignes denses** : `flex-col sm:flex-row` pour les listes, `flex-wrap` pour les groupes de badges et de boutons d'action.
- **Survol** : les effets qui déplacent ou éclairent un élément sont enfermés dans `@media (hover: hover) and (pointer: fine)` — sinon un tap laisse la carte figée dans son état survolé.

### Superpositions (tiroirs et modales) — piège de contexte d'empilement

`<main>` porte `relative z-10` et `<header>` porte `backdrop-blur` + `z-50`. Les deux créent un **contexte d'empilement**. Conséquence : une superposition `fixed` rendue à l'intérieur de `<main>` est plafonnée à `z-10` et passe **sous** l'en-tête, quel que soit son `z-index` ; à l'intérieur de `<header>` elle est en plus dimensionnée par rapport à l'en-tête et non au viewport.

**Toute superposition plein écran doit donc être portée dans `<body>` via `createPortal`.** Voir `ConfirmDeleteModal`, `ManageAlertsModal`, `CreateRecipeModal`, `StockStudio`, `CocktailStudio` et `Navigation`.

Compléter chaque tiroir par : `h-dvh` (et non `h-screen`, qui ignore la barre d'URL mobile), `overflow-y-auto overscroll-contain`, un verrouillage du défilement de `document.body` à l'ouverture, et `pb-safe`.
