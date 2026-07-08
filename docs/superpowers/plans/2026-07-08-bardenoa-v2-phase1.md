# Bar de Noa — v2 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "must-have" half of the v2 spec — admin authentication, post-event stock reconciliation ("bilan"), low-stock alerts, stock search, a copyable shopping list, and unit tests on the cocktail engine — without touching Phase 2 (recipe CRUD, RSVP, history/stats, mobile pass, dashboard widgets beyond the alert).

**Architecture:** No new services. Everything stays inside the existing Next.js App Router project: Server Components for reads, Server Actions (`"use server"`) for writes, a single JSON file (`data/store.json`) behind `src/lib/db.ts` as the only persistence layer, Tailwind v4 tokens for styling. Auth is a single shared password compared against an env var, not a user table.

**Tech Stack:** Next.js 16 (App Router, TypeScript strict), React 19 Server Components, Tailwind CSS v4, Vitest (new, for unit tests). No new runtime dependencies beyond Vitest (a dev dependency).

**Spec:** `docs/superpowers/specs/2026-07-08-bardenoa-v2-design.md` (sections 3, 4, 5, 7, 8 — Phase 1 only)

## Global Constraints

- Persistence is exclusively `data/store.json` via `src/lib/db.ts`; no direct `fs` access from pages or actions, no new database.
- All mutations go through Server Actions (`"use server"`), matching the existing pattern in `src/app/actions.ts` — no REST route handlers.
- All writes to the store must go through the existing `mutate()` queue in `src/lib/db.ts` so concurrent writes stay serialized.
- Reuse existing Tailwind tokens only: `ink`, `ink-2`, `brick`, `brick-light`, `brick-dark`, `gold`, `gold-dim`, `cream`, `muted` (defined in `src/app/globals.css`). Do not introduce new color tokens.
- UI copy is in French, matching the tone of existing pages (see `src/app/stock/page.tsx`, `src/app/soirees/page.tsx`).
- `/soirees/[slug]` (the guest page) must remain reachable without authentication. Every other route is admin-only.
- Automated tests are scoped to the cocktail engine (`src/lib/cocktails.ts`) and the password hashing utility (`src/lib/auth.ts`) — no end-to-end tests, no tests against `src/lib/db.ts` (per spec section 5.5 / 9).
- `npm run build` must pass with zero TypeScript errors after every task.

---

## Files Overview

| File | Change |
|---|---|
| `package.json` | + `vitest` devDependency, + `test` script |
| `src/lib/cocktails.test.ts` | new — unit tests for the recipe engine |
| `src/lib/types.ts` | + `Bottle.lowStockThreshold?`, + `StockAdjustment`, + `Store.stockAdjustments` |
| `src/app/actions.ts` | + `updateBottleThreshold`, + `submitBilan`; `createBottle` parses `lowStockThreshold` |
| `src/app/stock/page.tsx` | form gets a threshold field; table extracted to `BottleTable.tsx` |
| `src/app/stock/BottleRow.tsx` | + threshold input, + "Stock bas" badge |
| `src/app/stock/BottleTable.tsx` | new — client component, extracted from `stock/page.tsx`, adds search/filter |
| `src/app/page.tsx` | + low-stock alert widget |
| `src/app/cocktails/page.tsx` | + shopping list button |
| `src/app/cocktails/ShoppingList.tsx` | new — client component |
| `src/lib/auth.ts` | new — password hashing helper |
| `src/lib/auth.test.ts` | new — unit tests for the hashing helper |
| `src/app/login/page.tsx` | new — login form |
| `src/app/login/actions.ts` | new — `login` server action |
| `src/middleware.ts` | new — route protection |
| `src/lib/db.ts` | + `stockAdjustments` in `Store`, + `listStockAdjustments`, + `applyStockAdjustments`; `deleteEvent` also cleans up adjustments |
| `src/app/soirees/[slug]/bilan/page.tsx` | new — bilan form |
| `src/app/soirees/[slug]/page.tsx` | + link to the bilan page |
| `README.md` | + `ADMIN_PASSWORD` setup note |

---

## Task 1: Vitest setup + cocktail engine tests

**Files:**
- Modify: `package.json`
- Create: `src/lib/cocktails.test.ts`

**Interfaces:**
- Consumes: `evaluateRecipes(bottles: Bottle[])` and `COCKTAILS` from `src/lib/cocktails.ts` (already implemented, unchanged by this task)

This task adds test coverage to existing, already-correct logic — there is no red/green cycle here since no implementation changes. Write the tests, run them, confirm they pass.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add the test script**

Edit `package.json`, `scripts` block:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Write the test file**

Create `src/lib/cocktails.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateRecipes, COCKTAILS } from "./cocktails";
import type { Bottle } from "./types";

let counter = 0;

function bottle(overrides: Partial<Bottle>): Bottle {
  counter += 1;
  return {
    id: `bottle-${counter}`,
    name: overrides.name ?? "Test bottle",
    type: overrides.type ?? "autre",
    quantity: overrides.quantity ?? 1,
    tags: overrides.tags ?? [],
    vip: overrides.vip ?? false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("evaluateRecipes", () => {
  it("marks a recipe makeable when every required tag is covered", () => {
    const bottles = [
      bottle({ tags: ["rhum blanc"] }),
      bottle({ tags: ["cola"] }),
      bottle({ tags: ["citron vert"] }),
    ];
    const results = evaluateRecipes(bottles);
    const cubaLibre = results.find((r) => r.recipe.id === "cuba-libre")!;
    expect(cubaLibre.makeable).toBe(true);
    expect(cubaLibre.missingTags).toEqual([]);
  });

  it("lists the missing tags for a recipe that cannot be made", () => {
    const bottles = [bottle({ tags: ["rhum blanc"] })];
    const results = evaluateRecipes(bottles);
    const cubaLibre = results.find((r) => r.recipe.id === "cuba-libre")!;
    expect(cubaLibre.makeable).toBe(false);
    expect(cubaLibre.missingTags).toEqual(["cola", "citron vert"]);
  });

  it("ignores bottles with zero quantity", () => {
    const bottles = [bottle({ tags: ["rhum blanc"], quantity: 0 })];
    const results = evaluateRecipes(bottles);
    const daiquiri = results.find((r) => r.recipe.id === "daiquiri")!;
    expect(daiquiri.missingTags).toContain("rhum blanc");
  });

  it("prefers a non-VIP bottle over a VIP bottle covering the same tag", () => {
    const bottles = [
      bottle({ tags: ["whisky"], vip: true }),
      bottle({ tags: ["whisky"], vip: false }),
      bottle({ tags: ["cola"] }),
    ];
    const results = evaluateRecipes(bottles);
    const whiskyCoca = results.find((r) => r.recipe.id === "whisky-coca")!;
    expect(whiskyCoca.makeable).toBe(true);
    expect(whiskyCoca.usesVip).toBe(false);
  });

  it("flags a recipe as VIP-only when only a VIP bottle covers a required tag", () => {
    const bottles = [bottle({ tags: ["whisky"], vip: true }), bottle({ tags: ["cola"] })];
    const results = evaluateRecipes(bottles);
    const whiskyCoca = results.find((r) => r.recipe.id === "whisky-coca")!;
    expect(whiskyCoca.makeable).toBe(true);
    expect(whiskyCoca.usesVip).toBe(true);
  });

  it("matches tags case-insensitively", () => {
    const bottles = [
      bottle({ tags: ["RHUM Blanc"] }),
      bottle({ tags: ["Cola"] }),
      bottle({ tags: ["Citron Vert"] }),
    ];
    const results = evaluateRecipes(bottles);
    const cubaLibre = results.find((r) => r.recipe.id === "cuba-libre")!;
    expect(cubaLibre.makeable).toBe(true);
  });

  it("evaluates every recipe in the catalog", () => {
    const results = evaluateRecipes([]);
    expect(results).toHaveLength(COCKTAILS.length);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/cocktails.test.ts`
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/cocktails.test.ts
git commit -m "test: add unit tests for the cocktail feasibility engine"
```

---

## Task 2: Low-stock threshold on bottles

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/app/actions.ts`
- Modify: `src/app/stock/page.tsx`
- Modify: `src/app/stock/BottleRow.tsx`

**Interfaces:**
- Produces: `Bottle.lowStockThreshold?: number`, `updateBottleThreshold(id: string, threshold: number | null): Promise<void>` (Server Action) — used by Task 3 (dashboard) and Task 4 (search/filter extraction).

- [ ] **Step 1: Add the field to the `Bottle` type**

Edit `src/lib/types.ts`, the `Bottle` interface (currently lines 14-23):

```ts
export interface Bottle {
  id: string;
  name: string;
  type: BottleType;
  quantity: number;
  tags: string[];
  vip: boolean;
  notes?: string;
  lowStockThreshold?: number;
  createdAt: string;
}
```

- [ ] **Step 2: Parse the threshold on creation and add an update action**

Edit `src/app/actions.ts`. Replace the `createBottle` function (lines 16-28) with:

```ts
export async function createBottle(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const type = String(formData.get("type") ?? "autre") as BottleType;
  const quantity = Number(formData.get("quantity") ?? 0) || 0;
  const vip = formData.get("vip") === "on";
  const tags = parseTags(formData.get("tags"));
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const thresholdRaw = String(formData.get("lowStockThreshold") ?? "").trim();
  const lowStockThreshold = thresholdRaw ? Number(thresholdRaw) : undefined;

  await db.addBottle({ name, type, quantity, vip, tags, notes, lowStockThreshold });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
}

export async function updateBottleThreshold(id: string, threshold: number | null) {
  await db.updateBottle(id, { lowStockThreshold: threshold ?? undefined });
  revalidatePath("/stock");
  revalidatePath("/");
}
```

- [ ] **Step 3: Add the threshold field to the creation form**

Edit `src/app/stock/page.tsx`. In the `<form action={createBottle} ...>` block, insert this input right after the `notes` input (currently line 72, right before the closing `<input name="notes" .../>` tag's sibling) and before the `vip` checkbox label:

```tsx
          <input
            name="lowStockThreshold"
            type="number"
            min="0"
            step="1"
            placeholder="Seuil d'alerte (optionnel, ex: 1)"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
```

- [ ] **Step 4: Add an "Alerte" column to the table header**

Edit `src/app/stock/page.tsx`, the `<thead>` block inside `BottleTable` (currently lines 115-121):

```tsx
        <thead>
          <tr className="text-left text-gold-dim text-xs uppercase tracking-caps border-b border-cream/10">
            <th className="py-2 font-medium">Bouteille</th>
            <th className="py-2 font-medium">Type</th>
            <th className="py-2 font-medium">Quantité</th>
            <th className="py-2 font-medium">Alerte</th>
            <th className="py-2"></th>
          </tr>
        </thead>
```

- [ ] **Step 5: Add the threshold input and "Stock bas" badge to each row**

Replace the full contents of `src/app/stock/BottleRow.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateBottleQuantity, updateBottleThreshold, deleteBottleAction } from "@/app/actions";
import type { Bottle } from "@/lib/types";

export default function BottleRow({ bottle }: { bottle: Bottle }) {
  const [quantity, setQuantity] = useState(bottle.quantity);
  const [threshold, setThreshold] = useState(
    bottle.lowStockThreshold != null ? String(bottle.lowStockThreshold) : ""
  );
  const [isPending, startTransition] = useTransition();

  const isLow = bottle.lowStockThreshold != null && quantity <= bottle.lowStockThreshold;

  function change(delta: number) {
    const next = Math.max(0, Math.round((quantity + delta) * 10) / 10);
    setQuantity(next);
    startTransition(() => {
      updateBottleQuantity(bottle.id, next);
    });
  }

  function saveThreshold(raw: string) {
    setThreshold(raw);
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && Number.isNaN(parsed)) return;
    startTransition(() => {
      updateBottleThreshold(bottle.id, parsed);
    });
  }

  return (
    <tr className="border-b border-cream/10 last:border-0">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-cream">{bottle.name}</span>
          {bottle.vip && (
            <span className="text-[10px] uppercase tracking-wide bg-gold text-ink px-1.5 py-0.5 rounded font-bold">
              VIP
            </span>
          )}
          {isLow && (
            <span className="text-[10px] uppercase tracking-wide bg-red-400/20 text-red-400 px-1.5 py-0.5 rounded font-bold">
              Stock bas
            </span>
          )}
        </div>
        {bottle.tags.length > 0 && (
          <div className="text-xs text-muted mt-0.5">{bottle.tags.join(", ")}</div>
        )}
        {bottle.notes && <div className="text-xs text-muted italic mt-0.5">{bottle.notes}</div>}
      </td>
      <td className="py-2 pr-3 text-muted capitalize">{bottle.type}</td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => change(-1)}
            disabled={isPending}
            className="w-6 h-6 rounded bg-brick-light/40 hover:bg-brick-light/70 text-sm disabled:opacity-50"
          >
            −
          </button>
          <span className={`w-8 text-center ${quantity === 0 ? "text-red-400" : "text-cream"}`}>{quantity}</span>
          <button
            onClick={() => change(1)}
            disabled={isPending}
            className="w-6 h-6 rounded bg-brick-light/40 hover:bg-brick-light/70 text-sm disabled:opacity-50"
          >
            +
          </button>
        </div>
      </td>
      <td className="py-2 pr-3">
        <input
          type="number"
          min="0"
          step="1"
          value={threshold}
          onChange={(e) => saveThreshold(e.target.value)}
          placeholder="—"
          title="Alerte si la quantité descend à ce niveau ou en dessous"
          className="w-16 bg-ink border border-brick-light/40 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-gold/60"
        />
      </td>
      <td className="py-2 text-right">
        <button
          onClick={() => startTransition(() => deleteBottleAction(bottle.id))}
          className="text-xs text-muted hover:text-red-400"
        >
          Supprimer
        </button>
      </td>
    </tr>
  );
}
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 7: Manual check**

Run: `npm run dev`, open `/stock`, create a bottle with quantity `2` and threshold `1` → row shows no badge. Lower the quantity to `1` with the `−` button → "Stock bas" badge appears without a page reload.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/app/actions.ts src/app/stock/page.tsx src/app/stock/BottleRow.tsx
git commit -m "feat: add configurable low-stock threshold per bottle"
```

---

## Task 3: Low-stock alert on the dashboard

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `Bottle.lowStockThreshold` (Task 2)

- [ ] **Step 1: Compute the low-stock list**

Edit `src/app/page.tsx`. Right after the line `const availability = evaluateRecipes(bottles);` (currently line 11), add:

```ts
  const lowStock = bottles
    .filter((b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold)
    .sort((a, b) => a.quantity - b.quantity);
```

- [ ] **Step 2: Render the alert block**

In the same file, the "brick" panel currently ends with this block (lines 63-99):

```tsx
        <div className="mt-10 pt-8 border-t border-cream/15 grid sm:grid-cols-2 gap-8">
          ...
        </div>
```

Right after that closing `</div>` (line 99) and before the panel's own closing `</div>` (line 100), add:

```tsx
        {lowStock.length > 0 && (
          <div className="mt-8 pt-6 border-t border-cream/15">
            <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">
              {lowStock.length} bouteille{lowStock.length > 1 ? "s" : ""} en alerte
            </p>
            <ul className="text-sm space-y-1">
              {lowStock.slice(0, 5).map((b) => (
                <li key={b.id} className="flex justify-between text-cream">
                  <span>{b.name}</span>
                  <span className="text-red-400">
                    {b.quantity} restant{b.quantity > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

With the low-stock bottle from Task 2 still at quantity `1`/threshold `1`, open `/` and confirm "1 bouteille en alerte" appears with the bottle name and "1 restant".

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: surface low-stock bottles on the dashboard"
```

---

## Task 4: Search/filter on the stock page

**Files:**
- Create: `src/app/stock/BottleTable.tsx`
- Modify: `src/app/stock/page.tsx`

**Interfaces:**
- Consumes: `Bottle[]`, `BottleRow` (Task 2)
- Produces: `BottleTable` React component, replacing the function currently defined inline in `stock/page.tsx`

- [ ] **Step 1: Extract and enhance the table as a client component**

Create `src/app/stock/BottleTable.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { Bottle } from "@/lib/types";
import BottleRow from "./BottleRow";

const TYPE_OPTIONS = [
  ["", "Tous les types"],
  ["whisky", "Whisky"],
  ["rhum", "Rhum"],
  ["vodka", "Vodka"],
  ["gin", "Gin"],
  ["tequila", "Tequila"],
  ["liqueur", "Liqueur / apéritif"],
  ["vin", "Vin"],
  ["champagne", "Champagne / bulles"],
  ["biere", "Bière"],
  ["mixer", "Soft / mixer"],
  ["autre", "Autre"],
] as const;

export default function BottleTable({
  title,
  bottles,
  empty,
  bare,
}: {
  title?: string;
  bottles: Bottle[];
  empty: string;
  bare?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bottles.filter((b) => {
      const matchesQuery =
        !q || b.name.toLowerCase().includes(q) || b.tags.some((t) => t.includes(q));
      const matchesType = !type || b.type === type;
      return matchesQuery && matchesType;
    });
  }, [bottles, query, type]);

  const content =
    filtered.length === 0 ? (
      <p className="text-muted text-sm">{bottles.length === 0 ? empty : "Aucune bouteille ne correspond."}</p>
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gold-dim text-xs uppercase tracking-caps border-b border-cream/10">
            <th className="py-2 font-medium">Bouteille</th>
            <th className="py-2 font-medium">Type</th>
            <th className="py-2 font-medium">Quantité</th>
            <th className="py-2 font-medium">Alerte</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((b) => (
            <BottleRow key={b.id} bottle={b} />
          ))}
        </tbody>
      </table>
    );

  const body = (
    <>
      {bottles.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom ou un tag..."
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm flex-1 placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold/60"
          >
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      {content}
    </>
  );

  if (bare) return body;

  return (
    <section>
      {title && <h2 className="font-display text-xl text-cream mb-4">{title}</h2>}
      {body}
    </section>
  );
}
```

- [ ] **Step 2: Remove the inline table from the page and import the new component**

Edit `src/app/stock/page.tsx`. Replace the import line `import BottleRow from "./BottleRow";` (line 3) with:

```tsx
import BottleTable from "./BottleTable";
```

Delete the entire `function BottleTable({ ... }) { ... }` definition at the bottom of the file (currently lines 99-139) — it now lives in `BottleTable.tsx`.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds, no unused-import or duplicate-declaration errors.

- [ ] **Step 4: Manual check**

Open `/stock` with at least 2 bottles of different types. Type part of a name in the search box → list narrows without a page reload. Pick a type in the dropdown → list narrows further. Clear both → full list returns.

- [ ] **Step 5: Commit**

```bash
git add src/app/stock/BottleTable.tsx src/app/stock/page.tsx
git commit -m "feat: add search and type filter to the stock page"
```

---

## Task 5: Copyable shopping list

**Files:**
- Create: `src/app/cocktails/ShoppingList.tsx`
- Modify: `src/app/cocktails/page.tsx`

**Interfaces:**
- Consumes: `RecipeAvailability[]` (existing, from `src/lib/cocktails.ts`)
- Produces: `ShoppingList` React component

- [ ] **Step 1: Create the copy-to-clipboard component**

Create `src/app/cocktails/ShoppingList.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function ShoppingList({ items }: { items: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(items.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard access can fail silently, no fallback needed for this scale
    }
  }

  if (items.length === 0) return null;

  return (
    <button
      onClick={copy}
      className="text-xs px-3 py-1.5 rounded-md border border-brick-light/60 text-muted hover:border-gold hover:text-gold transition-colors"
    >
      {copied ? "Copié !" : "Copier la liste de courses"}
    </button>
  );
}
```

- [ ] **Step 2: Wire it into the cocktails page**

Edit `src/app/cocktails/page.tsx`. Add the import at the top:

```tsx
import ShoppingList from "./ShoppingList";
```

Replace the `notReady` section (currently lines 38-52):

```tsx
      {notReady.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-xl text-cream">Encore un peu de shopping</h2>
            <ShoppingList
              items={Array.from(new Set(notReady.flatMap((r) => r.missingTags))).sort()}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {notReady.slice(0, 8).map(({ recipe, missingTags }) => (
              <div key={recipe.id} className="rounded-lg border border-cream/10 bg-ink-2 p-3 text-sm">
                <p className="font-medium text-cream">{recipe.name}</p>
                <p className="text-muted text-xs mt-1">
                  Il manque : {missingTags.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

Open `/cocktails` with at least one non-makeable recipe. Click "Copier la liste de courses", paste into a text editor → one missing ingredient per line, no duplicates.

- [ ] **Step 5: Commit**

```bash
git add src/app/cocktails/ShoppingList.tsx src/app/cocktails/page.tsx
git commit -m "feat: add copyable shopping list for missing cocktail ingredients"
```

---

## Task 6: Password hashing utility

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth.test.ts`

**Interfaces:**
- Produces: `SESSION_COOKIE: string`, `hashPassword(password: string): Promise<string>` — consumed by Task 7 (login action) and Task 8 (middleware)

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword } from "./auth";

describe("hashPassword", () => {
  it("produces a stable 64-character hex digest for the same input", async () => {
    const a = await hashPassword("secret");
    const b = await hashPassword("secret");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different digests for different inputs", async () => {
    const a = await hashPassword("secret");
    const b = await hashPassword("different");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`

- [ ] **Step 3: Implement the utility**

Create `src/lib/auth.ts`:

```ts
export const SESSION_COOKIE = "bardenoa_session";

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: add password hashing helper for admin auth"
```

---

## Task 7: Login page and server action

**Files:**
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `hashPassword`, `SESSION_COOKIE` (Task 6), `process.env.ADMIN_PASSWORD`
- Produces: `login(formData: FormData): Promise<void>` (Server Action) — the cookie it sets is read by Task 8's middleware

- [ ] **Step 1: Write the login action**

Create `src/app/login/actions.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD ?? "";

  if (!expected || password !== expected) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await hashPassword(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}
```

- [ ] **Step 2: Write the login page**

Create `src/app/login/page.tsx`:

```tsx
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-16">
      <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Accès privé</p>
      <h1 className="font-display text-3xl text-gold mb-6">Le Bar de Noa</h1>
      <form action={login} className="space-y-3">
        <input
          name="password"
          type="password"
          placeholder="Mot de passe"
          required
          autoFocus
          className="w-full bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
        />
        {error && <p className="text-xs text-red-400">Mot de passe incorrect.</p>}
        <button
          type="submit"
          className="w-full bg-gold text-ink font-medium rounded-lg py-2 hover:bg-cream transition-colors"
        >
          Entrer
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds. `/login` is not yet linked from anywhere and not yet protected — that's Task 8.

- [ ] **Step 4: Commit**

```bash
git add src/app/login
git commit -m "feat: add admin login page and server action"
```

---

## Task 8: Route protection middleware

**Files:**
- Create: `src/middleware.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `hashPassword`, `SESSION_COOKIE` (Task 6), the cookie set by `login` (Task 7)

- [ ] **Step 1: Write the middleware**

Create `src/middleware.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth";

// Matches /soirees/<slug> exactly, but not /soirees/<slug>/bilan — the guest
// page stays public, the bilan screen stays admin-only.
const PUBLIC_GUEST_PAGE = /^\/soirees\/[^/]+$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || PUBLIC_GUEST_PAGE.test(pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_PASSWORD ?? "";
  const expectedHash = expected ? await hashPassword(expected) : null;
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (!expectedHash || sessionCookie !== expectedHash) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Document the required env var**

Edit `README.md`. Right after the "## Lancer le projet" code block (currently ending at line 17 with ` ```), insert:

```md

Avant de lancer le serveur, crée un fichier `.env.local` à la racine avec un mot de passe pour les pages d'administration :

```bash
echo "ADMIN_PASSWORD=ton-mot-de-passe" > .env.local
```

Sans cette variable, `/stock`, `/soirees` et `/cocktails` restent inaccessibles (redirection vers `/login`) — seule la page invité `/soirees/<slug>` reste publique.
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

Run `echo "ADMIN_PASSWORD=test1234" > .env.local`, then `npm run dev`.
- Visit `/stock` without a cookie → redirected to `/login`.
- Submit the wrong password → redirected to `/login?error=1`, error message shown.
- Submit `test1234` → redirected to `/`, and `/stock` / `/cocktails` / `/soirees` are now reachable.
- Visit `/soirees/<an-existing-slug>` in a private/incognito window (no cookie) → loads directly, no redirect.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts README.md
git commit -m "feat: protect admin routes behind a shared password"
```

---

## Task 9: `StockAdjustment` data model

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/db.ts`

**Interfaces:**
- Produces: `StockAdjustment` type, `listStockAdjustments(eventSlug: string): Promise<StockAdjustment[]>`, `applyStockAdjustments(eventSlug: string, changes: { bottleId: string; quantityAfter: number }[]): Promise<StockAdjustment[]>` — consumed by Task 10 (bilan page)

- [ ] **Step 1: Add the type**

Edit `src/lib/types.ts`. Add after the `Contribution` interface (currently lines 33-40):

```ts
export interface StockAdjustment {
  id: string;
  eventSlug: string;
  bottleId: string;
  bottleName: string;
  quantityBefore: number;
  quantityAfter: number;
  createdAt: string;
}
```

Update the `Store` interface (currently lines 42-46):

```ts
export interface Store {
  bottles: Bottle[];
  events: EventItem[];
  contributions: Contribution[];
  stockAdjustments: StockAdjustment[];
}
```

- [ ] **Step 2: Update the empty store and the read/write path**

Edit `src/lib/db.ts`. Update the import (line 3):

```ts
import type { Bottle, EventItem, Contribution, StockAdjustment, Store } from "./types";
```

Update the `empty` constant (line 8):

```ts
const empty: Store = { bottles: [], events: [], contributions: [], stockAdjustments: [] };
```

Update `readStore`'s return object (currently lines 24-30):

```ts
    return {
      bottles: parsed.bottles ?? [],
      events: parsed.events ?? [],
      contributions: parsed.contributions ?? [],
      stockAdjustments: parsed.stockAdjustments ?? [],
    };
```

- [ ] **Step 3: Clean up adjustments when an event is deleted**

Edit `src/lib/db.ts`. Update `deleteEvent` (currently lines 138-143):

```ts
export async function deleteEvent(slug: string) {
  return mutate((store) => {
    store.events = store.events.filter((e) => e.slug !== slug);
    store.contributions = store.contributions.filter((c) => c.eventSlug !== slug);
    store.stockAdjustments = store.stockAdjustments.filter((a) => a.eventSlug !== slug);
    return true;
  });
}
```

- [ ] **Step 4: Add the stock adjustment functions**

Edit `src/lib/db.ts`. Add at the end of the file, after `isVipGuest`:

```ts

// ---------- Stock adjustments ----------

export async function listStockAdjustments(eventSlug: string): Promise<StockAdjustment[]> {
  const store = await readStore();
  return store.stockAdjustments
    .filter((a) => a.eventSlug === eventSlug)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function applyStockAdjustments(
  eventSlug: string,
  changes: { bottleId: string; quantityAfter: number }[]
): Promise<StockAdjustment[]> {
  return mutate((store) => {
    const created: StockAdjustment[] = [];
    for (const change of changes) {
      const bottle = store.bottles.find((b) => b.id === change.bottleId);
      if (!bottle) continue;
      const quantityBefore = bottle.quantity;
      const quantityAfter = Math.max(0, change.quantityAfter);
      if (quantityBefore === quantityAfter) continue;
      bottle.quantity = quantityAfter;
      const adjustment: StockAdjustment = {
        id: makeId(),
        eventSlug,
        bottleId: bottle.id,
        bottleName: bottle.name,
        quantityBefore,
        quantityAfter,
        createdAt: new Date().toISOString(),
      };
      store.stockAdjustments.push(adjustment);
      created.push(adjustment);
    }
    return created;
  });
}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/db.ts
git commit -m "feat: add StockAdjustment model for post-event stock reconciliation"
```

---

## Task 10: Bilan post-soirée page

**Files:**
- Modify: `src/app/actions.ts`
- Create: `src/app/soirees/[slug]/bilan/page.tsx`
- Modify: `src/app/soirees/[slug]/page.tsx`

**Interfaces:**
- Consumes: `applyStockAdjustments` (Task 9), `evaluateRecipes` (existing), `getEvent`/`listBottles` (existing)

- [ ] **Step 1: Add the server action**

Edit `src/app/actions.ts`. Add at the end of the file:

```ts

export async function submitBilan(slug: string, formData: FormData) {
  const changes: { bottleId: string; quantityAfter: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("quantity-")) continue;
    const bottleId = key.slice("quantity-".length);
    const quantityAfter = Number(value);
    if (Number.isNaN(quantityAfter)) continue;
    changes.push({ bottleId, quantityAfter });
  }

  await db.applyStockAdjustments(slug, changes);
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath(`/soirees/${slug}`);
  redirect(`/soirees/${slug}`);
}
```

- [ ] **Step 2: Write the bilan page**

Create `src/app/soirees/[slug]/bilan/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getEvent, listBottles } from "@/lib/db";
import { evaluateRecipes } from "@/lib/cocktails";
import { submitBilan } from "@/app/actions";

export default async function BilanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const bottles = await listBottles();
  const availability = evaluateRecipes(bottles);
  const vipTagsUsed = new Set(
    availability.filter((a) => a.makeable && a.usesVip).flatMap((a) => a.recipe.tags)
  );
  const relevant = bottles.filter((b) => !b.vip || b.tags.some((t) => vipTagsUsed.has(t)));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Bilan</p>
        <h1 className="font-display text-4xl text-gold">{event.name}</h1>
        <p className="text-muted text-sm mt-2 max-w-lg">
          Ajuste les quantités restantes pour les bouteilles concernées par cette soirée. Laisse
          inchangé ce qui n&apos;a pas bougé.
        </p>
      </div>

      <form action={submitBilan.bind(null, slug)} className="space-y-6">
        <div className="rounded-xl border border-cream/10 bg-ink-2 p-6 space-y-3">
          {relevant.length === 0 ? (
            <p className="text-muted text-sm">Aucune bouteille à ajuster.</p>
          ) : (
            relevant.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-4 border-b border-cream/10 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-cream font-medium">{b.name}</p>
                  <p className="text-xs text-muted">Actuellement : {b.quantity}</p>
                </div>
                <input
                  type="number"
                  name={`quantity-${b.id}`}
                  step="0.5"
                  min="0"
                  defaultValue={b.quantity}
                  className="w-24 bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:border-gold/60"
                />
              </div>
            ))
          )}
        </div>
        <button
          type="submit"
          className="bg-gold text-ink font-medium rounded-lg px-6 py-2 hover:bg-cream transition-colors"
        >
          Valider le bilan
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Link to the bilan page from the event page**

Edit `src/app/soirees/[slug]/page.tsx`. Add the import:

```tsx
import Link from "next/link";
```

Replace the header block (currently lines 26-38):

```tsx
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Soirée</p>
          <h1 className="font-display text-4xl text-gold">{event.name}</h1>
          <p className="text-muted text-sm mt-2 capitalize">
            {new Date(event.date).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Link
          href={`/soirees/${slug}/bilan`}
          className="shrink-0 text-xs px-3 py-2 rounded-md border border-brick-light/60 text-muted hover:border-gold hover:text-gold transition-colors"
        >
          Faire le bilan
        </Link>
      </div>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

Open an existing soirée page (logged in as admin), click "Faire le bilan", lower one bottle's quantity, submit. Confirm: redirected back to the soirée page, `/stock` shows the new quantity, and the bottle's "Stock bas" badge (if threshold crossed) appears immediately.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions.ts "src/app/soirees/[slug]/bilan" "src/app/soirees/[slug]/page.tsx"
git commit -m "feat: add post-event stock reconciliation (bilan)"
```

---

## Plan Self-Review Notes

- **Spec coverage:** every Phase 1 bullet in section 5 of the spec maps to a task (5.1 → Task 9+10, 5.2 → Task 2+3, 5.3 → Task 4, 5.4 → Task 5, 5.5 → Task 1). Section 4 (auth) maps to Task 6+7+8.
- **Guest page stays public:** verified by the `PUBLIC_GUEST_PAGE` regex in Task 8 explicitly excluding `/soirees/[slug]/bilan` while allowing `/soirees/[slug]`.
- **Type consistency:** `lowStockThreshold?: number` (Task 2) is used identically in `actions.ts`, `BottleRow.tsx`, `page.tsx`, and `BottleTable.tsx`. `StockAdjustment` fields (Task 9) match exactly between `types.ts`, `db.ts`, and the consumer in Task 10.
- **No logout button:** intentionally out of scope — not requested by the spec, and a 30-day cookie is sufficient for a personal project (avoids the added complexity of hiding admin-only UI from the public guest page).
