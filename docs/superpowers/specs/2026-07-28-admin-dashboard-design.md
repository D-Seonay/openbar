# Admin Dashboard — Design

## Problem

The admin section has two separate pages — `/comptes` (account management) and
`/admin/bars` (bar management) — with no common landing page. An admin logging in
has no single place to see an overview of the platform before diving into one of
the two sections.

## Goal

A new `/admin` dashboard page: key platform stats at a glance, recent activity
(latest bars and accounts created), and quick links into the two existing
sections. Built entirely from data the app already fetches — no new API
endpoints, no new types.

## Data source

Both existing api-client functions already return everything needed:

- `listAllBars(): Promise<BarAdminSummary[]>` — each entry already has `id`,
  `name`, `ownerUsername`, `memberCount`, `isPublic`, `createdAt`.
- `listUsers(): Promise<AccountUser[]>` — each entry already has `id`,
  `username`, `role`, `vip`, `createdAt`.

Both are called today by `/admin/bars` and `/comptes` respectively — the
dashboard just calls both in parallel and derives everything else in the page
component. `BarAdminSummary.createdAt` is already fetched today but never
rendered anywhere (noted in the admin-bar-management feature's final review) —
this dashboard is the first place it gets used.

## Page: `src/app/admin/page.tsx`

Guard: `isAdminLoggedIn()` → `redirect("/login")` if false, same pattern as
every other admin page (`/comptes`, `/admin/bars`).

Fetches `listAllBars()` and `listUsers()` via `Promise.all` for one round trip.

### KPI cards

Following the pill style already established on `/comptes` and `/admin/bars`
(`bg-ink-2 border border-white/[0.08]` pills with a label + bold value):

- Total bars (`bars.length`)
- Bars publics vs. privés (`bars.filter(b => b.isPublic).length` / the rest)
- Total comptes (`users.length`)
- Comptes VIP (`users.filter(u => u.vip).length`)
- Comptes admin (`users.filter(u => u.role === "ADMIN").length`)

### Recent activity

Two side-by-side lists (reusing the existing card/list styling from
`/admin/bars`'s row layout):

- **5 derniers bars créés**: `[...bars].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)`,
  each row linking to `/admin/bars/${bar.id}` (existing route), showing name +
  owner + creation date.
- **5 derniers comptes créés**: same sort/slice pattern on `users`, showing
  username + role badge + creation date. No link (there's no per-user detail
  page — `/comptes` is a flat list with inline actions, not a detail route).

### Quick links

Two cards linking to `/comptes` and `/admin/bars`, matching the visual weight
of the KPI cards, so the dashboard is also a functional entry point, not just
a read-only summary.

## Navigation

`ADMIN_NAV` in `src/components/Navigation.tsx` gains a new first entry:

```ts
const ADMIN_NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/comptes", label: "Comptes" },
  { href: "/admin/bars", label: "Tous les bars" },
];
```

## Out of scope

- No new backend endpoints, no new Prisma queries, no new types.
- No date-range filtering, pagination, or configurable widgets on the
  dashboard — it's a fixed, simple overview.
- No stock/cocktail/soirée-level stats (e.g., total bottles across all bars) —
  those would require fetching every bar's content, which neither
  `listAllBars()` nor `listUsers()` currently does, and is out of scope for
  this pass.
