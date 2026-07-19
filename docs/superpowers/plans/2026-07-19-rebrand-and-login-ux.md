# Rebrand & Login UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the app from "Le Bar de Noa" to "OpenBar" everywhere it's visible, and fix the header account widget so a logged-in non-admin user sees their identity and a logout option instead of a misleading "Connexion Admin" link.

**Architecture:** Pure frontend, text/copy changes plus one component behavior rewrite (`AdminBadge` → `AccountMenu`, driven by the full `SessionUser | null` instead of a bare `isAdmin` boolean). No API, database, or auth-logic changes.

**Tech Stack:** Next.js 16 App Router (frontend only).

## Global Constraints

- No new npm dependencies.
- The frontend has no test framework — verify with `npx tsc --noEmit -p .` and manual browser checks.
- `next.config.ts` has `basePath: "/bar"` — any `redirect()`/`<Link href>` written must be a logical path with no `/bar` prefix (this plan doesn't add new redirects, but double-check existing ones aren't disturbed).
- `package.json`'s `"name": "bardenoa"` and `src/app/favicon.ico` are explicitly out of scope — do not touch them.
- French user-facing strings, matching the rest of the codebase.

---

### Task 1: Rebrand — replace "Le Bar de Noa" with "OpenBar"

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`
- Modify: `src/app/cocktails/CocktailStudio.tsx`
- Modify: `src/app/stock/StockStudio.tsx`

**Interfaces:** None — pure text/copy changes, no new exports or props.

- [ ] **Step 1: Update `src/app/layout.tsx`**

Replace:

```tsx
export const metadata: Metadata = {
  title: "Le Bar de Noa — Mixologie & Cave Privée",
  description: "Stock d'exception, recettes de cocktails et organisation de soirées",
};
```

with:

```tsx
export const metadata: Metadata = {
  title: "OpenBar — Mixologie & Cave Privée",
  description: "Stock d'exception, recettes de cocktails et organisation de soirées",
};
```

Replace:

```tsx
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange via-orange-dim to-brick-dark border border-orange/40 flex items-center justify-center text-ink text-lg font-black shadow-[0_0_15px_rgba(255,107,53,0.3)] group-hover:scale-105 transition-transform duration-200">
                N
              </span>
              <span>
                Le Bar <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange to-gold">de Noa</span>
              </span>
```

with:

```tsx
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange via-orange-dim to-brick-dark border border-orange/40 flex items-center justify-center text-ink text-lg font-black shadow-[0_0_15px_rgba(255,107,53,0.3)] group-hover:scale-105 transition-transform duration-200">
                O
              </span>
              <span>
                Open<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange to-gold">Bar</span>
              </span>
```

Replace:

```tsx
          Le Bar de Noa · Salon privé de mixologie © {new Date().getFullYear()}
```

with:

```tsx
          OpenBar · Salon privé de mixologie © {new Date().getFullYear()}
```

- [ ] **Step 2: Update `src/app/login/page.tsx`**

Replace:

```tsx
        <h1 className="font-display text-3xl text-cream mt-1">Le Bar de Noa</h1>
```

with:

```tsx
        <h1 className="font-display text-3xl text-cream mt-1">OpenBar</h1>
```

- [ ] **Step 3: Update `src/app/signup/page.tsx`**

Replace:

```tsx
        <h1 className="font-display text-3xl text-cream mt-1">Rejoindre Bardenoa</h1>
```

with:

```tsx
        <h1 className="font-display text-3xl text-cream mt-1">Rejoindre OpenBar</h1>
```

- [ ] **Step 4: Update `src/app/cocktails/CocktailStudio.tsx`**

Replace:

```tsx
                <span className="text-muted">Le Bar de Noa · Carte Cocktails</span>
```

with:

```tsx
                <span className="text-muted">OpenBar · Carte Cocktails</span>
```

- [ ] **Step 5: Update `src/app/stock/StockStudio.tsx`**

Replace:

```tsx
                <span className="text-muted">Le Bar de Noa · Studio Cave</span>
```

with:

```tsx
                <span className="text-muted">OpenBar · Studio Cave</span>
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/login/page.tsx src/app/signup/page.tsx src/app/cocktails/CocktailStudio.tsx src/app/stock/StockStudio.tsx
git commit -m "feat(web): rebrand from Le Bar de Noa to OpenBar"
```

---

### Task 2: `AdminBadge` → `AccountMenu` (3-state session awareness)

**Files:**
- Create: `src/components/AccountMenu.tsx`
- Delete: `src/components/AdminBadge.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `SessionUser` (existing, `src/lib/session.ts`: `{ sub: string; username: string; role: "ADMIN" | "USER"; vip: boolean }`), `logout` (existing, `src/app/login/actions.ts`).
- Produces: `AccountMenu({ session: SessionUser | null }): JSX.Element` — replaces `AdminBadge({ isAdmin: boolean })`.

- [ ] **Step 1: Create `AccountMenu.tsx`**

```tsx
// src/components/AccountMenu.tsx
"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { SessionUser } from "@/lib/session";

interface AccountMenuProps {
  session: SessionUser | null;
}

export default function AccountMenu({ session }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(() => {
      logout();
    });
  };

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-orange/15 border border-white/[0.08] hover:border-orange/40 text-xs font-semibold text-muted hover:text-orange transition-all duration-200"
        >
          <span className="hidden sm:inline">Se connecter</span>
        </Link>
        <Link
          href="/signup"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-xs font-semibold text-orange transition-all duration-200"
        >
          <span className="hidden sm:inline">Créer un compte</span>
        </Link>
      </div>
    );
  }

  const isAdmin = session.role === "ADMIN";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm transition-all duration-200 cursor-pointer ${
          isAdmin
            ? "bg-gradient-to-r from-orange/20 to-gold/15 border-orange/40 hover:border-orange text-cream"
            : "bg-white/[0.04] border-white/[0.08] hover:border-orange/40 text-muted hover:text-cream"
        }`}
        title={isAdmin ? "Session Administrateur active" : "Session active"}
      >
        {isAdmin && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange"></span>
          </span>
        )}
        <span className="tracking-wide">{isAdmin ? "Mode Admin" : session.username}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 mt-2 w-56 rounded-2xl bg-ink-2/95 backdrop-blur-xl border border-white/[0.1] p-3 shadow-2xl z-50 text-left font-sans"
            >
              <div className="px-2 py-1.5 border-b border-white/[0.08] mb-2">
                <span className="text-[10px] uppercase tracking-caps text-gold block font-semibold">
                  {isAdmin ? "Privilèges Administrateur" : "Compte"}
                </span>
                <span className="text-xs font-semibold text-cream mt-0.5 block">
                  {session.username}
                </span>
              </div>

              {isAdmin && (
                <Link
                  href="/comptes"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-cream hover:bg-white/[0.06] transition-colors w-full"
                >
                  <span>Gestion des comptes</span>
                  <span className="text-orange">→</span>
                </Link>
              )}

              <button
                type="button"
                disabled={isPending}
                onClick={handleLogout}
                className="mt-1 flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <span>{isPending ? "Déconnexion..." : "Se déconnecter"}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Delete the old component**

```bash
git rm src/components/AdminBadge.tsx
```

- [ ] **Step 3: Update `src/app/layout.tsx`**

Replace the import:

```tsx
import Navigation from "@/components/Navigation";
```

with:

```tsx
import Navigation from "@/components/Navigation";
import AccountMenu from "@/components/AccountMenu";
```

`Navigation.tsx` itself currently renders `AdminBadge` internally — move that rendering up to `layout.tsx` instead, since `AccountMenu` needs the full `session` object that `Navigation` doesn't otherwise need. In `src/components/Navigation.tsx`, remove the `AdminBadge` import and its usage:

Replace:

```tsx
import AdminBadge from "./AdminBadge";
```

with nothing (delete the line).

Replace:

```tsx
      <div className="pl-2 border-l border-white/[0.1] ml-1 flex items-center">
        <AdminBadge isAdmin={isAdmin} />
      </div>
```

with nothing (delete this block) — `Navigation` no longer renders the account widget itself, `layout.tsx` renders `AccountMenu` alongside it instead (see below). `Navigation`'s `isAdmin` prop stays as-is (still used for `ADMIN_NAV`).

Back in `src/app/layout.tsx`, replace:

```tsx
              {activeBar && bars.length > 1 && <BarSwitcher bars={bars} activeBarId={activeBar.id} />}
              <Navigation isAdmin={isAdmin} isBarOwner={activeBar?.myRole === "OWNER"} />
```

with:

```tsx
              {activeBar && bars.length > 1 && <BarSwitcher bars={bars} activeBarId={activeBar.id} />}
              <Navigation isAdmin={isAdmin} isBarOwner={activeBar?.myRole === "OWNER"} />
              <div className="pl-2 border-l border-white/[0.1] ml-1 flex items-center">
                <AccountMenu session={session} />
              </div>
```

(`session` is already fetched earlier in `layout.tsx` via `const session = await getSession();` — no new data fetching needed.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors (confirms `AdminBadge` has no other importers left).

- [ ] **Step 5: Manual check — all three states**

With the dev server running (`npm run dev` + API up):
1. Logged out: visit any page, confirm the header shows "Se connecter" and "Créer un compte" side by side.
2. Log in as a non-admin account (VIP or plain USER): confirm the header shows the username (not "Connexion Admin"), and clicking it opens a dropdown with the username and a working "Se déconnecter" — no "Gestion des comptes" link.
3. Log in as an ADMIN account: confirm the header shows "Mode Admin" exactly as before, with "Gestion des comptes" and "Se déconnecter" in the dropdown.

- [ ] **Step 6: Commit**

```bash
git add src/components/AccountMenu.tsx src/components/AdminBadge.tsx src/components/Navigation.tsx src/app/layout.tsx
git commit -m "feat(web): replace AdminBadge with session-aware AccountMenu"
```

---

### Task 3: Login page copy cleanup + reciprocal signup link

**Files:**
- Modify: `src/app/login/page.tsx`

**Interfaces:** None.

- [ ] **Step 1: Update the kicker and password placeholder**

Replace:

```tsx
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-16 bg-ink-2/40 border border-orange/10 p-8 rounded-xl box-orange-glow space-y-4">
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Espace réservé</span>
        <h1 className="font-display text-3xl text-cream mt-1">OpenBar</h1>
      </div>
      <form action={login} className="space-y-3">
        <input
          name="username"
          type="text"
          placeholder="Identifiant"
          required
          autoFocus
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        <input
          name="password"
          type="password"
          placeholder="Mot de passe d'administration"
          required
          autoFocus
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        {error && <p className="text-xs text-red-400 text-center">Mot de passe incorrect.</p>}
        <button
          type="submit"
          className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}
```

with:

```tsx
import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-16 bg-ink-2/40 border border-orange/10 p-8 rounded-xl box-orange-glow space-y-4">
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Connexion</span>
        <h1 className="font-display text-3xl text-cream mt-1">OpenBar</h1>
      </div>
      <form action={login} className="space-y-3">
        <input
          name="username"
          type="text"
          placeholder="Identifiant"
          required
          autoFocus
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        <input
          name="password"
          type="password"
          placeholder="Mot de passe"
          required
          autoFocus
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        {error && <p className="text-xs text-red-400 text-center">Mot de passe incorrect.</p>}
        <button
          type="submit"
          className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Se connecter
        </button>
      </form>
      <p className="text-center text-xs text-muted">
        Pas de compte ?{" "}
        <Link href="/signup" className="text-orange hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
```

(This replaces the whole file — it's only 44 lines and Task 1 already changed line 14's heading text to "OpenBar", which is reflected in the "before" block above.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Manual check**

Visit `/bar/login`, confirm the kicker says "Connexion" (not "Espace réservé"), the password field placeholder says "Mot de passe" (not "...d'administration"), and a "Pas de compte ? Créer un compte" link appears below the form and navigates to `/bar/signup`.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(web): de-admin-ify login copy and add signup link"
```

---

### Task 4: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check the whole frontend**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 2: Full manual walkthrough**

With the dev server running:
1. Confirm "OpenBar" appears (not "Le Bar de Noa"/"Bardenoa") in: the browser tab title, the header logo, the footer, the login heading, the signup heading, and the small watermarks on `/bar/stock` and `/bar/cocktails`.
2. Repeat the three-state check from Task 2 (logged out / non-admin / admin) once more end-to-end to confirm nothing regressed after Task 3's edits to the same file.
3. Confirm the reciprocal login↔signup links both work in both directions.

- [ ] **Step 3: Commit (only if the walkthrough surfaced fixes)**

No-op if the walkthrough passed clean — the feature is already fully committed task-by-task.
