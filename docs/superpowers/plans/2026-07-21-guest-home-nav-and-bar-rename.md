# Guest Home Page, Conditional Navigation & Bar Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor without an account see a proper presentation page at `/` instead of being redirected to `/login`, hide the bar-internal navigation links (Cave & Stock, Cocktails, Soirées) from anyone not logged in, and let a bar's owner rename it from `/membres`.

**Architecture:** One new `BarsService`/`BarsController` method+route (`rename`, `PATCH /bars/:id/name`), one new prop on the existing `Navigation` component, and on the frontend a new guest-only landing component plus one more small owner-only section on `/membres`.

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL (API), Next.js 16 App Router + Server Actions (frontend), Jest (API unit tests only).

## Global Constraints

- Follow the existing module pattern exactly (`api/src/bars/`) — controller thin, DTO the only validation layer.
- No new npm dependencies.
- French user-facing strings and exception messages, matching the rest of the codebase.
- `next.config.ts` has `basePath: "/bar"` — no literal `/bar` prefix in any `redirect()`/`<Link href>`.
- The frontend has no test framework — verify with `npx tsc --noEmit -p .` and manual checks.
- Logged-in behavior at `/` (the existing dashboard) must not change at all — only the no-session branch changes.
- `Bar.name` stays without a uniqueness constraint (two bars can share a name, as today) — do not add one.

---

### Task 1: `BarsService`/`BarsController` — rename a bar

**Files:**
- Create: `api/src/bars/dto/rename-bar.dto.ts`
- Modify: `api/src/bars/bars.service.ts`
- Test: `api/src/bars/bars.service.spec.ts`
- Modify: `api/src/bars/bars.controller.ts`

**Interfaces:**
- Produces: `BarsService.rename(barId: string, requesterId: string, name: string): Promise<{ id: string; name: string }>` (owner-only), route `PATCH /bars/:id/name`.

- [ ] **Step 1: Create the DTO**

```ts
// api/src/bars/dto/rename-bar.dto.ts
import { IsString, MinLength } from 'class-validator';

export class RenameBarDto {
  @IsString()
  @MinLength(1)
  name: string;
}
```

- [ ] **Step 2: Write the failing tests**

In `api/src/bars/bars.service.spec.ts`, insert a new `describe('rename', ...)` block between the existing `setPublic` and `findDirectory` blocks. Anchor the edit on the exact boundary between them:

Replace:

```ts
      expect(result).toEqual({ id: BAR_ID, isPublic: false });
    });
  });

  describe('findDirectory', () => {
```

with:

```ts
      expect(result).toEqual({ id: BAR_ID, isPublic: false });
    });
  });

  describe('rename', () => {
    it('forbids a non-owner from renaming the bar', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.rename(BAR_ID, OTHER_ID, 'Nouveau Nom')).rejects.toThrow(ForbiddenException);
    });

    it('updates the bar name for the owner', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      prisma.bar.update.mockResolvedValue({ id: BAR_ID, name: 'Nouveau Nom' });

      const result = await service.rename(BAR_ID, OWNER_ID, 'Nouveau Nom');

      expect(prisma.bar.update).toHaveBeenCalledWith({
        where: { id: BAR_ID },
        data: { name: 'Nouveau Nom' },
      });
      expect(result).toEqual({ id: BAR_ID, name: 'Nouveau Nom' });
    });
  });

  describe('findDirectory', () => {
```

(The trailing `describe('findDirectory', () => {` line matters — it's the same line consumed by the "Replace" text above, and must be put back here so the file's structure stays intact. Everything after it in the real file — the existing `findDirectory` tests — is untouched by this edit.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd api && npx jest bars/bars.service.spec.ts -t "rename"`
Expected: FAIL — `service.rename is not a function`.

- [ ] **Step 4: Implement `rename`**

In `api/src/bars/bars.service.ts`, add after `setPublic`:

```ts
  async rename(barId: string, requesterId: string, name: string) {
    await this.assertOwner(barId, requesterId);
    const bar = await this.prisma.bar.update({
      where: { id: barId },
      data: { name },
    });
    return { id: bar.id, name: bar.name };
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: PASS, all tests (existing + 2 new) green.

- [ ] **Step 6: Wire the controller route**

In `api/src/bars/bars.controller.ts`, add the import:

```ts
import { RenameBarDto } from './dto/rename-bar.dto';
```

Add the route after `setPublic`:

```ts
  @UseGuards(JwtAuthGuard)
  @Patch(':id/name')
  rename(@Req() req: Request, @Param('id') id: string, @Body() dto: RenameBarDto) {
    const user = req.user as JwtPayload;
    return this.barsService.rename(id, user.sub, dto.name);
  }
```

- [ ] **Step 7: Run the full test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 8: Commit**

```bash
git add api/src/bars
git commit -m "feat(api): let a bar's owner rename it"
```

---

### Task 2: Frontend — rename UI on `/membres`

**Files:**
- Modify: `src/lib/api-client.ts`
- Modify: `src/app/bar-actions.ts`
- Create: `src/app/membres/BarNameSection.tsx`
- Modify: `src/app/membres/page.tsx`

**Interfaces:**
- Consumes: `PATCH /bars/:id/name` (Task 1).
- Produces: `renameBar(barId, name): Promise<{ id: string; name: string }>` (api-client), Server Action `renameBarAction(barId, name): Promise<{ error?: string }>`.

- [ ] **Step 1: Add `renameBar` to `api-client.ts`**

Add at the end of `src/lib/api-client.ts`:

```ts
export function renameBar(barId: string, name: string): Promise<{ id: string; name: string }> {
  return request(`/bars/${barId}/name`, { method: "PATCH", body: JSON.stringify({ name }) });
}
```

- [ ] **Step 2: Add `renameBarAction` to `bar-actions.ts`**

Add after `joinViaInviteLinkAction`:

```ts
export async function renameBarAction(barId: string, name: string): Promise<{ error?: string }> {
  await requireSession();
  try {
    await api.renameBar(barId, name);
    revalidatePath("/membres");
    return {};
  } catch (err) {
    return { error: err instanceof api.ApiError ? err.message : "Erreur lors du renommage" };
  }
}
```

- [ ] **Step 3: Create `BarNameSection.tsx`**

```tsx
// src/app/membres/BarNameSection.tsx
"use client";

import { useState, useTransition } from "react";
import { renameBarAction } from "@/app/bar-actions";

export default function BarNameSection({ barId, name }: { barId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await renameBarAction(barId, value);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-3">
      <div>
        <h2 className="font-display text-xl text-cream">Nom du bar</h2>
        <p className="text-muted text-[11px] mt-0.5">Visible par tous les membres et dans l&apos;annuaire.</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-orange"
        />
        <button
          disabled={isPending || !value.trim()}
          onClick={handleSave}
          className="text-xs px-3 py-2 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors cursor-pointer"
        >
          {saved ? "Enregistré !" : "Enregistrer"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Wire it into `src/app/membres/page.tsx`**

Replace:

```tsx
import InviteMemberForm from "./InviteMemberForm";
import MemberRow from "./MemberRow";
import PendingRequests from "./PendingRequests";
import BarVisibilitySection from "./BarVisibilitySection";
import InviteLinkSection from "./InviteLinkSection";
```

with:

```tsx
import InviteMemberForm from "./InviteMemberForm";
import MemberRow from "./MemberRow";
import PendingRequests from "./PendingRequests";
import BarVisibilitySection from "./BarVisibilitySection";
import InviteLinkSection from "./InviteLinkSection";
import BarNameSection from "./BarNameSection";
```

Replace:

```tsx
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl bg-ink-2 border border-white/[0.08] p-6 shadow-xl">
            <InviteMemberForm barId={activeBar.id} />
          </div>
          <BarVisibilitySection barId={activeBar.id} isPublic={activeBar.isPublic} />
          <InviteLinkSection barId={activeBar.id} inviteToken={activeBar.inviteToken} />
        </div>
```

with:

```tsx
        <div className="lg:col-span-4 space-y-6">
          <BarNameSection barId={activeBar.id} name={activeBar.name} />
          <div className="rounded-2xl bg-ink-2 border border-white/[0.08] p-6 shadow-xl">
            <InviteMemberForm barId={activeBar.id} />
          </div>
          <BarVisibilitySection barId={activeBar.id} isPublic={activeBar.isPublic} />
          <InviteLinkSection barId={activeBar.id} inviteToken={activeBar.inviteToken} />
        </div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 6: Manual check**

As a bar owner on `/bar/membres`, change the name field and click "Enregistrer" — confirm the page's own heading ("Membres de {name}") updates after the revalidation, and the bar switcher / directory reflect the new name too (both already read from `listMyBars()`/`listBarsDirectory()`, so no extra code is needed for them to pick it up).

- [ ] **Step 7: Commit**

```bash
git add src/lib/api-client.ts src/app/bar-actions.ts src/app/membres
git commit -m "feat(web): let a bar's owner rename it from /membres"
```

---

### Task 3: Frontend — hide bar-internal nav links for guests

**Files:**
- Modify: `src/components/Navigation.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `<Navigation isAdmin isBarOwner isLoggedIn />` — `isLoggedIn` is a new required prop.

- [ ] **Step 1: Add `isLoggedIn` to `Navigation.tsx`**

Replace:

```tsx
export default function Navigation({
  isAdmin,
  isBarOwner = false,
}: {
  isAdmin: boolean;
  isBarOwner?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
      {NAV.map((item) => navLink(item, pathname))}
      {isBarOwner && OWNER_NAV.map((item) => navLink(item, pathname))}
      {isAdmin && ADMIN_NAV.map((item) => navLink(item, pathname))}
    </nav>
  );
}
```

with:

```tsx
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

- [ ] **Step 2: Pass the new prop from `layout.tsx`**

Replace:

```tsx
              <Navigation isAdmin={isAdmin} isBarOwner={activeBar?.myRole === "OWNER"} />
```

with:

```tsx
              <Navigation isAdmin={isAdmin} isBarOwner={activeBar?.myRole === "OWNER"} isLoggedIn={!!session} />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 4: Manual check**

Visit `/bar/decouvrir` (or the new guest home page from Task 4) without a session — confirm the header shows no "Cave & Stock"/"Cocktails"/"Soirées" links. Log in and confirm they reappear.

- [ ] **Step 5: Commit**

```bash
git add src/components/Navigation.tsx src/app/layout.tsx
git commit -m "feat(web): hide bar-internal navigation links from logged-out visitors"
```

---

### Task 4: Frontend — guest landing page at `/`

**Files:**
- Create: `src/app/GuestLanding.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: `<GuestLanding />` — a static presentation component, no props.

- [ ] **Step 1: Create `GuestLanding.tsx`**

```tsx
// src/app/GuestLanding.tsx
import Link from "next/link";

export default function GuestLanding() {
  return (
    <div className="space-y-8">
      <div className="text-center py-16 space-y-6">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Salon de Mixologie & Bar Lounge</span>
        </div>
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-cream tracking-tight max-w-3xl mx-auto">
          Gérez votre bar,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange to-gold">
            entre passionnés
          </span>
        </h1>
        <p className="text-muted max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          Cave, cocktails, soirées et invitations : OpenBar centralise la gestion de votre bar privé
          et vous permet de découvrir ceux des autres.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange to-orange-hover text-ink font-extrabold text-xs uppercase tracking-wider box-orange-glow transition-all hover:brightness-110"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl bg-ink-2 hover:bg-ink-2/80 border border-white/[0.08] text-xs font-semibold uppercase tracking-wider text-cream hover:border-orange/50 transition-all"
          >
            Créer un compte
          </Link>
        </div>
      </div>

      <Link
        href="/decouvrir"
        className="block rounded-2xl bg-ink-2/80 border border-white/[0.08] p-6 shadow-xl hover:border-orange/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-caps text-gold font-bold">Annuaire public</span>
            <p className="font-display text-xl font-bold text-cream mt-1">Découvrir les bars</p>
            <p className="text-xs text-muted mt-1">Parcourez les bars ouverts au public, sans compte.</p>
          </div>
          <span className="text-orange text-lg font-bold">→</span>
        </div>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Change the no-session branch in `src/app/page.tsx`**

Replace:

```tsx
export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
```

with:

```tsx
export default async function HomePage() {
  const session = await getSession();
  if (!session) return <GuestLanding />;

  const bars = await listMyBars();
```

Add the import at the top of the file, alongside the other local imports:

```tsx
import GuestLanding from "./GuestLanding";
```

(`redirect` stays imported and used — the `if (!activeBar) redirect("/creer");` line further down is unaffected.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 4: Manual check**

Without a session, visit `/bar/` — confirm it renders the new presentation section (no redirect to `/login`), and that "Découvrir les bars" links to `/bar/decouvrir`. Log in and confirm `/bar/` still shows the full existing dashboard exactly as before (KPI grid, next soirée, directory) — nothing about the logged-in path should look any different.

- [ ] **Step 5: Commit**

```bash
git add src/app/GuestLanding.tsx src/app/page.tsx
git commit -m "feat(web): show a guest-friendly landing page at / instead of redirecting to login"
```

---

### Task 5: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full API test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 2: Type-check the whole frontend**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Full manual walkthrough**

1. Logged out, visit `/bar/`: see the new presentation page, no redirect; header shows no Cave & Stock/Cocktails/Soirées links; "Découvrir les bars" leads to `/bar/decouvrir`.
2. Logged out, visit `/bar/decouvrir` directly: same nav behavior (no bar-internal links).
3. Log in as an account with no bar: header nav now shows Cave & Stock/Cocktails/Soirées; `/bar/` shows the full dashboard as before this plan (unchanged).
4. As a bar owner, rename the bar from `/bar/membres` — confirm the page's own "Membres de {name}" heading updates, and the new name shows up in the bar switcher and (if the bar is public) the directory.
5. Confirm a non-owner member cannot rename the bar (e.g. via a direct API call with their own session — should get a 403).

- [ ] **Step 4: Commit (only if the walkthrough surfaced fixes)**

No-op if the walkthrough passed clean — the feature is already fully committed task-by-task.
