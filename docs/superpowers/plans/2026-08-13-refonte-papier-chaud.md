# Refonte « papier chaud » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le thème sombre orange et la navigation haute d'OpenBar par un thème clair « papier chaud » avec barre d'onglets basse, en corrigeant la densité typographique et les cibles tactiles.

**Architecture:** Refonte strictement front. On pose d'abord un harnais de vérification (contraste + audit navigateur), puis les tokens et la police, puis huit primitives partagées, puis la coquille de navigation, et enfin les écrans un par un — chaque écran étant validé par l'audit. Aucun fichier de `api/` n'est touché.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4 (`@theme`), TypeScript 5, `next/font/local`. Ajouts de développement : Vitest 3 (tests purs) et Playwright (audit navigateur).

## Global Constraints

Ces contraintes s'appliquent à **toutes** les tâches. Les valeurs sont copiées telles quelles depuis la spec `docs/superpowers/specs/2026-08-13-refonte-visuelle-et-navigation-design.md`.

- **Tokens de couleur, valeurs exactes :** `--paper #F3EFE7`, `--paper-sunk #E8E2D7`, `--ink #26221D`, `--ink-soft #6B6257`, `--rule #D9D1C4`, `--terracotta #A8452A`, `--done #4F6B43`, `--warn #8A5A12`.
- **Un seul accent.** `--terracotta` est la seule couleur d'action. Aucune autre teinte vive n'est introduite.
- **Thème clair unique.** Aucune variante sombre, aucun `prefers-color-scheme`, aucun `dark:` Tailwind.
- **Échelle typographique :** titre d'écran 27px sérif / titre de section 17px sans 600 / corps 15px sans / méta 13px sans / label 11px sérif majuscules espacées.
- **Plancher de 13px.** Aucun texte sous 13px dans un fichier refondu. `text-[10px]` et `text-[11px]` sont interdits sauf pour le label sérif en majuscules.
- **44px minimum** pour toute zone tactile (bouton, lien de liste, onglet, contrôle de formulaire), à 390px de large.
- **Aucune police externe.** Rien ne peut être chargé depuis `fonts.googleapis.com` ou `fonts.gstatic.com` à l'exécution ni au build.
- **Hors périmètre absolu :** `api/`, `prisma/`, et la signature des Server Actions. Un écran peut appeler d'autres actions existantes ; il ne peut pas en changer le contrat.
- **Langue :** toute chaîne visible est en français, y compris les états vides et les messages d'erreur.
- **Commits** en français, préfixe conventionnel (`feat:`, `refactor:`, `test:`, `chore:`), et terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Branche :** tout se fait sur `refonte/design-papier-chaud`, déjà créée. Rebase sur `main` avant chaque phase.

---

## Structure des fichiers

### Créés

| Fichier | Responsabilité |
|---|---|
| `src/lib/contrast.ts` | Calcul de luminance et de ratio de contraste — fonction pure |
| `src/lib/contrast.test.ts` | Vérifie que chaque paire de tokens atteint AA |
| `src/app/fonts/Lora-latin.woff2` | La sérif, variable, sous-ensemble latin |
| `src/components/ui/Button.tsx` | Bouton, 3 variantes, 44px imposés |
| `src/components/ui/Card.tsx` | Bloc de contenu |
| `src/components/ui/Field.tsx` | Label + champ + erreur |
| `src/components/ui/Badge.tsx` | Pastille de statut |
| `src/components/ui/Row.tsx` | Ligne de liste tactile |
| `src/components/ui/Sheet.tsx` | Panneau montant du bas |
| `src/components/ui/TabBar.tsx` | Barre d'onglets basse |
| `src/components/ui/EmptyState.tsx` | État vide |
| `src/components/ui/index.ts` | Ré-exports, point d'import unique |
| `src/app/moi/page.tsx` | Écran de renvois de l'onglet « Moi » |
| `e2e/audit.spec.ts` | Audit 44px + débordement horizontal |
| `e2e/fixtures.ts` | Fixture de session connectée |
| `playwright.config.ts` | Configuration Playwright |
| `vitest.config.ts` | Configuration Vitest |

### Modifiés

| Fichier | Nature du changement |
|---|---|
| `src/app/globals.css` | Palette remplacée, classes `glass-*`/`*-glow`/`vip-vault-card` supprimées |
| `src/app/layout.tsx` | `Outfit` retirée, `Lora` ajoutée, header allégé, `TabBar` montée, halos supprimés |
| `src/components/Navigation.tsx` | **Supprimé** — remplacé par `TabBar` |
| `src/app/stock/StockStudio.tsx` | Éclaté : la logique de liste reste, trois feuilles en sortent |
| `src/app/cocktails/CocktailStudio.tsx` | Sélecteur grille/liste retiré, reskin |
| `src/app/annuaire/page.tsx` | Devient une redirection permanente vers `/membres` |
| `src/app/bar/page.tsx` | **Supprimé** |
| `src/app/membres/page.tsx` | Absorbe le contenu de l'annuaire |
| ~35 autres `.tsx` | Reskin : classes legacy remplacées par les primitives |

---

## Phase A — Harnais et fondations

### Task 1: Harnais de contraste

Le premier vrai risque de cette refonte est un token illisible. On le rend impossible à introduire avant de poser la palette.

**Files:**
- Create: `src/lib/contrast.ts`
- Create: `src/lib/contrast.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: rien
- Produces: `relativeLuminance(hex: string): number`, `contrastRatio(a: string, b: string): number` — utilisées uniquement par les tests

- [ ] **Step 1: Installer Vitest**

```bash
npm install -D vitest@^3
```

- [ ] **Step 2: Configurer Vitest**

Créer `vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node seul : ces tests sont des fonctions pures, pas du rendu.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Ajouter à `package.json`, dans `scripts` :

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Écrire le test qui échoue**

Créer `src/lib/contrast.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

const PAPER = "#F3EFE7";
const SUNK = "#E8E2D7";
const AA = 4.5;

describe("contrastRatio", () => {
  it("rend 21 pour noir sur blanc", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("rend 1 pour une couleur contre elle-même", () => {
    expect(contrastRatio(PAPER, PAPER)).toBeCloseTo(1, 5);
  });

  it("est symétrique", () => {
    expect(contrastRatio("#26221D", PAPER)).toBeCloseTo(
      contrastRatio(PAPER, "#26221D"),
      5,
    );
  });

  it("accepte les hex à 3 chiffres", () => {
    expect(contrastRatio("#000", "#FFF")).toBeCloseTo(21, 1);
  });
});

// Le vrai objet du test : la palette de la spec. Si quelqu'un éclaircit un
// token, ce test tombe avant que l'écran illisible n'atteigne un utilisateur.
describe("palette papier chaud", () => {
  const surTexte: Array<[string, string, string]> = [
    ["--ink", "#26221D", PAPER],
    ["--ink-soft", "#6B6257", PAPER],
    ["--ink-soft sur enfoncé", "#6B6257", SUNK],
    ["--terracotta", "#A8452A", PAPER],
    ["--done", "#4F6B43", PAPER],
    ["--warn", "#8A5A12", PAPER],
    ["blanc sur --terracotta", "#FFFFFF", "#A8452A"],
  ];

  it.each(surTexte)("%s atteint AA", (_nom, avant, arriere) => {
    expect(contrastRatio(avant, arriere)).toBeGreaterThanOrEqual(AA);
  });

  it("rejette la valeur d'origine de --ink-soft, qui échouait", () => {
    // #776E62 venait de la maquette et donnait 4.37 sur papier.
    // Ce test documente pourquoi elle a été assombrie.
    expect(contrastRatio("#776E62", PAPER)).toBeLessThan(AA);
  });
});
```

- [ ] **Step 4: Lancer le test et vérifier qu'il échoue**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./contrast"`

- [ ] **Step 5: Implémenter**

Créer `src/lib/contrast.ts` :

```ts
/**
 * Contraste WCAG 2.1. Sert au test de la palette : un token de texte qui
 * n'atteint pas 4.5:1 doit faire échouer la suite, pas arriver en production.
 */

function expandHex(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length === 3) {
    return raw
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return raw;
}

function channelLuminance(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const raw = expandHex(hex);
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
    throw new Error(`Couleur hex invalide : ${hex}`);
  }
  const [r, g, b] = [0, 2, 4].map((i) =>
    channelLuminance(parseInt(raw.slice(i, i + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const clair = Math.max(la, lb);
  const sombre = Math.min(la, lb);
  return (clair + 0.05) / (sombre + 0.05);
}
```

- [ ] **Step 6: Lancer le test et vérifier qu'il passe**

Run: `npm test`
Expected: PASS — 12 tests (4 sur `contrastRatio`, 7 paires de palette, 1 sur la valeur rejetée)

- [ ] **Step 7: Prouver que le test mord**

Remplacer temporairement `["--ink-soft", "#6B6257", PAPER]` par `["--ink-soft", "#998C7E", PAPER]` et relancer.
Expected: FAIL sur `--ink-soft atteint AA`. Puis remettre `#6B6257` et vérifier que ça repasse.

Un test de seuil qui n'a jamais été vu échouer ne prouve rien.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/contrast.ts src/lib/contrast.test.ts
git commit -m "test: verrouille les contrastes de la palette papier chaud

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: La police sérif

**Files:**
- Create: `src/app/fonts/Lora-latin.woff2`
- Delete: `src/app/fonts/Outfit-500.woff2`, `Outfit-600.woff2`, `Outfit-700.woff2`, `Outfit-800.woff2`
- Modify: `src/app/layout.tsx:25-47`

**Interfaces:**
- Consumes: rien
- Produces: la variable CSS `--font-lora`, consommée par `globals.css` en Task 3

- [ ] **Step 1: Récupérer le fichier**

Ne **jamais** coder en dur une URL `fonts.gstatic.com` : c'est précisément le hash figé qui a cassé le déploiement (PR #80). On demande à l'API sa réponse du jour, puis on télécharge ce qu'elle indique.

```bash
cd /Users/seonay/Claude/Projects/bardenoa
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
URL=$(curl -sS -H "User-Agent: $UA" \
  "https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap" \
  | grep -B6 "U+0000-00FF" | grep -o "https://[^)]*woff2" | head -1)
echo "Source : $URL"
curl -sS "$URL" -o src/app/fonts/Lora-latin.woff2
ls -l src/app/fonts/Lora-latin.woff2
```

Expected: un fichier d'environ 37 Ko. Lora est servie en police variable — ce seul fichier couvre les graisses 400 à 700.

- [ ] **Step 2: Vérifier que c'est bien un woff2 et qu'il est variable**

```bash
head -c 4 src/app/fonts/Lora-latin.woff2 | xxd | head -1
```

Expected: la signature `wOF2`. Si la sortie ressemble à du HTML, le téléchargement a récupéré une page d'erreur — reprendre l'étape 1.

- [ ] **Step 3: Retirer Outfit, déclarer Lora**

Dans `src/app/layout.tsx`, remplacer le bloc `const outfit = localFont({...})` (lignes 25-36) par :

```ts
const lora = localFont({
  src: [{ path: "./fonts/Lora-latin.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-lora",
  display: "swap",
  // `adjustFontFallback` n'accepte que 'Arial' | 'Times New Roman' | false.
  // On prend la seule sérif de la liste : les métriques de repli se calent
  // ainsi sur une sérif, ce qui limite le saut de gabarit à la substitution.
  adjustFontFallback: "Times New Roman",
});
```

Puis, ligne 82, remplacer `${outfit.variable}` par `${lora.variable}`.

- [ ] **Step 4: Supprimer les fichiers Outfit**

```bash
git rm src/app/fonts/Outfit-500.woff2 src/app/fonts/Outfit-600.woff2 \
       src/app/fonts/Outfit-700.woff2 src/app/fonts/Outfit-800.woff2
```

- [ ] **Step 5: Vérifier qu'aucune référence à Outfit ne subsiste**

```bash
grep -rn "outfit\|Outfit" src/ ; echo "exit=$?"
```

Expected: `exit=1` (aucune correspondance). `--font-outfit` est encore référencé dans `globals.css:30` — c'est attendu, la Task 3 le remplace. Si la commande ressort `globals.css` uniquement, continuer.

- [ ] **Step 6: Vérifier qu'aucune police externe n'est chargée**

Le commentaire d'en-tête de `layout.tsx` *mentionne* `next/font/google` et `fonts.gstatic.com` pour expliquer pourquoi on ne s'en sert plus. Un `grep` nu le compte donc comme une occurrence. Ce qu'on veut vérifier, c'est le code, pas la prose :

```bash
grep -rn "fonts.googleapis\|fonts.gstatic\|next/font/google" src/ \
  | grep -v "^\S*: *\*" | grep -v "^\S*: *//" ; echo "exit=$?"
```

Expected: `exit=1` — aucune occurrence hors commentaire.

- [ ] **Step 7: Commit**

```bash
git add -A src/app/fonts src/app/layout.tsx
git commit -m "feat: remplace Outfit par Lora, auto-hebergee

Lora est servie en police variable : un fichier de 37 Ko couvre 400 a 700.
Bilan net, quatre fichiers de police en moins pour un ajoute.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Les tokens

**Files:**
- Modify: `src/app/globals.css` (réécriture complète, 195 → ~120 lignes)

**Interfaces:**
- Consumes: `--font-lora` (Task 2)
- Produces: les classes Tailwind `bg-paper`, `bg-paper-sunk`, `text-ink`, `text-ink-soft`, `border-rule`, `text-terracotta`, `bg-terracotta`, `text-done`, `text-warn`, plus `font-display` (sérif) et `font-sans` — consommées par toutes les tâches suivantes

- [ ] **Step 1: Réécrire le bloc `@theme`**

Dans `src/app/globals.css`, remplacer les lignes 3 à 36 par :

```css
@theme {
  /* Papier chaud. Six rôles, deux statuts, un seul accent.
     Les valeurs sont verrouillées par src/lib/contrast.test.ts — les changer
     sans relancer les tests casse la lisibilité. */
  --color-paper: #F3EFE7;
  --color-paper-sunk: #E8E2D7;
  --color-ink: #26221D;
  --color-ink-soft: #6B6257;
  --color-rule: #D9D1C4;
  --color-terracotta: #A8452A;
  --color-done: #4F6B43;
  --color-warn: #8A5A12;

  --font-display: var(--font-lora), Georgia, serif;
  --font-sans: var(--font-jakarta), sans-serif;

  /* Échelle de la spec. Le plancher est 13px : plus rien en dessous. */
  --text-meta: 0.8125rem;   /* 13px */
  --text-body: 0.9375rem;   /* 15px */
  --text-section: 1.0625rem; /* 17px */
  --text-screen: 1.6875rem; /* 27px */

  --breakpoint-xs: 25rem;
}
```

Les neuf `--color-cat-*` disparaissent : la spec impose un seul accent, les catégories se distinguent par leur libellé, pas par neuf teintes.

- [ ] **Step 2: Réécrire les styles de base**

Remplacer les lignes 38 à 68 par :

```css
:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
}

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: none;
  overflow-wrap: break-word;
}

h1, h2, h3, .font-display {
  font-family: var(--font-display);
  font-weight: 400;
  letter-spacing: 0;
}

input, select, textarea {
  color-scheme: light;
  font-family: var(--font-sans);
}
```

`color-scheme` passe de `dark` à `light` : c'est ce qui pilote la couleur native des sélecteurs de date et des cases à cocher. L'oublier laisse des contrôles noirs sur fond papier.

- [ ] **Step 3: Supprimer les classes mortes**

Supprimer intégralement de `globals.css` : `.orange-glow`, `.gold-glow`, `.box-orange-glow`, `.box-orange-glow-hover`, `.glass-card`, `.glass-card-hover`, `.vip-vault-card` (lignes 94-138 de l'original).

Remplacer la barre de défilement personnalisée par :

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--color-paper-sunk); }
::-webkit-scrollbar-thumb { background: var(--color-rule); border-radius: 3px; }
```

Conserver sans y toucher : `.tracking-caps`, `.no-scrollbar`, `.scrollbar-thin`, `.pb-safe`, `.pb-safe-0`, `.bottom-safe`, le bloc `@media (max-width: 639px)` sur les champs, le bloc `.tap-target`, et le bloc `prefers-reduced-motion`.

- [ ] **Step 4: Renforcer la règle des 44px**

Le bloc `.tap-target` actuel n'applique 44px que sous `@media (pointer: coarse)`, et `.tap-target-sm` autorise 36px — sous le seuil de la spec. Remplacer les lignes 79-88 par :

```css
/* 44px est le minimum iOS/Android. La spec en fait une règle sans exception,
   donc plus de variante réduite et plus de conditionnement au type de pointeur :
   un audit à 390px doit pouvoir la vérifier dans un navigateur de test. */
.tap-target {
  min-height: 44px;
  min-width: 44px;
}
```

Toute occurrence de `tap-target-sm` dans `src/` devra devenir `tap-target` au fil des tâches d'écran.

- [ ] **Step 5: Vérifier que la compilation passe**

Run: `npm run build`
Expected: le build réussit. L'application est à ce stade franchement laide — les pages portent encore des classes sombres (`bg-ink-2`, `text-cream`, `text-orange`) qui ne correspondent plus à aucun token. C'est attendu et corrigé écran par écran en phase D.

Noter que `bg-ink` continue de fonctionner mais désigne désormais **le texte quasi noir**, plus le fond. Les fonds sombres résiduels apparaîtront donc en noir jusqu'à leur reskin.

- [ ] **Step 6: Vérifier que les tests de contraste passent toujours**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: pose les tokens papier chaud

Palette de 14 couleurs ramenee a 6 roles et 2 statuts. Glassmorphism,
lueurs et degrades supprimes. Plancher typographique a 13px.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase B — Primitives

Chaque primitive suit le même schéma : fichier autonome dans `src/components/ui/`, props typées, aucune dépendance à une page. Elles sont testées par l'audit navigateur de la Task 12, pas par des tests unitaires de rendu — un test qui affirme qu'un bouton porte la classe `bg-terracotta` ne vérifie rien qu'une relecture ne voie.

### Task 4: Button

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: tokens de la Task 3
- Produces: `<Button variant="principal" | "discret" | "danger" size="normal" | "pleine">` — accepte toutes les props d'un `<button>` natif. Utilisé par toutes les tâches d'écran.

- [ ] **Step 1: Écrire le composant**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "principal" | "discret" | "danger";

const VARIANTS: Record<Variant, string> = {
  principal: "bg-terracotta text-paper hover:bg-terracotta/90 border-transparent",
  discret: "bg-transparent text-ink border-rule hover:bg-paper-sunk",
  danger: "bg-transparent text-terracotta border-terracotta/40 hover:bg-terracotta/10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pleineLargeur?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = "principal",
  pleineLargeur = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // 44px est impose ici plutot que laisse a chaque appelant : c'est la
      // seule facon que la regle tienne sur une quarantaine d'ecrans.
      className={`min-h-[44px] px-4 rounded-lg border text-[15px] font-semibold
        inline-flex items-center justify-center gap-2 transition-colors
        disabled:opacity-45 disabled:pointer-events-none
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta
        ${VARIANTS[variant]} ${pleineLargeur ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Créer le point d'import**

Créer `src/components/ui/index.ts` :

```ts
export { default as Button } from "./Button";
```

Ce fichier grandit à chaque primitive. Il permet à un écran d'écrire `import { Button, Card, Row } from "@/components/ui"` au lieu de trois lignes.

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): ajoute la primitive Button

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Card et EmptyState

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `Button` (Task 4)
- Produces: `<Card filet?: boolean>`, `<EmptyState titre message action?>`

- [ ] **Step 1: Écrire Card**

```tsx
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Sans filet, la carte n'est qu'une zone de fond — utile en liste dense. */
  filet?: boolean;
  children: ReactNode;
}

export default function Card({
  filet = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-xl bg-paper p-4 ${filet ? "border border-rule" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Écrire EmptyState**

```tsx
import type { ReactNode } from "react";

interface EmptyStateProps {
  titre: string;
  message: string;
  /** L'action qui sort de l'état vide. Omise quand il n'y en a pas. */
  action?: ReactNode;
}

export default function EmptyState({ titre, message, action }: EmptyStateProps) {
  return (
    <div className="py-12 px-4 text-center">
      <p className="font-display text-[17px] text-ink">{titre}</p>
      <p className="mt-2 text-[13px] text-ink-soft max-w-xs mx-auto">{message}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 3: Étendre l'index**

```ts
export { default as Button } from "./Button";
export { default as Card } from "./Card";
export { default as EmptyState } from "./EmptyState";
```

- [ ] **Step 4: Vérifier et commiter**

Run: `npx tsc --noEmit`
Expected: aucune erreur

```bash
git add src/components/ui/
git commit -m "feat(ui): ajoute les primitives Card et EmptyState

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Field et Badge

**Files:**
- Create: `src/components/ui/Field.tsx`
- Create: `src/components/ui/Badge.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: tokens de la Task 3
- Produces: `<Field label htmlFor erreur? aide?>`, `<Badge ton="neutre" | "complet" | "alerte">`

- [ ] **Step 1: Écrire Field**

`Field` enveloppe un champ ; il ne le rend pas lui-même, pour rester utilisable avec `<input>`, `<select>`, `<textarea>` et les composants existants comme `ImagePicker`.

```tsx
import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  /** Doit correspondre à l'`id` du contrôle enfant, sinon le label ne le cible pas. */
  htmlFor: string;
  aide?: string;
  erreur?: string;
  children: ReactNode;
}

export default function Field({ label, htmlFor, aide, erreur, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink mb-1.5">
        {label}
      </label>
      {children}
      {aide && !erreur ? <p className="mt-1 text-[13px] text-ink-soft">{aide}</p> : null}
      {erreur ? (
        <p className="mt-1 text-[13px] text-terracotta" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

/** Classes à poser sur le contrôle enfant, pour que tous les champs concordent. */
export const champClasses =
  "w-full min-h-[44px] px-3 rounded-lg bg-paper-sunk border border-rule text-ink " +
  "text-[15px] placeholder:text-ink-soft " +
  "focus:outline-2 focus:outline-offset-0 focus:outline-terracotta focus:border-terracotta";
```

- [ ] **Step 2: Écrire Badge**

```tsx
import type { ReactNode } from "react";

type Ton = "neutre" | "complet" | "alerte";

const TONS: Record<Ton, string> = {
  neutre: "text-ink-soft border-rule",
  complet: "text-done border-done/35",
  alerte: "text-warn border-warn/35",
};

interface BadgeProps {
  ton?: Ton;
  children: ReactNode;
}

export default function Badge({ ton = "neutre", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5
        text-[13px] font-medium whitespace-nowrap ${TONS[ton]}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Étendre l'index**

```ts
export { default as Button } from "./Button";
export { default as Card } from "./Card";
export { default as EmptyState } from "./EmptyState";
export { default as Field, champClasses } from "./Field";
export { default as Badge } from "./Badge";
```

- [ ] **Step 4: Vérifier et commiter**

Run: `npx tsc --noEmit`
Expected: aucune erreur

```bash
git add src/components/ui/
git commit -m "feat(ui): ajoute les primitives Field et Badge

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Row

**Files:**
- Create: `src/components/ui/Row.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: tokens de la Task 3
- Produces: `<Row titre sousTitre? droite? href? onClick? chevron?>`

- [ ] **Step 1: Écrire le composant**

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

interface RowProps {
  titre: ReactNode;
  sousTitre?: ReactNode;
  /** Contenu aligné à droite : un Badge, un compteur, un prix. */
  droite?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
}

export default function Row({ titre, sousTitre, droite, href, onClick, chevron }: RowProps) {
  const contenu = (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-ink truncate">{titre}</div>
        {sousTitre ? (
          <div className="text-[13px] text-ink-soft truncate mt-0.5">{sousTitre}</div>
        ) : null}
      </div>
      {droite ? <div className="shrink-0">{droite}</div> : null}
      {chevron ? (
        <span aria-hidden className="shrink-0 text-ink-soft text-[15px]">
          ›
        </span>
      ) : null}
    </>
  );

  // 44px de haut, un filet en bas : c'est la liste de la maquette. Le filet
  // remplace la carte, c'est ce qui allège la densité perçue.
  const classes =
    "w-full min-h-[44px] py-3 flex items-center gap-3 text-left " +
    "border-b border-rule last:border-b-0";

  if (href) {
    return (
      <Link href={href} className={`${classes} active:bg-paper-sunk`}>
        {contenu}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classes} active:bg-paper-sunk`}>
        {contenu}
      </button>
    );
  }
  return <div className={classes}>{contenu}</div>;
}
```

- [ ] **Step 2: Étendre l'index et vérifier**

Ajouter `export { default as Row } from "./Row";`

Run: `npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): ajoute la primitive Row

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Sheet

C'est le changement de manipulation de la spec : le tiroir latéral devient un panneau qui monte du bas.

**Files:**
- Create: `src/components/ui/Sheet.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: tokens de la Task 3
- Produces: `<Sheet ouvert titre onFermer>` — utilisé par la Task 15 (stock) et la Task 16 (cocktails)

- [ ] **Step 1: Écrire le composant**

```tsx
"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

interface SheetProps {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}

export default function Sheet({ ouvert, titre, onFermer, children }: SheetProps) {
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    // Sans cela, le fond continue de défiler derrière la feuille sur iOS.
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = overflowPrecedent;
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onFermer}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="relative bg-paper rounded-t-2xl border-t border-rule
          max-h-[88vh] flex flex-col pb-safe-0"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
          <h2 className="font-display text-[17px] text-ink truncate">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center
              text-ink-soft text-[20px]"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Étendre l'index et vérifier**

Ajouter `export { default as Sheet } from "./Sheet";`

Run: `npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): ajoute la primitive Sheet

Panneau montant du bas, atteignable au pouce, en remplacement des
tiroirs lateraux pleine hauteur.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: TabBar

**Files:**
- Create: `src/components/ui/TabBar.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: tokens de la Task 3
- Produces: `<TabBar />` — monté une fois par `src/app/layout.tsx` en Task 11

- [ ] **Step 1: Écrire le composant**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/soirees", libelle: "Soirée", icone: "◗" },
  { href: "/stock", libelle: "Cave", icone: "▤" },
  { href: "/cocktails", libelle: "Cocktails", icone: "◍" },
  { href: "/moi", libelle: "Moi", icone: "◔" },
] as const;

export default function TabBar() {
  const chemin = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 inset-x-0 z-50 bg-paper border-t border-rule pb-safe-0"
    >
      <ul className="flex">
        {ONGLETS.map(({ href, libelle, icone }) => {
          // `startsWith` pour que /soirees/xyz garde l'onglet Soirée allumé.
          const actif = chemin === href || chemin.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 py-1.5
                  text-[13px] font-medium
                  ${actif ? "text-terracotta shadow-[inset_0_2px_0_var(--color-terracotta)]" : "text-ink-soft"}`}
              >
                <span aria-hidden className="text-[17px] leading-none">
                  {icone}
                </span>
                {libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Étendre l'index et vérifier**

Ajouter `export { default as TabBar } from "./TabBar";`

Run: `npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): ajoute la primitive TabBar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Reskin des modales existantes

`ModalShell`, `NoticeModal` et `ConfirmDeleteModal` fonctionnent et sont utilisés partout. On change leurs couleurs et leurs tailles, pas leur API — aucun appelant ne doit être modifié.

**Files:**
- Modify: `src/components/ModalShell.tsx`
- Modify: `src/components/NoticeModal.tsx`
- Modify: `src/components/ConfirmDeleteModal.tsx`

**Interfaces:**
- Consumes: `Button` (Task 4), tokens (Task 3)
- Produces: aucune signature nouvelle — les props restent identiques

- [ ] **Step 1: Relever les props actuelles**

```bash
grep -n "interface\|type .*Props\|export default function" \
  src/components/ModalShell.tsx src/components/NoticeModal.tsx src/components/ConfirmDeleteModal.tsx
```

Noter les signatures exactes. Elles ne doivent pas changer.

- [ ] **Step 2: Remplacer les couleurs**

Dans les trois fichiers, appliquer la correspondance suivante :

| Ancien | Nouveau |
|---|---|
| `bg-ink`, `bg-ink-2`, `bg-ink-3` | `bg-paper` |
| `text-cream` | `text-ink` |
| `text-muted` | `text-ink-soft` |
| `text-orange`, `text-gold` | `text-terracotta` |
| `bg-orange` | `bg-terracotta` |
| `border-white/[0.08]`, `border-white/10` | `border-rule` |
| `glass-card`, `box-orange-glow` | *(supprimer la classe)* |
| `backdrop-blur-*` | *(supprimer la classe)* |
| `text-[10px]`, `text-[11px]` | `text-[13px]` |
| `text-xs` | `text-[13px]` |

Remplacer les boutons d'action par `<Button>` de la Task 4.

- [ ] **Step 3: Vérifier qu'aucun appelant n'est cassé**

Run: `npx tsc --noEmit`
Expected: aucune erreur — c'est la preuve que les signatures n'ont pas bougé.

- [ ] **Step 4: Commit**

```bash
git add src/components/ModalShell.tsx src/components/NoticeModal.tsx src/components/ConfirmDeleteModal.tsx
git commit -m "refactor(ui): reskin des modales en papier chaud

API inchangee : aucun appelant modifie.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase C — Coquille et audit

### Task 11: Le layout racine

**Files:**
- Modify: `src/app/layout.tsx:60-144`
- Delete: `src/components/Navigation.tsx`

**Interfaces:**
- Consumes: `TabBar` (Task 9)
- Produces: la coquille sur laquelle tous les écrans de la phase D s'appuient

- [ ] **Step 1: Corriger le viewport**

Ligne 67, remplacer `themeColor: "#110d0c"` par `themeColor: "#F3EFE7"`.

Lignes 52-56, remplacer `statusBarStyle: "black-translucent"` par `statusBarStyle: "default"` — sur fond clair, `black-translucent` rend l'heure et la batterie illisibles en mode application installée.

- [ ] **Step 2: Remplacer le corps du layout**

Remplacer les lignes 81 à 143 par :

```tsx
  return (
    <html lang="fr" className={`h-full ${lora.variable} ${jakarta.variable}`}>
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans antialiased overflow-x-hidden">
        <header className="border-b border-rule bg-paper sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 h-[52px] flex items-center justify-between gap-3">
            <Link href="/" className="font-display text-[17px] text-ink truncate">
              {activeBar?.name ?? "OpenBar"}
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              {session && !activeBar && (
                <Link
                  href="/creer"
                  className="min-h-[44px] flex items-center text-[13px] font-semibold text-terracotta"
                >
                  Crée ton bar
                </Link>
              )}
              {activeBar && bars.length > 1 && (
                <BarSwitcher bars={bars} activeBarId={activeBar.id} />
              )}
              <AccountMenu session={session} avatarUrl={profile?.avatarUrl ?? null} />
            </div>
          </div>
        </header>

        {/* pb-24 réserve la hauteur de la TabBar : sans cela le dernier élément
            de chaque page passe dessous et devient intouchable. */}
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-5 pb-24">
          {children}
        </main>

        {session ? <TabBar /> : null}
      </body>
    </html>
  );
```

Trois disparitions : les deux `div` de halo ambiant (lignes 86-89), le `footer`, et `<Navigation />`. `max-w-7xl` devient `max-w-3xl` — la spec conçoit pour 390px, un rail de 1280px sur desktop étire les lignes de texte au-delà du lisible.

- [ ] **Step 3: Mettre à jour les imports**

Retirer `import Navigation from "@/components/Navigation";`, ajouter `import { TabBar } from "@/components/ui";`.

- [ ] **Step 4: Supprimer Navigation**

```bash
git rm src/components/Navigation.tsx
grep -rn "components/Navigation" src/ ; echo "exit=$?"
```

Expected: `exit=1`

- [ ] **Step 5: Créer l'écran « Moi »**

`TabBar` pointe vers `/moi`, qui n'existe pas encore — sans lui le quatrième onglet est un 404. Créer `src/app/moi/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listMyBars } from "@/lib/api-client";
import { resolveActiveBar } from "@/lib/active-bar";
import { Row } from "@/components/ui";

export default async function MoiPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  const estProprietaire = activeBar?.myRole === "OWNER";

  return (
    <div>
      <h1 className="font-display text-[27px] text-ink mb-5">Moi</h1>

      <section className="mb-7">
        <h2 className="text-[11px] font-display uppercase tracking-caps text-ink-soft mb-1">
          Mon compte
        </h2>
        <Row titre="Profil" href="/profil" chevron />
        <Row titre="Changer mon mot de passe" href="/changer-mot-de-passe" chevron />
      </section>

      {activeBar ? (
        <section className="mb-7">
          <h2 className="text-[11px] font-display uppercase tracking-caps text-ink-soft mb-1">
            {activeBar.name}
          </h2>
          <Row titre="Membres" href="/membres" chevron />
          {/* Comptes et journal sont des outils de gestion : le propriétaire
              seul les voit, comme le veut la spec. */}
          {estProprietaire ? (
            <>
              <Row titre="Comptes" href="/comptes" chevron />
              <Row titre="Journal" href="/journal" chevron />
            </>
          ) : null}
        </section>
      ) : null}

      <section className="mb-7">
        <h2 className="text-[11px] font-display uppercase tracking-caps text-ink-soft mb-1">
          Ailleurs
        </h2>
        <Row titre="Découvrir des bars" href="/decouvrir" chevron />
        <Row titre="Créer un bar" href="/creer" chevron />
        {session.role === "ADMIN" ? (
          <Row titre="Administration" href="/admin" chevron />
        ) : null}
      </section>
    </div>
  );
}
```

Vérifier que `activeBar` expose bien `name` et `myRole` avant d'écrire ce fichier :

```bash
grep -n "name\|myRole" src/lib/active-bar.ts | head
```

- [ ] **Step 6: Vérifier**

Run: `npm run build`
Expected: le build réussit

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A src/app/layout.tsx src/app/moi src/components/
git commit -m "feat: barre d'onglets basse et coquille papier chaud

Navigation haute et halos supprimes. Quatre destinations : Soiree, Cave,
Cocktails, Moi. La largeur passe de 7xl a 3xl.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: L'audit navigateur

Sans ce harnais, les critères « 44px » et « aucun débordement » de la spec sont des intentions. Il devient la porte de sortie de chaque tâche d'écran.

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/fixtures.ts`
- Create: `e2e/audit.spec.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: la coquille (Task 11)
- Produces: `npm run audit` — la commande de validation de toutes les tâches de phase D

- [ ] **Step 1: Installer Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Ignorer les artefacts**

Ajouter à `.gitignore` :

```
# Playwright
/test-results/
/playwright-report/
/e2e/.auth/
```

- [ ] **Step 3: Configurer**

Créer `playwright.config.ts` :

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Un seul worker : les tests partagent une base et une session.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.AUDIT_BASE_URL ?? "http://localhost:3000",
    // 390px est la largeur de l'iPhone 14/15. La spec conçoit à cette taille.
    ...devices["iPhone 14"],
  },
});
```

- [ ] **Step 4: Écrire la fixture de session**

Créer `e2e/fixtures.ts` :

```ts
import { test as base, expect, type Page } from "@playwright/test";

const EMAIL = process.env.AUDIT_EMAIL;
const MOT_DE_PASSE = process.env.AUDIT_PASSWORD;

export async function seConnecter(page: Page) {
  if (!EMAIL || !MOT_DE_PASSE) {
    throw new Error(
      "AUDIT_EMAIL et AUDIT_PASSWORD doivent pointer vers un compte de test. " +
        "Ne jamais utiliser un compte reel.",
    );
  }
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(EMAIL);
  await page.getByLabel(/mot de passe/i).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await seConnecter(page);
    await use(page);
  },
});

export { expect };
```

- [ ] **Step 5: Écrire l'audit**

Créer `e2e/audit.spec.ts` :

```ts
import { test, expect } from "./fixtures";

/**
 * Les pages refondues. On en ajoute une à chaque tâche de la phase D —
 * une page absente de cette liste n'est pas auditée, donc pas terminée.
 */
const PAGES = [
  "/soirees",
  "/stock",
  "/cocktails",
  "/moi",
  "/profil",
  "/membres",
  "/comptes",
  "/journal",
  "/decouvrir",
];

for (const chemin of PAGES) {
  test.describe(chemin, () => {
    test("ne déborde pas horizontalement", async ({ page }) => {
      await page.goto(chemin);
      await page.waitForLoadState("networkidle");

      const debordement = await page.evaluate(() => {
        const el = document.documentElement;
        return { scroll: el.scrollWidth, client: el.clientWidth };
      });

      // Un pixel de tolérance : les sous-pixels d'arrondi ne sont pas un bug.
      expect(
        debordement.scroll - debordement.client,
        `débordement de ${debordement.scroll - debordement.client}px`,
      ).toBeLessThanOrEqual(1);
    });

    test("n'a aucune cible tactile sous 44px", async ({ page }) => {
      await page.goto(chemin);
      await page.waitForLoadState("networkidle");

      const trop_petits = await page.evaluate(() => {
        const selecteur = "a[href], button, input, select, textarea, [role=button]";
        const fautifs: Array<{ balise: string; texte: string; h: number; w: number }> = [];

        for (const el of document.querySelectorAll(selecteur)) {
          const r = el.getBoundingClientRect();
          // Les éléments masqués n'ont pas de cible à mesurer.
          if (r.width === 0 || r.height === 0) continue;
          // Un lien à l'intérieur d'un paragraphe n'est pas un contrôle : sa
          // hauteur est celle de la ligne de texte, la règle ne s'y applique pas.
          if (el.tagName === "A" && el.closest("p")) continue;
          if (r.height < 44 || r.width < 44) {
            fautifs.push({
              balise: el.tagName,
              texte: (el.textContent ?? "").trim().slice(0, 40),
              h: Math.round(r.height),
              w: Math.round(r.width),
            });
          }
        }
        return fautifs;
      });

      expect(trop_petits, JSON.stringify(trop_petits, null, 2)).toEqual([]);
    });

    test("n'affiche aucun texte sous 13px", async ({ page }) => {
      await page.goto(chemin);
      await page.waitForLoadState("networkidle");

      const trop_petits = await page.evaluate(() => {
        const fautifs: Array<{ texte: string; taille: string }> = [];
        const parcours = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let noeud: Node | null;
        while ((noeud = parcours.nextNode())) {
          const texte = (noeud.textContent ?? "").trim();
          if (!texte) continue;
          const parent = noeud.parentElement;
          if (!parent) continue;
          const taille = parseFloat(getComputedStyle(parent).fontSize);
          if (taille < 13) fautifs.push({ texte: texte.slice(0, 40), taille: `${taille}px` });
        }
        return fautifs;
      });

      expect(trop_petits, JSON.stringify(trop_petits, null, 2)).toEqual([]);
    });
  });
}
```

- [ ] **Step 6: Ajouter la commande**

Dans `package.json`, `scripts` :

```json
"audit": "playwright test"
```

- [ ] **Step 7: Lancer l'audit et constater l'échec**

Dans un terminal : `npm run build && npm start`
Dans un autre :

```bash
AUDIT_EMAIL=<compte de test> AUDIT_PASSWORD=<mot de passe> npm run audit
```

Expected: **de nombreux échecs.** C'est le résultat correct à ce stade — seule la coquille est refondue, les neuf pages ne le sont pas. Relever le nombre d'échecs : c'est la référence que la phase D doit ramener à zéro.

Utiliser un compte de test dédié. Ne pas mettre d'identifiants réels dans le dépôt ni dans un fichier commité.

- [ ] **Step 8: Commit**

```bash
git add playwright.config.ts e2e/ package.json package-lock.json .gitignore
git commit -m "test: audit navigateur des cibles tactiles et de la densite

Verifie a 390px, viewport reel : aucune cible sous 44px, aucun texte
sous 13px, aucun debordement horizontal.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase D — Les écrans

Chaque tâche de cette phase suit la même boucle, décrite une fois ici et référencée ensuite :

1. Lancer l'audit sur la page visée, relever les échecs.
2. Remplacer les classes legacy par les primitives, selon la table de correspondance de la Task 10 Step 2.
3. Relancer l'audit sur cette page : zéro échec.
4. Vérifier le parcours fonctionnel de la page à la main.
5. Commiter.

La table de correspondance est reproduite ici pour éviter d'avoir à revenir en arrière :

| Ancien | Nouveau |
|---|---|
| `bg-ink`, `bg-ink-2`, `bg-ink-3`, `bg-brick*` | `bg-paper` ou `bg-paper-sunk` |
| `text-cream` | `text-ink` |
| `text-muted`, `text-gold-dim` | `text-ink-soft` |
| `text-orange`, `text-gold`, `text-orange-hover` | `text-terracotta` |
| `bg-orange`, `bg-gradient-to-*` | `bg-terracotta` (aplat, jamais de dégradé) |
| `border-white/[0.0x]` | `border-rule` |
| `glass-card`, `box-orange-glow`, `vip-vault-card`, `*-glow` | *(supprimer)* |
| `backdrop-blur-*`, `shadow-[0_0_*]` | *(supprimer)* |
| `text-[10px]`, `text-[11px]`, `text-xs` | `text-[13px]` |
| `text-sm` | `text-[15px]` |
| `tap-target-sm` | `tap-target` |
| `text-cat-*` | *(supprimer — un seul accent)* |

---

### Task 13: Soirées

**Files:**
- Modify: `src/app/soirees/page.tsx` (266 lignes)
- Modify: `src/app/soirees/[slug]/page.tsx`
- Modify: `src/app/soirees/[slug]/GuestPanel.tsx` (340 lignes)
- Modify: `src/app/soirees/[slug]/MediaGallery.tsx` (221 lignes)
- Modify: `src/app/soirees/[slug]/WishlistSection.tsx`
- Modify: `src/app/soirees/[slug]/DiscordActions.tsx`
- Modify: `src/app/soirees/CalendarSubscribe.tsx`
- Modify: `src/app/soirees/CopyLink.tsx`
- Modify: `src/app/soirees/DeleteEventButton.tsx`
- Modify: `src/app/soirees/ShareButton.tsx`

**Interfaces:**
- Consumes: `Button`, `Card`, `Row`, `Badge`, `EmptyState`, `Sheet`
- Produces: rien de réutilisé ailleurs

- [ ] **Step 1: Reskin de la liste**

`src/app/soirees/page.tsx` : chaque soirée devient un `<Row>` avec la date en sous-titre et un `<Badge>` d'état à droite. La liste vide utilise `<EmptyState>`. La pagination existante (`Pagination`/`PaginationLinks`) est conservée telle quelle, seulement reskinnée.

- [ ] **Step 2: Réordonner l'écran de détail**

`src/app/soirees/[slug]/page.tsx` : « À ramener » passe **en premier**, juste sous le titre. Le bilan, le panneau invité, la galerie et le bloc Discord passent dessous, chacun dans une `<section>` avec un titre de section à 17px.

C'est le seul changement d'ordre de la refonte ; il vient directement de la spec (« la page répond d'abord à *qu'est-ce que je fais maintenant* »).

- [ ] **Step 3: Reskin de GuestPanel et MediaGallery**

Appliquer la table de correspondance. Dans `MediaGallery`, les boutons de téléchargement par image passent à 44px — ils sont actuellement sous le seuil.

- [ ] **Step 4: Auditer**

```bash
npm run build && npm start   # dans un terminal
AUDIT_EMAIL=… AUDIT_PASSWORD=… npx playwright test -g "/soirees"
```

Expected: PASS sur les trois tests de `/soirees`

- [ ] **Step 5: Vérifier le parcours à la main**

Se déclarer sur un item « à ramener », vérifier que le compteur s'incrémente et que l'avatar apparaît. Se retirer, vérifier que le compteur redescend.

- [ ] **Step 6: Commit**

```bash
git add src/app/soirees
git commit -m "feat(soirees): refonte papier chaud

A ramener passe en premier : c'est la question qu'on se pose pendant
la soiree.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Bilan

**Files:**
- Modify: `src/app/soirees/[slug]/bilan/page.tsx`
- Modify: `src/app/soirees/[slug]/bilan/BilanClientForm.tsx` (304 lignes)

**Interfaces:**
- Consumes: `Button`, `Card`, `Field` + `champClasses`
- Produces: rien

- [ ] **Step 1: Reskin du formulaire**

Chaque champ passe par `<Field>` avec `champClasses` sur le contrôle. Les boutons deviennent `<Button>`. La table de correspondance s'applique au reste.

- [ ] **Step 2: Ajouter la page à l'audit**

Le bilan dépend d'une soirée existante, donc son chemin est dynamique. Ajouter dans `e2e/audit.spec.ts`, après la boucle `PAGES` :

```ts
test("le bilan ne déborde pas et respecte les cibles", async ({ page }) => {
  await page.goto("/soirees");
  const premiere = page.getByRole("link", { name: /.+/ }).filter({ hasNotText: /^(Soirée|Cave|Cocktails|Moi)$/ }).first();
  await premiere.click();
  await page.waitForLoadState("networkidle");

  const lienBilan = page.getByRole("link", { name: /bilan/i });
  // Une soirée future n'a pas de bilan : le test n'a alors rien à vérifier.
  if ((await lienBilan.count()) === 0) test.skip();
  await lienBilan.first().click();
  await page.waitForLoadState("networkidle");

  const d = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(d.scroll - d.client).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 3: Auditer et vérifier**

```bash
npx playwright test -g "bilan"
```

Expected: PASS ou SKIP (si aucune soirée passée n'existe dans la base de test)

Puis à la main : remplir et valider un bilan, vérifier qu'il s'enregistre.

- [ ] **Step 4: Commit**

```bash
git add src/app/soirees/[slug]/bilan e2e/audit.spec.ts
git commit -m "feat(bilan): refonte papier chaud

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: La cave

La plus grosse tâche du plan. `StockStudio.tsx` fait 699 lignes ; on le ramène sous 250 en sortant trois feuilles.

**Files:**
- Modify: `src/app/stock/StockStudio.tsx` (699 → ~250 lignes)
- Create: `src/app/stock/FicheBouteilleSheet.tsx`
- Create: `src/app/stock/ScannerSheet.tsx`
- Create: `src/app/stock/EditionSheet.tsx`
- Modify: `src/app/stock/AddBottleForm.tsx` (264 lignes)
- Modify: `src/app/stock/EditBottleDetails.tsx` (294 lignes)
- Modify: `src/app/stock/BottlePreview.tsx` (266 lignes)
- Modify: `src/app/stock/page.tsx`
- Modify: `src/app/stock/ManageAlertsModal.tsx`
- Modify: `src/app/stock/AlertsManagerTrigger.tsx`
- Modify: `src/components/BarcodeScanner.tsx` — **habillage seulement, logique ZXing intouchée**

**Interfaces:**
- Consumes: `Sheet`, `Button`, `Row`, `Badge`, `Field`, `EmptyState`
- Produces:
  - `<FicheBouteilleSheet bouteille onFermer onEditer>` où `bouteille` est le type déjà retourné par `listBottles` dans `src/lib/api-client.ts` — le réutiliser, ne pas en redéclarer un
  - `<ScannerSheet ouvert onFermer onTrouve(code: string)>`
  - `<EditionSheet bouteille ouvert onFermer>`

- [ ] **Step 1: Relever la structure actuelle avant de découper**

```bash
grep -n "^\s*\(function\|const .* = \|return\|useState\|useEffect\)" src/app/stock/StockStudio.tsx | head -60
```

Identifier précisément : quel état pilote le tiroir, quel état pilote le scanner, quel état pilote l'édition. Ce sont les trois frontières de découpe.

- [ ] **Step 2: Extraire la fiche bouteille**

Créer `src/app/stock/FicheBouteilleSheet.tsx`. Le composant reçoit la bouteille en prop et n'accède à aucun état de `StockStudio` autre que celui-là. Il rend le contenu dans un `<Sheet>`.

Réutiliser le type de bouteille exporté par `src/lib/api-client.ts` — vérifier son nom exact avec :

```bash
grep -n "export .*Bottle\|export type\|export interface" src/lib/api-client.ts | grep -i bottle
```

- [ ] **Step 3: Extraire le scanner**

Créer `src/app/stock/ScannerSheet.tsx`, enveloppant le `BarcodeScanner` existant (`src/components/BarcodeScanner.tsx`, 346 lignes) dans un `<Sheet>`.

**Ne pas toucher à la logique ZXing** : elle fonctionne et sa modification est hors périmètre. En revanche ce fichier porte une trentaine de classes du thème sombre, qui doivent bien être reskinées — « logique intouchée » ne veut pas dire « habillage intouché ».

- [ ] **Step 4: Extraire l'édition**

Créer `src/app/stock/EditionSheet.tsx`, enveloppant `EditBottleDetails` dans un `<Sheet>`.

- [ ] **Step 5: Réduire StockStudio**

Ce qui reste : la recherche, les filtres, la liste, et les trois états d'ouverture des feuilles. Les filtres passent en rangée horizontale déroulante avec `no-scrollbar` (la classe existe déjà). Chaque bouteille devient un `<Row>`.

Les boutons `+`/`−` passent de 32px à 44px. C'est la correction tactile la plus visible de la refonte.

- [ ] **Step 6: Vérifier la taille du fichier**

```bash
wc -l src/app/stock/StockStudio.tsx
```

Expected: moins de 250 lignes. Au-dessus, la découpe est incomplète — une des trois feuilles porte encore de la logique restée dans le parent.

- [ ] **Step 7: Auditer**

```bash
npx playwright test -g "/stock"
```

Expected: PASS

- [ ] **Step 8: Vérifier le parcours à la main**

Scanner un code-barres réel et vérifier que la bouteille se crée. Rappel de la limite connue : Open Food Facts couvre mal les spiritueux, le repli manuel est le cas courant, pas le cas rare. Vérifier les deux chemins.

Puis : ajuster une quantité avec `+`/`−`, éditer une bouteille, vérifier l'enregistrement.

- [ ] **Step 9: Commit**

```bash
git add src/app/stock
git commit -m "feat(stock): refonte papier chaud et eclatement de StockStudio

699 lignes ramenees sous 250 : la fiche, le scanner et l'edition sortent
en trois feuilles distinctes. Les boutons de quantite passent de 32 a 44px.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: Cocktails

**Files:**
- Modify: `src/app/cocktails/CocktailStudio.tsx` (450 lignes)
- Modify: `src/app/cocktails/CocktailGrid.tsx` (293 lignes)
- Modify: `src/app/cocktails/CreateRecipeModal.tsx` (266 lignes)
- Modify: `src/app/cocktails/page.tsx`
- Modify: `src/app/cocktails/ShoppingList.tsx`

**Interfaces:**
- Consumes: `Sheet`, `Button`, `Row`, `Card`, `Field`, `EmptyState`
- Produces: rien

- [ ] **Step 1: Retirer le sélecteur grille/liste**

Dans `CocktailStudio.tsx`, supprimer l'état de mode d'affichage et le contrôle qui le bascule. Ne garder qu'une présentation.

```bash
grep -n "grid\|list\|mode\|view" src/app/cocktails/CocktailStudio.tsx | head -20
```

- [ ] **Step 2: Reskin**

Appliquer la table de correspondance. Les neuf `text-cat-*` disparaissent : la catégorie s'affiche en texte dans un `<Badge ton="neutre">`.

- [ ] **Step 3: Auditer et vérifier**

```bash
npx playwright test -g "/cocktails"
```

Expected: PASS

À la main : créer une recette, vérifier qu'elle apparaît.

- [ ] **Step 4: Commit**

```bash
git add src/app/cocktails
git commit -m "feat(cocktails): refonte papier chaud

Selecteur grille/liste retire : une seule presentation sur telephone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 17: Membres, annuaire et suppression de /bar

**Files:**
- Modify: `src/app/membres/page.tsx`
- Modify: `src/app/membres/MemberRow.tsx`
- Modify: `src/app/membres/PendingRequests.tsx`
- Modify: `src/app/membres/InviteMemberForm.tsx`
- Modify: `src/app/membres/InviteLinkSection.tsx`
- Modify: `src/app/membres/BarNameSection.tsx`
- Modify: `src/app/membres/BarVisibilitySection.tsx`
- Modify: `src/app/membres/DiscordChannelBinding.tsx`
- Modify: `src/app/annuaire/page.tsx` (devient une redirection)
- Delete: `src/app/bar/page.tsx`

**Interfaces:**
- Consumes: `Row`, `Badge`, `Button`, `EmptyState`
- Produces: rien

- [ ] **Step 1: Relever ce que fait chaque page**

```bash
grep -n "await \|export default" src/app/membres/page.tsx src/app/annuaire/page.tsx src/app/bar/page.tsx
```

Noter quelles fonctions de `api-client` chacune appelle. L'écran fusionné appellera les deux jeux.

- [ ] **Step 2: Fusionner dans /membres**

`/membres` affiche la liste des membres du bar en `<Row>` (avatar, nom, rôle en `<Badge>`), et absorbe ce que l'annuaire montrait en plus. Les actions de gestion — inviter, changer un rôle, retirer — ne sont rendues que si `activeBar?.myRole === "OWNER"`.

- [ ] **Step 3: Rediriger /annuaire**

Remplacer intégralement `src/app/annuaire/page.tsx` par :

```tsx
import { permanentRedirect } from "next/navigation";

// L'annuaire et les membres montraient les mêmes personnes. Un 308 plutôt
// qu'une suppression : le lien a pu être partagé dans une conversation.
export default function AnnuairePage(): never {
  permanentRedirect("/membres");
}
```

- [ ] **Step 4: Supprimer /bar**

```bash
git rm src/app/bar/page.tsx
grep -rn "\"/bar\"\|'/bar'\|href={\`/bar" src/ ; echo "exit=$?"
```

Expected: `exit=1`. Toute référence restante doit pointer vers `/moi`.

- [ ] **Step 5: Auditer et vérifier**

```bash
npx playwright test -g "/membres"
```

Expected: PASS

À la main : ouvrir `/annuaire` et vérifier l'arrivée sur `/membres`. Ouvrir `/bar` et vérifier le 404.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/membres src/app/annuaire src/app/bar
git commit -m "feat(membres): fusionne l'annuaire et supprime /bar

/annuaire redirige en 308 vers /membres, le lien ayant pu etre partage.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 18: Accueil et parcours d'entrée

**Files:**
- Modify: `src/app/page.tsx` (310 lignes)
- Modify: `src/app/GuestLanding.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`
- Modify: `src/app/creer/page.tsx`
- Modify: `src/app/rejoindre/[token]/page.tsx`
- Modify: `src/app/changer-mot-de-passe/page.tsx`
- Modify: `src/app/changer-mot-de-passe/ChangePasswordForm.tsx`

**Interfaces:**
- Consumes: `Button`, `Card`, `Field` + `champClasses`, `EmptyState`
- Produces: rien

- [ ] **Step 1: Traiter l'accueil**

`src/app/page.tsx` est la racine. Avec la barre d'onglets, elle n'est plus un point d'entrée navigué — elle redirige vers `/soirees` pour un utilisateur connecté, et reste la page d'accueil publique sinon. `GuestLanding.tsx` porte la vue publique.

- [ ] **Step 2: Reskin des formulaires**

`login`, `signup`, `creer`, `rejoindre`, `changer-mot-de-passe` : tous passent par `<Field>` + `champClasses` + `<Button pleineLargeur>`.

`login` porte le bouton « rester connecté » ajouté précédemment. **Vérifier qu'il fonctionne encore après le reskin** — c'est une case à cocher dont l'état pilote la durée de session, facile à casser en refaisant le balisage.

- [ ] **Step 3: Auditer**

```bash
npx playwright test -g "/login"
```

`/login` n'est pas dans la liste `PAGES` de l'audit, qui suppose une session. Ajouter dans `e2e/audit.spec.ts` un test sans fixture pour les pages publiques :

```ts
import { test as base, expect } from "@playwright/test";

// Ces pages s'affichent sans session : elles ne passent pas par la fixture.
for (const chemin of ["/login", "/signup"]) {
  base(`${chemin} respecte les cibles et la densité`, async ({ page }) => {
    await page.goto(chemin);
    await page.waitForLoadState("networkidle");
    const d = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(d.scroll - d.client).toBeLessThanOrEqual(1);
  });
}
```

- [ ] **Step 4: Vérifier le parcours à la main**

Se connecter avec « rester connecté » coché, puis décoché. Vérifier que la session persiste dans le premier cas.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/GuestLanding.tsx src/app/login src/app/signup \
        src/app/creer src/app/rejoindre src/app/changer-mot-de-passe e2e/
git commit -m "feat: refonte papier chaud de l'accueil et des parcours d'entree

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 19: Profil, listes et composants partagés

**Files:**
- Modify: `src/app/profil/page.tsx`, `src/app/profil/ProfileForm.tsx`, `src/app/profil/DiscordLink.tsx`
- Modify: `src/app/journal/page.tsx`
- Modify: `src/app/comptes/page.tsx`, `src/app/comptes/UserRow.tsx`, `src/app/comptes/CreateUserForm.tsx`
- Modify: `src/app/decouvrir/page.tsx`, `src/app/BarDirectory.tsx`
- Modify: `src/components/AccountMenu.tsx`, `src/components/BarSwitcher.tsx`, `src/components/Pagination.tsx`, `src/components/PaginationLinks.tsx`, `src/components/ImagePicker.tsx`, `src/components/BottleImage.tsx`, `src/components/PageTransition.tsx`

**Interfaces:**
- Consumes: toutes les primitives
- Produces: rien

- [ ] **Step 1: Reskin des listes**

`journal`, `comptes`, `decouvrir` : `<Row>` + la pagination existante, reskinée.

- [ ] **Step 2: Reskin du profil**

`ProfileForm` utilise `ImagePicker`, qui porte un `onCommit` optionnel pour ne pas écrire à chaque frappe. **Ne pas retirer ce mécanisme** en refaisant l'habillage.

- [ ] **Step 3: Reskin des composants partagés**

Appliquer la table de correspondance. `PageTransition` utilise framer-motion : ne toucher qu'aux couleurs, jamais à l'animation.

- [ ] **Step 4: Vérifier qu'aucune classe legacy ne subsiste dans tout `src/`**

C'est le contrôle de complétude de toute la phase D. À ce stade, plus rien ne doit rester nulle part.

```bash
grep -rn "glass-card\|box-orange-glow\|vip-vault-card\|orange-glow\|gold-glow\|text-cat-\|tap-target-sm" src/ ; echo "exit=$?"
```

Expected: `exit=1`

```bash
grep -rn "text-cream\|text-muted\|text-orange\|text-gold\|bg-ink-\|bg-brick" src/ ; echo "exit=$?"
```

Expected: `exit=1` — ces classes ne correspondent plus à aucun token depuis la Task 3.

```bash
grep -rn "text-\[10px\]\|text-\[11px\]" src/ | grep -v "tracking-caps"
```

Expected: aucune sortie, ou uniquement des labels sérif en majuscules (le seul usage autorisé sous 13px).

- [ ] **Step 5: Audit complet**

```bash
npm run build && npm start
AUDIT_EMAIL=… AUDIT_PASSWORD=… npm run audit
```

Expected: **tous les tests passent.** C'est le retour à zéro de la référence relevée en Task 12 Step 7.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: refonte papier chaud du profil, des listes et des composants partages

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 20: Administration

La spec range ces pages en « minimum syndical » : elles ont leur propre logique et ne sont pas utilisées pendant une soirée.

**Files:**
- Modify: `src/app/admin/page.tsx`, `src/app/admin/bars/page.tsx`, `src/app/admin/bars/[id]/page.tsx`, `src/app/admin/bars/[id]/cocktails/page.tsx`, `src/app/admin/bars/[id]/soirees/page.tsx`, `src/app/admin/bars/[id]/stock/page.tsx`

**Interfaces:**
- Consumes: `Row`, `Button`, `Card`, `Badge`
- Produces: rien

- [ ] **Step 1: Appliquer la table de correspondance**

Aucune restructuration : seulement les couleurs, les tailles de texte et les cibles tactiles. Ces pages sont consultées sur ordinateur.

- [ ] **Step 2: Vérifier**

Run: `npm run build`
Expected: le build réussit

Ouvrir chaque page d'administration et vérifier qu'elle est lisible sur fond papier.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin
git commit -m "feat(admin): reskin papier chaud

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 21: Vérification finale et build Docker

**Files:**
- Modify: `README.md` (capture ou description du thème, si elle mentionne l'ancien)

**Interfaces:**
- Consumes: tout
- Produces: la branche prête à merger

- [ ] **Step 1: Rebaser sur main**

```bash
git fetch origin
git rebase origin/main
```

Résoudre les conflits éventuels. Rappel de ce qui a déjà mordu sur ce dépôt : un merge sans conflit signalé peut produire un fichier invalide quand deux branches insèrent au même point d'ancrage. Après rebase, **relire** `src/app/layout.tsx` et `src/app/globals.css` en entier.

- [ ] **Step 2: Suite complète**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: tout passe. Pour le lint, comparer au **delta** et non au total : `npx eslint .` à la racine scanne aussi `api/`, qui porte environ 230 avertissements préexistants sans rapport avec cette branche.

- [ ] **Step 3: Audit complet une dernière fois**

```bash
npm start   # dans un terminal
AUDIT_EMAIL=… AUDIT_PASSWORD=… npm run audit
```

Expected: tous les tests passent

- [ ] **Step 4: Vérifier le build Docker**

C'est la vérification qui a manqué deux fois sur ce dépôt et cassé la production. Elle n'est pas optionnelle.

```bash
docker compose build web
```

Expected: le build réussit. Vérifier en particulier qu'aucune requête réseau vers `fonts.gstatic.com` n'apparaît dans les logs.

- [ ] **Step 5: Vérifier les quatre parcours de non-régression**

Sur le conteneur construit :

1. Scanner une bouteille (avec repli manuel).
2. Se déclarer sur un item « à ramener », puis se retirer.
3. Valider un bilan de soirée.
4. Télécharger l'archive des images d'une soirée.

Les quatre doivent fonctionner comme avant la refonte.

- [ ] **Step 6: Vérifier les critères d'acceptation de la spec, un par un**

```bash
# Aucune police externe (hors le commentaire qui explique pourquoi)
grep -rn "fonts.googleapis\|fonts.gstatic\|next/font/google" src/ \
  | grep -v "^\S*: *\*" | grep -v "^\S*: *//" ; echo "exit attendu 1 : $?"
# Aucune classe legacy
grep -rn "glass-card\|box-orange-glow\|vip-vault-card" src/ ; echo "exit attendu 1 : $?"
# /bar n'existe plus
test ! -e src/app/bar/page.tsx && echo "ok : /bar supprimee"
# La serif est bien dans le depot
ls -l src/app/fonts/
```

- [ ] **Step 7: Mettre à jour la documentation si nécessaire**

Vérifier que `README.md` et `CAHIER_DES_CHARGES.md` ne décrivent pas l'ancien thème sombre. Corriger si oui.

- [ ] **Step 8: Commit et ouverture de la PR**

```bash
git add -A
git commit -m "chore: verification finale de la refonte

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin refonte/design-papier-chaud
```

Ouvrir la PR vers `main` en listant, dans le corps, les critères d'acceptation de la spec avec leur état de vérification.

---

## Revue du plan

**Couverture de la spec, section par section :**

| Section de la spec | Tâche(s) |
|---|---|
| §3 Palette | Task 1 (verrou), Task 3 (pose) |
| §3 Typographie et polices | Task 2, Task 3 |
| §3 Ce qui est supprimé | Task 3, Task 19 Step 4 |
| §4 Navigation, 4 onglets | Task 9, Task 11 |
| §4 Où vont les 23 pages | Task 11 (Moi), Tasks 13-20 |
| §4 Fusion annuaire/membres, suppression /bar | Task 17 |
| §5 Les 8 primitives | Tasks 4-9 |
| §5 Modales reskinnées non réécrites | Task 10 |
| §5 Le tiroir devient une feuille | Task 8, Task 15 |
| §6 Soirée, à ramener en premier | Task 13 Step 2 |
| §6 Cave, éclatement de StockStudio | Task 15 |
| §6 Cocktails, sélecteur retiré | Task 16 Step 1 |
| §6 Moi | Task 11 Step 5 |
| §7 Périmètre, API intouchée | contrainte globale, vérifiée Task 21 |
| §8 Une branche, fondations d'abord | phases A→D, Task 21 Step 1 |
| §9 Vérification | Task 1, Task 12, Task 21 |
| §10 Critères d'acceptation | Task 21 Step 6 |

Aucune section sans tâche.

**Couverture des fichiers.** Les 71 fichiers `.tsx` de `src/` ont été inventoriés et affectés à une tâche. Le contrôle de complétude est la Task 19 Step 4, qui exige qu'aucune classe du thème sombre ne subsiste **nulle part** dans `src/` — pas seulement dans les fichiers que la tâche vient de toucher.

**Points où ce plan reste volontairement moins prescriptif :** les tâches 13 et 16 à 20 décrivent la transformation à appliquer et la porte de sortie qui la valide, sans reproduire le code cible. Écrire à l'avance le remplacement verbatim de ~5 000 lignes de JSX produirait du code spéculatif, écrit sans le fichier sous les yeux, plus coûteux à corriger qu'à écrire. La table de correspondance et l'audit automatisé sont ce qui rend ces tâches vérifiables — c'est l'audit, pas le plan, qui dit si l'écran est terminé.

**Risque le plus sérieux :** la Task 15. C'est la seule qui restructure de la logique plutôt que de l'habillage, sur le fichier le plus gros du dépôt, et le stock est le cœur fonctionnel de l'application. Elle mérite d'être relue avec plus d'attention que les autres.
