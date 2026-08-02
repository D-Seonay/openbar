# Wishlist Item Self-Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any logged-in bar member claim ("s'assigner") a wishlist item to say they'll bring it, see who else has claimed it, and un-claim their own assignment — without exclusivity (multiple people can claim the same item).

**Architecture:** A new `WishlistItemAssignment` join-table model (many-to-many between `WishlistItem` and `User`, one row per claim), two new routes on the existing `api/src/wishlist/` module (`POST`/`DELETE .../wishlist/:id/assign`), and an extension of the existing `WishlistSection.tsx` component to show assignees and a claim/unclaim button.

**Tech Stack:** NestJS + Prisma (API), Next.js App Router server components + server actions (web) — no new dependencies.

## Global Constraints

- Multiple users can assign themselves to the same item — no exclusivity check, no "already taken" rejection. The database enforces only "the same user can't double-claim the same item" via `@@unique([wishlistItemId, userId])`.
- Assigning is open to **any authenticated bar member** — no `isOwnerOrAdmin` check (unlike creating/deleting wishlist items themselves, which stay host-only and are unaffected by this plan).
- Un-assigning is **self-only**: a user can only remove their own assignment. Rejecting with `NotFoundException` (not `ForbiddenException`) when the caller isn't the assignment's owner, matching `ContributionsService.remove`'s exact precedent — this avoids leaking whether someone else's assignment exists.
- No new npm dependencies.
- Exact values: model name `WishlistItemAssignment`, route suffix `:id/assign`, migration folder `api/prisma/migrations/20260802130000_add_wishlist_item_assignment/` — these are the concrete values from `docs/superpowers/specs/2026-08-02-wishlist-assignment-design.md` and must be used verbatim.

---

## Task 1: Prisma schema and migration

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260802130000_add_wishlist_item_assignment/migration.sql`

**Interfaces:**
- Produces: Prisma model `WishlistItemAssignment` with fields `id`, `wishlistItemId`, `userId`, `createdAt`, relations `wishlistItem: WishlistItem` and `user: User`, and a compound unique constraint on `(wishlistItemId, userId)`. `WishlistItem` gains `assignments: WishlistItemAssignment[]`, `User` gains `wishlistAssignments: WishlistItemAssignment[]`. Task 2's service consumes `prisma.wishlistItemAssignment.*`.

- [ ] **Step 1: Add the relation field to `WishlistItem`**

In `api/prisma/schema.prisma`, find the `WishlistItem` model:

```prisma
model WishlistItem {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  label     String
  createdAt DateTime @default(now())
}
```

Add `assignments WishlistItemAssignment[]` as the last field:

```prisma
model WishlistItem {
  id          String                   @id @default(cuid())
  eventId     String
  event       Event                    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  label       String
  createdAt   DateTime                 @default(now())
  assignments WishlistItemAssignment[]
}
```

- [ ] **Step 2: Add the relation field to `User`**

Find the `User` model and add `wishlistAssignments WishlistItemAssignment[]` right after the existing `contributions Contribution[]` line:

```prisma
  contributions      Contribution[]
  wishlistAssignments WishlistItemAssignment[]
```

- [ ] **Step 3: Add the new model**

Add this model right after the `WishlistItem` model (after its closing `}`):

```prisma
model WishlistItemAssignment {
  id             String       @id @default(cuid())
  wishlistItemId String
  wishlistItem   WishlistItem @relation(fields: [wishlistItemId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  createdAt      DateTime     @default(now())

  @@unique([wishlistItemId, userId])
}
```

- [ ] **Step 4: Write the migration SQL**

Create `api/prisma/migrations/20260802130000_add_wishlist_item_assignment/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "WishlistItemAssignment" (
    "id" TEXT NOT NULL,
    "wishlistItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItemAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItemAssignment_wishlistItemId_userId_key" ON "WishlistItemAssignment"("wishlistItemId", "userId");

-- AddForeignKey
ALTER TABLE "WishlistItemAssignment" ADD CONSTRAINT "WishlistItemAssignment_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "WishlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItemAssignment" ADD CONSTRAINT "WishlistItemAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

(The `userId` foreign key uses `ON DELETE RESTRICT`, matching `Contribution_userId_fkey`'s existing convention in this repo — users aren't deleted while they have live assignments.)

- [ ] **Step 5: Validate the schema and regenerate the Prisma client**

Run (from the `api/` directory):

```bash
cd api
npx prisma validate
npx prisma generate
```

Expected: `npx prisma validate` prints `The schema at prisma/schema.prisma is valid 🚀` and exits 0. `npx prisma generate` completes without error, making `prisma.wishlistItemAssignment` a typed client method. No live database is touched (none is running in this environment) — the migration SQL is applied automatically in production by `prisma migrate deploy`, already wired into `api/Dockerfile`'s `CMD`.

- [ ] **Step 6: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/20260802130000_add_wishlist_item_assignment/
git commit -m "feat(api): add WishlistItemAssignment model for self-assignment"
```

---

## Task 2: API — assign/unassign routes and updated read

**Files:**
- Modify: `api/src/wishlist/wishlist.service.ts`
- Modify: `api/src/wishlist/wishlist.controller.ts`
- Modify: `api/src/wishlist/wishlist.service.spec.ts`

**Interfaces:**
- Consumes: `prisma.wishlistItemAssignment` (Task 1).
- Produces: `GET /events/:slug/wishlist` now returns items with an `assignments: { id: string; user: { id: string; username: string } }[]` field on each. Two new routes: `POST /events/:slug/wishlist/:id/assign` (body: none, uses the authenticated user) → the created/existing assignment; `DELETE /events/:slug/wishlist/:id/assign` → `{ success: true }`. Task 3's `api-client.ts` consumes both.

- [ ] **Step 1: Update `findForEvent` to include assignments**

In `api/src/wishlist/wishlist.service.ts`, replace the `findForEvent` method:

```typescript
  async findForEvent(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.wishlistItem.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
      include: {
        assignments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, username: true } } },
        },
      },
    });
  }
```

- [ ] **Step 2: Add `assign` and `unassign` to the service**

In the same file, add these two methods right after `remove` (after its closing `}`, before the class's closing `}`):

```typescript
  async assign(slug: string, itemId: string, userId: string) {
    const event = await this.eventsService.findBySlug(slug);
    const item = await this.prisma.wishlistItem.findUnique({ where: { id: itemId } });
    if (!item || item.eventId !== event.id) {
      throw new NotFoundException('Item introuvable');
    }
    const existing = await this.prisma.wishlistItemAssignment.findUnique({
      where: { wishlistItemId_userId: { wishlistItemId: itemId, userId } },
      include: { user: { select: { id: true, username: true } } },
    });
    if (existing) return existing;
    return this.prisma.wishlistItemAssignment.create({
      data: { wishlistItemId: itemId, userId },
      include: { user: { select: { id: true, username: true } } },
    });
  }

  async unassign(slug: string, itemId: string, userId: string) {
    const event = await this.eventsService.findBySlug(slug);
    const item = await this.prisma.wishlistItem.findUnique({ where: { id: itemId } });
    if (!item || item.eventId !== event.id) {
      throw new NotFoundException('Item introuvable');
    }
    const assignment = await this.prisma.wishlistItemAssignment.findUnique({
      where: { wishlistItemId_userId: { wishlistItemId: itemId, userId } },
    });
    if (!assignment) {
      throw new NotFoundException('Assignation introuvable');
    }
    await this.prisma.wishlistItemAssignment.delete({ where: { id: assignment.id } });
    return { success: true };
  }
```

Note: `wishlistItemId_userId` is Prisma's auto-generated compound-key name for the `@@unique([wishlistItemId, userId])` constraint from Task 1 (field names joined by `_`, in schema declaration order).

- [ ] **Step 3: Add the two routes to the controller**

In `api/src/wishlist/wishlist.controller.ts`, add these two methods inside the `WishlistController` class, after the existing `remove` method (after its closing `}`, before the class's closing `}`):

```typescript
  @UseGuards(JwtAuthGuard)
  @Post(':id/assign')
  async assign(@Param('slug') slug: string, @Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.wishlistService.assign(slug, id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/assign')
  async unassign(@Param('slug') slug: string, @Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.wishlistService.unassign(slug, id, user.sub);
  }
```

These two new routes deliberately do NOT call `barAccessService.assertMember`/check `isOwnerOrAdmin` — assigning is open to any authenticated user who can reach the route, matching the Global Constraint that this is a guest action, not a host-only one.

- [ ] **Step 4: Write the failing tests**

In `api/src/wishlist/wishlist.service.spec.ts`, add `wishlistItemAssignment` mocks to the existing `prisma` object in `beforeEach` (alongside the existing `wishlistItem` key):

```typescript
    prisma = {
      wishlistItem: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      wishlistItemAssignment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };
```

Then add these test cases at the end of the `describe('WishlistService', ...)` block, right before its closing `});`:

```typescript
  it('creates an assignment when the user has not already claimed the item', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });
    prisma.wishlistItemAssignment.findUnique.mockResolvedValue(null);
    const created = { id: 'assign-1', wishlistItemId: 'item-1', userId: 'user-1', user: { id: 'user-1', username: 'Alice' } };
    prisma.wishlistItemAssignment.create.mockResolvedValue(created);

    const result = await service.assign('apero-du-samedi-a1b2c3d4', 'item-1', 'user-1');

    expect(prisma.wishlistItemAssignment.create).toHaveBeenCalledWith({
      data: { wishlistItemId: 'item-1', userId: 'user-1' },
      include: { user: { select: { id: true, username: true } } },
    });
    expect(result).toEqual(created);
  });

  it('is idempotent when the user has already claimed the item', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });
    const existing = { id: 'assign-1', wishlistItemId: 'item-1', userId: 'user-1', user: { id: 'user-1', username: 'Alice' } };
    prisma.wishlistItemAssignment.findUnique.mockResolvedValue(existing);

    const result = await service.assign('apero-du-samedi-a1b2c3d4', 'item-1', 'user-1');

    expect(prisma.wishlistItemAssignment.create).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it('rejects assigning to an item from a different event', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'item-1', eventId: 'event-2', label: 'Glaçons' });

    await expect(service.assign('apero-du-samedi-a1b2c3d4', 'item-1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('removes the assignment when the caller owns it', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });
    prisma.wishlistItemAssignment.findUnique.mockResolvedValue({ id: 'assign-1', wishlistItemId: 'item-1', userId: 'user-1' });

    const result = await service.unassign('apero-du-samedi-a1b2c3d4', 'item-1', 'user-1');

    expect(prisma.wishlistItemAssignment.delete).toHaveBeenCalledWith({ where: { id: 'assign-1' } });
    expect(result).toEqual({ success: true });
  });

  it('rejects unassigning when the caller has no assignment on the item', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });
    prisma.wishlistItemAssignment.findUnique.mockResolvedValue(null);

    await expect(service.unassign('apero-du-samedi-a1b2c3d4', 'item-1', 'user-1')).rejects.toThrow(NotFoundException);
    expect(prisma.wishlistItemAssignment.delete).not.toHaveBeenCalled();
  });
```

- [ ] **Step 5: Run the tests**

Run (from the `api/` directory): `cd api && npx jest wishlist.service.spec.ts`
Expected: 10 tests pass (the 5 pre-existing ones from the prior plan plus these 5 new ones).

- [ ] **Step 6: Typecheck**

Run: `cd api && npx tsc --noEmit`
Expected: no new errors (pre-existing unrelated errors in `scripts/` and `src/bars/bars.service.spec.ts` are not this task's concern).

- [ ] **Step 7: Commit**

```bash
git add api/src/wishlist
git commit -m "feat(api): let any bar member self-assign to a wishlist item"
```

---

## Task 3: Frontend data layer (types, api-client, actions)

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api-client.ts`
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: the two new routes from Task 2, and the updated `GET` response shape.
- Produces: `WishlistItem.assignments` field, `assignWishlistItem(slug, itemId): Promise<WishlistItemAssignment>`, `unassignWishlistItem(slug, itemId): Promise<{ success: boolean }>` in `api-client.ts`; `assignWishlistItemAction(slug, itemId)` and `unassignWishlistItemAction(slug, itemId)` server actions. Task 4's `WishlistSection.tsx` consumes the two actions and the `assignments` field.

- [ ] **Step 1: Extend the `WishlistItem` type and add `WishlistItemAssignment`**

In `src/lib/types.ts`, find the `WishlistItem` interface:

```typescript
export interface WishlistItem {
  id: string;
  eventId: string;
  label: string;
  createdAt: string;
}
```

Replace it with:

```typescript
export interface WishlistItemAssignment {
  id: string;
  user: { id: string; username: string };
}

export interface WishlistItem {
  id: string;
  eventId: string;
  label: string;
  createdAt: string;
  assignments: WishlistItemAssignment[];
}
```

- [ ] **Step 2: Add the api-client functions**

In `src/lib/api-client.ts`, add these two functions right after the existing `deleteWishlistItem` function (after its closing `}`):

```typescript
export function assignWishlistItem(slug: string, itemId: string): Promise<WishlistItemAssignment> {
  return request<WishlistItemAssignment>(`/events/${slug}/wishlist/${itemId}/assign`, {
    method: "POST",
  });
}

export function unassignWishlistItem(slug: string, itemId: string): Promise<{ success: boolean }> {
  return request(`/events/${slug}/wishlist/${itemId}/assign`, { method: "DELETE" });
}
```

Add `WishlistItemAssignment` to the `import type { ... } from "./types";` block, alongside the existing `WishlistItem`.

- [ ] **Step 3: Add the server actions**

In `src/app/actions.ts`, add these two functions right after the existing `deleteWishlistItemAction` function (after its closing `}`):

```typescript
export async function assignWishlistItemAction(slug: string, itemId: string) {
  await api.assignWishlistItem(slug, itemId);
  revalidatePath(`/soirees/${slug}`);
}

export async function unassignWishlistItemAction(slug: string, itemId: string) {
  await api.unassignWishlistItem(slug, itemId);
  revalidatePath(`/soirees/${slug}`);
}
```

- [ ] **Step 4: Typecheck**

Run (from the repo root): `npx tsc --noEmit`
Expected: no errors. Note: this WILL surface a type error in `src/app/soirees/[slug]/WishlistSection.tsx` if that file destructures `WishlistItem` fields incompatible with the new `assignments` field — that's expected and is what Task 4 fixes; if this task's own three files (`types.ts`, `api-client.ts`, `actions.ts`) compile without error, this task's step is satisfied even if the pre-existing `WishlistSection.tsx` shows unrelated errors from the widened type. Confirm by running `npx tsc --noEmit 2>&1 | grep -v "WishlistSection.tsx"` and checking there is no other output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/api-client.ts src/app/actions.ts
git commit -m "feat(web): add types, api-client functions, and server actions for wishlist self-assignment"
```

---

## Task 4: Frontend UI — assign/unassign in `WishlistSection`

**Files:**
- Modify: `src/app/soirees/[slug]/WishlistSection.tsx`
- Modify: `src/app/soirees/[slug]/page.tsx`

**Interfaces:**
- Consumes: `assignWishlistItemAction`/`unassignWishlistItemAction` (Task 3), `WishlistItem.assignments` (Task 3), `session.sub` (already available in `page.tsx`).

- [ ] **Step 1: Add the `currentUserId` prop and render assignees + claim button**

In `src/app/soirees/[slug]/WishlistSection.tsx`, update the function signature:

```tsx
export default function WishlistSection({
  slug,
  items,
  canManage,
  currentUserId,
}: {
  slug: string;
  items: WishlistItem[];
  canManage: boolean;
  currentUserId: string;
}) {
```

Add the import at the top of the file, alongside the existing action imports:

```tsx
import { addWishlistItemAction, deleteWishlistItemAction, assignWishlistItemAction, unassignWishlistItemAction } from "@/app/actions";
```

Inside the `<li>` that renders each item, replace:

```tsx
            <li
              key={wishlistItem.id}
              className="rounded-xl border border-white/[0.08] bg-ink/70 px-3.5 sm:px-4 py-3 flex items-center justify-between gap-3 text-xs text-cream hover:border-orange/30 transition-all"
            >
              <span className="font-semibold text-cream break-words">{wishlistItem.label}</span>
              {canManage && (
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => deleteWishlistItemAction(slug, wishlistItem.id))}
                  className="tap-target-sm shrink-0 flex items-center px-1.5 text-[10px] text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Retirer
                </button>
              )}
            </li>
```

with:

```tsx
            <li
              key={wishlistItem.id}
              className="rounded-xl border border-white/[0.08] bg-ink/70 px-3.5 sm:px-4 py-3 space-y-2 text-xs text-cream hover:border-orange/30 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-cream break-words">{wishlistItem.label}</span>
                {canManage && (
                  <button
                    disabled={isPending}
                    onClick={() => startTransition(() => deleteWishlistItemAction(slug, wishlistItem.id))}
                    className="tap-target-sm shrink-0 flex items-center px-1.5 text-[10px] text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Retirer
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                {wishlistItem.assignments.length > 0 ? (
                  <span className="text-[10px] text-muted">
                    Pris par {wishlistItem.assignments.map((a) => a.user.username).join(", ")}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted italic">Personne pour l&apos;instant</span>
                )}

                {wishlistItem.assignments.some((a) => a.user.id === currentUserId) ? (
                  <button
                    disabled={isPending}
                    onClick={() => startTransition(() => unassignWishlistItemAction(slug, wishlistItem.id))}
                    className="tap-target-sm shrink-0 flex items-center px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.08] hover:border-red-400/40 text-[10px] text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Je ne peux plus
                  </button>
                ) : (
                  <button
                    disabled={isPending}
                    onClick={() => startTransition(() => assignWishlistItemAction(slug, wishlistItem.id))}
                    className="tap-target-sm shrink-0 flex items-center px-2.5 py-1 rounded-lg bg-orange/15 hover:bg-orange/25 border border-orange/40 text-[10px] text-orange font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Je m&apos;en occupe
                  </button>
                )}
              </div>
            </li>
```

- [ ] **Step 2: Pass `currentUserId` from `page.tsx`**

In `src/app/soirees/[slug]/page.tsx`, find the existing `<WishlistSection slug={slug} items={wishlistItems} canManage={canManageWishlist} />` call and add the new prop:

```tsx
<WishlistSection slug={slug} items={wishlistItems} canManage={canManageWishlist} currentUserId={session.sub} />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint "src/app/soirees/[slug]/WishlistSection.tsx" "src/app/soirees/[slug]/page.tsx"`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/soirees/[slug]/WishlistSection.tsx" "src/app/soirees/[slug]/page.tsx"
git commit -m "feat(web): let guests claim and unclaim wishlist items"
```
