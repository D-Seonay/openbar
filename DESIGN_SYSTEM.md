# Design System — Le Bar de Noa

Référence unique pour fixer le style du projet. Basé sur l'esthétique "bar feutré" (fond bordeaux/noir, typographie dorée élégante). Tout écart visuel par rapport à ce document doit être considéré comme un bug de style.

## 1. Principes

- **Sombre et chaud** : jamais de gris froid ni de blanc pur. Tout part de tons ink/brique/or.
- **Un seul accent** : l'or (`gold`) est la seule couleur vive. Il sert à hiérarchiser (titres, CTA, VIP), pas à décorer.
- **VIP = distinct partout** : dès qu'un bloc concerne la réserve VIP, il prend le traitement `brick-dark` + bordure `gold/25`, sans exception, sur toutes les pages.
- **Display vs UI** : `Italiana` uniquement pour les titres (rare, grand, impactant). `Jost` pour tout le reste. On ne mélange jamais les deux dans un même bloc de texte.
- **Discret sur les bordures** : les séparateurs utilisent des couleurs à faible opacité (`/10`, `/15`, `/25`) plutôt que des couleurs pleines, pour garder l'ambiance feutrée.

## 2. Palette de couleurs

Déclarée une seule fois via Tailwind v4 `@theme` dans `globals.css`. Chaque token génère automatiquement les utilitaires `bg-*`, `text-*`, `border-*`.

| Token | Hex | Rôle |
|---|---|---|
| `ink` | `#14090a` | Fond de page par défaut |
| `ink-2` | `#1d0e0d` | Fond des cartes standard, des champs de formulaire |
| `brick` | `#7a2a1f` | Panneaux pleine couleur (hero, section importante) |
| `brick-light` | `#96392a` | Bordures d'inputs, hover de boutons secondaires |
| `brick-dark` | `#571d15` | Fond des blocs VIP (à 40% d'opacité en pratique) |
| `gold` | `#f0c24c` | Titres, CTA primaires, badges VIP, liens actifs |
| `gold-dim` | `#c99a52` | Labels "eyebrow", sous-titres, tags de recette |
| `cream` | `#f6ecdf` | Texte principal sur fond sombre |
| `muted` | `#c7a690` | Texte secondaire, texte désactivé |

Règle d'opacité : ne jamais utiliser `brick-dark` ou `gold` à 100% comme fond de grande surface avec du texte long — toujours passer par un modificateur (`bg-brick-dark/40`, `border-gold/25`) pour rester lisible et feutré. Les seules surfaces pleines sont `ink`, `ink-2` et `brick`.

```css
@theme {
  --color-ink: #14090a;
  --color-ink-2: #1d0e0d;
  --color-brick: #7a2a1f;
  --color-brick-light: #96392a;
  --color-brick-dark: #571d15;
  --color-gold: #f0c24c;
  --color-gold-dim: #c99a52;
  --color-cream: #f6ecdf;
  --color-muted: #c7a690;

  --font-display: var(--font-italiana), serif;
  --font-sans: var(--font-jost), sans-serif;
}
```

### Contraste

- `cream` sur `ink`/`ink-2`/`brick` : conforme AA (texte courant).
- `gold` sur `ink`/`brick` : conforme AA pour du texte de titre ou gras ; éviter en texte fin de petite taille.
- `ink` sur `gold` (boutons) : très bon contraste, c'est la combinaison la plus lisible du système — c'est pour ça qu'elle est réservée aux CTA.
- `muted` sur `ink` : à réserver aux textes secondaires (légendes, métadonnées), pas au contenu principal.

## 3. Typographie

| Rôle | Police | Poids | Usage |
|---|---|---|---|
| Display | `Italiana` (Google Font) | 400 (unique poids) | `<h1>`, titres de section importants, wordmark |
| Interface | `Jost` (Google Font) | 300 / 400 / 500 / 600 | Nav, boutons, corps de texte, formulaires |

Chargement via `next/font/google` dans `layout.tsx`, exposé en variables CSS (`--font-italiana`, `--font-jost`) puis mappé sur `--font-display` / `--font-sans` dans `@theme`.

### Échelle

| Usage | Classe | Police |
|---|---|---|
| Titre hero (accueil) | `font-display text-6xl sm:text-7xl text-gold` | Italiana |
| Titre de page | `font-display text-4xl text-gold` | Italiana |
| Titre de carte/section | `font-display text-xl text-cream` (ou `text-lg`) | Italiana |
| Eyebrow / label | `text-xs uppercase tracking-caps text-gold-dim` | Jost |
| Nav | `text-xs uppercase tracking-caps text-muted` | Jost |
| Corps de texte | `text-sm text-muted` ou `text-cream` selon l'importance | Jost |
| Métadonnée / légende | `text-xs text-muted` | Jost |

`tracking-caps` = `letter-spacing: 0.18em`, toujours combiné avec `uppercase` — réservé aux libellés courts (nav, eyebrows, badges), jamais à des phrases.

## 4. Espacement, formes, élévation

- **Rayon** : `rounded-lg` (inputs, boutons rectangulaires), `rounded-xl` (cartes, panneaux), `rounded-full` (CTA pill, badges numériques). Jamais d'angle vif sur un conteneur.
- **Bordures** : 1px, couleur à opacité réduite (`border-cream/10` par défaut, `border-gold/25` pour VIP, `border-brick-light/60` pour les champs de formulaire).
- **Espacement vertical entre sections** : `space-y-8` (page dense) à `space-y-10` (page avec peu de sections).
- **Padding interne des cartes** : `p-4` (ligne compacte), `p-5` ou `p-6` (bloc de contenu, formulaire).
- **Pas d'ombres portées** : la profondeur vient de la couleur de fond (ink vs ink-2 vs brick), pas de `box-shadow`.

## 5. Composants

### 5.1 Boutons

**Primaire** (action principale : ajouter, créer, envoyer)
```html
<button class="bg-gold text-ink font-medium rounded-lg py-2 px-4 hover:bg-cream transition-colors">
  Ajouter au stock
</button>
```
Variante pill pour les CTA de mise en avant (accueil) : `rounded-full` au lieu de `rounded-lg`.

**Secondaire / discret** (copier un lien, action non destructive)
```html
<button class="text-xs px-2 py-1 rounded-md border border-brick-light/60 text-muted hover:border-gold hover:text-gold transition-colors">
  Copier le lien
</button>
```

**Destructif** (supprimer) — jamais de fond rouge plein, seulement un texte qui vire au rouge au survol pour rester discret :
```html
<button class="text-xs text-muted hover:text-red-400">Supprimer</button>
```

### 5.2 Champs de formulaire

```html
<input class="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm
              placeholder:text-muted/60 focus:outline-none focus:border-gold/60" />
```
Toujours `focus:border-gold/60`, jamais d'anneau de focus (`ring`) — le changement de bordure suffit et reste cohérent avec l'absence d'ombres.

### 5.3 Cartes

**Standard**
```html
<section class="rounded-xl border border-cream/10 bg-ink-2 p-6">…</section>
```

**VIP** (toujours ce traitement, sans exception, partout où du contenu VIP apparaît)
```html
<section class="rounded-xl border border-gold/25 bg-brick-dark/40 p-6">…</section>
```

**Carte statistique** (accueil)
```html
<a class="rounded-lg border border-cream/15 bg-ink/20 p-4 hover:border-gold/60 hover:bg-ink/30 transition-colors">
  <p class="font-display text-3xl text-cream">12</p>
  <p class="text-[11px] uppercase tracking-caps text-gold-dim mt-1">Bouteilles en stock</p>
</a>
```

**Carte recette de cocktail**
```html
<div class="rounded-xl border border-cream/10 bg-ink-2 p-4">
  <div class="flex items-baseline justify-between">
    <h3 class="font-display text-lg text-cream">Mojito</h3>
    <span class="text-xs text-gold-dim">Long drink</span>
  </div>
  <p class="text-xs text-gold-dim mt-1 tracking-wide">rhum blanc · citron vert · menthe · sucre · soda</p>
  <p class="text-sm text-muted mt-2">Écraser menthe, sucre et citron vert…</p>
</div>
```

### 5.4 Badge VIP

```html
<span class="text-[10px] uppercase tracking-wide bg-gold text-ink px-1.5 py-0.5 rounded font-bold">VIP</span>
```
Seul endroit du système où `gold` est utilisé en fond plein sur une petite surface — acceptable car le texte (`ink`, gras, très petit) reste parfaitement lisible.

### 5.5 Navigation

```html
<header class="border-b border-brick/40 bg-ink/95 backdrop-blur sticky top-0 z-10">
  <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
    <a class="font-display text-xl tracking-wide text-gold">Le Bar de Noa</a>
    <nav class="flex gap-8 text-xs uppercase tracking-caps text-muted">
      <a class="hover:text-gold transition-colors">Stock</a>
    </nav>
  </div>
</header>
```

### 5.6 Tableaux (stock)

- En-tête : `text-left text-gold-dim text-xs uppercase tracking-caps border-b border-cream/10`.
- Lignes : `border-b border-cream/10 last:border-0`.
- Nom de bouteille en `text-cream font-medium`, métadonnées (type, tags, notes) en `text-muted text-xs`.

## 6. Mise en page

- Conteneur global : `max-w-5xl mx-auto px-6`.
- Grilles de formulaire : `grid sm:grid-cols-2 gap-3`.
- Grilles de cartes (recettes, stock VIP) : `grid sm:grid-cols-2 gap-3` ou `gap-4`.
- Hero d'accueil : deux colonnes (`lg:grid-cols-2`), gauche = panneau `ink-2` avec dégradé radial d'ambiance, droite = panneau `brick` avec titre display, compteurs et prochaine soirée.
- Toujours responsive mobile-first : une seule colonne par défaut, `sm:`/`lg:` pour l'élargissement.

## 7. Ce qu'on ne fait jamais

- Pas de blanc pur (`#fff`) ni de gris neutre Tailwind par défaut (`neutral-*`, `gray-*`) — toujours passer par les tokens `ink`/`cream`/`muted`.
- Pas de deuxième couleur d'accent (pas de bleu, vert, violet) — seul l'or ponctue l'interface.
- Pas d'icônes/emojis dans les titres de section (le style typographique et la couleur suffisent à hiérarchiser).
- Pas de `box-shadow` ni de dégradés décoratifs en dehors du panneau hero de l'accueil.
- Pas de texte en `tracking-caps` au-delà de quelques mots (illisible sur des phrases longues).
