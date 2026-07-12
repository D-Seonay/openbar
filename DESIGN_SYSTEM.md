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
