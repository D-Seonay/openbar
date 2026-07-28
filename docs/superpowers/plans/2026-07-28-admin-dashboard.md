# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/admin` dashboard page showing key platform stats, recent activity (latest bars/accounts), and quick links into the existing `/comptes` and `/admin/bars` sections — built entirely from data the app already fetches.

**Architecture:** One new server component page that calls the two existing api-client functions `listAllBars()` and `listUsers()` in parallel and derives everything else (counts, sorted recent lists) in the component. One small change to `Navigation.tsx` to link to it.

**Tech Stack:** Next.js 16 App Router (`src/`). No backend changes. No frontend test framework in this project — verified via `tsc --noEmit` and manual/live checks, consistent with every other frontend-only task in this project's history.

## Global Constraints

- No new API endpoints, Prisma queries, or types — this feature only reads `BarAdminSummary[]` (from `listAllBars()`) and `AccountUser[]` (from `listUsers()`), both of which already include `createdAt`.
- Guard pattern: `isAdminLoggedIn()` → `redirect("/login")` if false, matching every other admin page (`/comptes`, `/admin/bars`).
- Visual style must match the existing admin pages exactly: the `PageTransition` wrapper, the "Espace Administrateur" eyebrow + `font-display` heading block, the `bg-ink-2 border border-white/[0.08]` pill style for stats, and the `bg-ink-2/60 ... divide-y divide-white/[0.06]` list-row style — all copied verbatim from `src/app/admin/bars/page.tsx` and `src/app/comptes/page.tsx`.
- Full spec: `docs/superpowers/specs/2026-07-28-admin-dashboard-design.md`.

---

### Task 1: `/admin` dashboard page + nav entry

**Files:**
- Create: `src/app/admin/page.tsx`
- Modify: `src/components/Navigation.tsx` (all of it)

**Interfaces:**
- Consumes: `listAllBars(): Promise<BarAdminSummary[]>` and `listUsers(): Promise<AccountUser[]>` from `@/lib/api-client` (both already exist, unchanged), `isAdminLoggedIn()` from `@/lib/session` (already exists, unchanged).
- Produces: nothing consumed by later work — this is a leaf page.

**Note on `Navigation.tsx`'s active-link detection:** `navLink()` currently marks
an item active via `pathname.startsWith(item.href)`. Adding `/admin` as a nav
entry ahead of `/admin/bars` creates a real conflict: visiting `/admin/bars`
(or any of its sub-pages) would make `pathname.startsWith("/admin")` true,
so **both** "Tableau de bord" and "Tous les bars" would render as active at
once, since `/admin/bars` is syntactically nested under `/admin`. This step
fixes that with a small, backward-compatible `exact` flag — every existing
nav item keeps prefix-matching behavior unchanged; only the new `/admin`
entry opts into exact matching.

- [ ] **Step 1: Create the dashboard page**

Create `src/app/admin/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllBars, listUsers } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";

export default async function AdminDashboardPage() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const [bars, users] = await Promise.all([listAllBars(), listUsers()]);

  const publicBarsCount = bars.filter((b) => b.isPublic).length;
  const privateBarsCount = bars.length - publicBarsCount;
  const vipUsersCount = users.filter((u) => u.vip).length;
  const adminUsersCount = users.filter((u) => u.role === "ADMIN").length;

  const recentBars = [...bars]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const recentUsers = [...users]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Espace Administrateur</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            Tableau de bord
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">Bars</span>
          <span className="text-cream font-bold text-xl">{bars.length}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">Bars publics</span>
          <span className="text-cream font-bold text-xl">{publicBarsCount}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">Bars privés</span>
          <span className="text-cream font-bold text-xl">{privateBarsCount}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">Comptes</span>
          <span className="text-cream font-bold text-xl">{users.length}</span>
        </div>
        <div className="px-4 py-3 rounded-xl bg-ink-2 border border-white/[0.08]">
          <span className="text-muted block text-[10px] uppercase font-semibold">VIP / Admin</span>
          <span className="text-cream font-bold text-xl">
            {vipUsersCount} <span className="text-muted text-sm font-normal">/</span> {adminUsersCount}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/comptes"
          className="p-5 rounded-2xl bg-ink-2/60 border border-white/[0.08] hover:bg-ink-2 transition-colors shadow-xl"
        >
          <p className="font-display font-bold text-lg text-cream">Comptes & Privilèges VIP</p>
          <p className="text-xs text-muted mt-1">Gérer les comptes, rôles et statuts VIP.</p>
        </Link>
        <Link
          href="/admin/bars"
          className="p-5 rounded-2xl bg-ink-2/60 border border-white/[0.08] hover:bg-ink-2 transition-colors shadow-xl"
        >
          <p className="font-display font-bold text-lg text-cream">Tous les bars</p>
          <p className="text-xs text-muted mt-1">Voir et gérer le contenu de chaque bar.</p>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-caps text-gold-dim mb-3">
            Derniers bars créés
          </h2>
          <div className="rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
            {recentBars.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">Aucun bar pour l&apos;instant.</div>
            ) : (
              recentBars.map((bar) => (
                <Link
                  key={bar.id}
                  href={`/admin/bars/${bar.id}`}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-ink-2 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-sm text-cream">{bar.name}</p>
                    <p className="text-xs text-muted mt-0.5">Par {bar.ownerUsername}</p>
                  </div>
                  <span className="text-[10px] text-muted whitespace-nowrap">
                    {new Date(bar.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-caps text-gold-dim mb-3">
            Derniers comptes créés
          </h2>
          <div className="rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
            {recentUsers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">Aucun compte pour l&apos;instant.</div>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-sm text-cream">{user.username}</p>
                    {user.role === "ADMIN" && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gold text-ink">
                        Admin
                      </span>
                    )}
                    {user.vip && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-orange/20 text-orange border border-orange/30">
                        VIP
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted whitespace-nowrap">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Update `Navigation.tsx` with the new entry and the `exact`-match fix**

Replace `src/components/Navigation.tsx` in full with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/stock", label: "Cave & Stock" },
  { href: "/cocktails", label: "Cocktails" },
  { href: "/soirees", label: "Soirées" },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Tableau de bord", exact: true },
  { href: "/comptes", label: "Comptes" },
  { href: "/admin/bars", label: "Tous les bars" },
];
const OWNER_NAV = [{ href: "/membres", label: "Membres" }];

function navLink(item: { href: string; label: string; exact?: boolean }, pathname: string) {
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      key={item.href}
      href={item.href}
      className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
        isActive
          ? "bg-gradient-to-r from-orange/20 to-gold/15 text-cream border border-orange/40 shadow-[0_0_15px_rgba(255,107,53,0.18)]"
          : "text-muted hover:text-cream hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <span>{item.label}</span>
    </Link>
  );
}

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

(Only `ADMIN_NAV` and `navLink`'s signature/body actually changed — `NAV`,
`OWNER_NAV`, and the default export are reproduced unchanged so the file
stays complete and copy-pasteable.)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p .
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

With the web and API dev servers running (and the database reachable):

1. Log in as an admin. Confirm "Tableau de bord" now appears as the first
   admin nav entry, ahead of "Comptes" and "Tous les bars".
2. Visit `/admin`. Confirm the KPI numbers match reality (cross-check
   against what `/comptes` and `/admin/bars` show — e.g. total comptes on
   `/admin` should equal the row count on `/comptes`).
3. Confirm "Derniers bars créés" and "Derniers comptes créés" show up to 5
   entries each, most recent first, and that clicking a bar row navigates to
   `/admin/bars/{id}`.
4. Confirm the two quick-link cards navigate to `/comptes` and `/admin/bars`.
5. **Specifically check the nav active-state fix**: while on `/admin/bars` (or
   a `/admin/bars/[id]` sub-page), confirm "Tableau de bord" is *not*
   highlighted as active and only "Tous les bars" is. While on `/admin`,
   confirm only "Tableau de bord" is highlighted.
6. Log in as a non-admin user and confirm none of the admin nav entries
   (including "Tableau de bord") appear, and that navigating to `/admin`
   directly redirects to `/login` (the guard doesn't distinguish "not admin"
   from "not logged in" — `isAdminLoggedIn()` returns `false` for both,
   matching every other admin page's existing behavior).

If no dev stack is reachable in this environment, note that explicitly
instead of skipping this step silently.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/components/Navigation.tsx
git commit -m "feat(web): add admin dashboard page"
```
