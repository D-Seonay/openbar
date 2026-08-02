# Event Wishlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a bar owner (or admin) manage a host-defined, purely informational "things to bring" list on a soirée page, separate from the existing guest-contribution system.

**Architecture:** A new `WishlistItem` Prisma model (one-to-many from `Event`, same shape as `Contribution`) backed by a new NestJS module `api/src/wishlist/` mirroring `api/src/contributions/`'s structure. The frontend adds a data layer (types, api-client, server actions) and one new component rendered alongside the existing `GuestPanel` on `/soirees/[slug]`.

**Tech Stack:** NestJS + Prisma (API), Next.js App Router server components + server actions (web) — no new dependencies.

## Global Constraints

- The wishlist is **separate** from the contribution system — no linking, no shared UI, no changes to `GuestPanel.tsx`'s existing hardcoded `QUICK_ITEMS`.
- Write access (`POST`/`DELETE`) is restricted server-side to `isOwnerOrAdmin` (bar owner or global admin) via `BarAccessService.assertMember`, mirroring exactly how `EventsController.create`/`remove` already enforce this. Frontend-side `canManage` gating is display-only — the API is the actual enforcement boundary.
- `WishlistItem.label` is a single free-text field — no separate quantity field (YAGNI per the spec).
- Read access (`GET /events/:slug/wishlist`) uses `OptionalJwtAuthGuard`, matching the existing lenient read pattern already used by `GET /events/:slug/contributions`.
- No new npm dependencies for either the `api` or the root Next.js app.
- Exact values: model name `WishlistItem`, route prefix `events/:slug/wishlist`, DTO field name `label`, migration folder `api/prisma/migrations/20260802120000_add_wishlist_item/` — these are the concrete values from `docs/superpowers/specs/2026-08-02-event-wishlist-design.md` and must be used verbatim.

---

## Task 1: Prisma schema and migration

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260802120000_add_wishlist_item/migration.sql`

**Interfaces:**
- Produces: Prisma model `WishlistItem` with fields `id: string`, `eventId: string`, `label: string`, `createdAt: DateTime`, and relation `event: Event`. `Event` gains `wishlistItems: WishlistItem[]`. Task 2's service/controller consume `prisma.wishlistItem.*` — this task is what makes that client method exist.

- [ ] **Step 1: Add the `WishlistItem` model to the schema**

Open `api/prisma/schema.prisma`. Find the `Event` model (starts with `model Event {`) and add a relation field right after `stockAdjustments    StockAdjustment[]`:

```prisma
model Event {
  id               String            @id @default(cuid())
  slug             String            @unique
  name             String
  date             String
  isClosed         Boolean           @default(false)
  barId            String
  bar              Bar               @relation(fields: [barId], references: [id], onDelete: Cascade)
  createdAt        DateTime          @default(now())
  contributions    Contribution[]
  stockAdjustments StockAdjustment[]
  wishlistItems    WishlistItem[]
}
```

Then add a new model right after the `Contribution` model (after its closing `}`):

```prisma
model WishlistItem {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  label     String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Write the migration SQL**

Create `api/prisma/migrations/20260802120000_add_wishlist_item/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Validate the schema and regenerate the Prisma client**

Run (from the `api/` directory):

```bash
cd api
npx prisma validate
npx prisma generate
```

Expected: `npx prisma validate` prints `The schema at prisma/schema.prisma is valid 🚀` and exits 0 (it only checks the schema file itself — no live database connection is needed or attempted). `npx prisma generate` regenerates `@prisma/client` so `prisma.wishlistItem` is a typed client method — expect it to complete without error. This does not apply the migration to any database (no local Postgres is running in this environment); the migration SQL file is what `prisma migrate deploy` will apply automatically on the next production deploy (see `api/Dockerfile`'s `CMD`, which already runs `npx prisma migrate deploy` on container start).

- [ ] **Step 4: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/20260802120000_add_wishlist_item/
git commit -m "feat(api): add WishlistItem model for the event wishlist"
```

---

## Task 2: API — `wishlist` module

**Files:**
- Create: `api/src/wishlist/dto/create-wishlist-item.dto.ts`
- Create: `api/src/wishlist/wishlist.service.ts`
- Create: `api/src/wishlist/wishlist.controller.ts`
- Create: `api/src/wishlist/wishlist.module.ts`
- Create: `api/src/wishlist/wishlist.service.spec.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `prisma.wishlistItem` (Task 1), `EventsService.findBySlug(slug)` (existing, exported by `EventsModule`), `BarAccessService.assertMember(barId, user): Promise<{ canSeeVip: boolean; isOwnerOrAdmin: boolean }>` (existing, exported by `BarsModule`).
- Produces: three HTTP routes consumed by Task 3's `api-client.ts`: `GET /events/:slug/wishlist` → `WishlistItem[]`, `POST /events/:slug/wishlist` (body `{ label: string }`) → `WishlistItem`, `DELETE /events/:slug/wishlist/:id` → `{ success: true }`.

- [ ] **Step 1: Write the DTO**

Create `api/src/wishlist/dto/create-wishlist-item.dto.ts`:

```typescript
import { IsString, MinLength } from 'class-validator';

export class CreateWishlistItemDto {
  @IsString()
  @MinLength(1)
  label: string;
}
```

- [ ] **Step 2: Write the service**

Create `api/src/wishlist/wishlist.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async findForEvent(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.wishlistItem.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(slug: string, label: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.wishlistItem.create({
      data: { eventId: event.id, label },
    });
  }

  async remove(slug: string, id: string) {
    const event = await this.eventsService.findBySlug(slug);
    const item = await this.prisma.wishlistItem.findUnique({ where: { id } });
    if (!item || item.eventId !== event.id) {
      throw new NotFoundException('Item introuvable');
    }
    await this.prisma.wishlistItem.delete({ where: { id } });
    return { success: true };
  }
}
```

- [ ] **Step 3: Write the controller**

Create `api/src/wishlist/wishlist.controller.ts`:

```typescript
import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { EventsService } from '../events/events.service';
import { WishlistService } from './wishlist.service';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';

@Controller('events/:slug/wishlist')
export class WishlistController {
  constructor(
    private readonly wishlistService: WishlistService,
    private readonly eventsService: EventsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@Param('slug') slug: string) {
    return this.wishlistService.findForEvent(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Param('slug') slug: string, @Body() dto: CreateWishlistItemDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(event.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException("Seul l'hôte de la soirée peut gérer la liste à ramener");
    }
    return this.wishlistService.create(slug, dto.label);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('slug') slug: string, @Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(event.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException("Seul l'hôte de la soirée peut gérer la liste à ramener");
    }
    return this.wishlistService.remove(slug, id);
  }
}
```

- [ ] **Step 4: Write the module**

Create `api/src/wishlist/wishlist.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { BarsModule } from '../bars/bars.module';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';

@Module({
  imports: [EventsModule, BarsModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
```

- [ ] **Step 5: Register the module in `AppModule`**

In `api/src/app.module.ts`, add the import alongside the existing feature modules:

```typescript
import { WishlistModule } from './wishlist/wishlist.module';
```

And add `WishlistModule` to the `imports` array in the `@Module({...})` decorator, next to `ContributionsModule`.

- [ ] **Step 6: Write the failing tests**

Create `api/src/wishlist/wishlist.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

describe('WishlistService', () => {
  let service: WishlistService;
  let prisma: { wishlistItem: Record<string, jest.Mock> };
  let eventsService: { findBySlug: jest.Mock };

  beforeEach(async () => {
    prisma = {
      wishlistItem: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    eventsService = { findBySlug: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();
    service = moduleRef.get(WishlistService);
  });

  it('resolves the slug to an eventId before listing items', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });

    await service.findForEvent('apero-du-samedi-a1b2c3d4');

    expect(eventsService.findBySlug).toHaveBeenCalledWith('apero-du-samedi-a1b2c3d4');
    expect(prisma.wishlistItem.findMany).toHaveBeenCalledWith({
      where: { eventId: 'event-1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('resolves the slug to an eventId before creating an item', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.create.mockResolvedValue({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });

    const result = await service.create('apero-du-samedi-a1b2c3d4', 'Glaçons');

    expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
      data: { eventId: 'event-1', label: 'Glaçons' },
    });
    expect(result).toEqual({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });
  });

  it('deletes an item that belongs to the resolved event', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });

    const result = await service.remove('apero-du-samedi-a1b2c3d4', 'item-1');

    expect(prisma.wishlistItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    expect(result).toEqual({ success: true });
  });

  it('rejects deleting an item that belongs to a different event', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'item-1', eventId: 'event-2', label: 'Glaçons' });

    await expect(service.remove('apero-du-samedi-a1b2c3d4', 'item-1')).rejects.toThrow(NotFoundException);
    expect(prisma.wishlistItem.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting an item that does not exist', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue(null);

    await expect(service.remove('apero-du-samedi-a1b2c3d4', 'missing')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 7: Run the tests**

Run (from the `api/` directory): `cd api && npx jest wishlist.service.spec.ts`
Expected: 5 tests pass.

- [ ] **Step 8: Typecheck the whole api project**

Run: `cd api && npx tsc --noEmit`
Expected: no errors (confirms `AppModule`'s new import and the controller/service wiring compile cleanly, including the regenerated `prisma.wishlistItem` client type from Task 1).

- [ ] **Step 9: Commit**

```bash
git add api/src/wishlist api/src/app.module.ts
git commit -m "feat(api): add wishlist module (GET/POST/DELETE events/:slug/wishlist)"
```

---

## Task 3: Frontend data layer (types, api-client, actions)

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api-client.ts`
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: the three routes from Task 2 (`GET`/`POST`/`DELETE /events/:slug/wishlist`).
- Produces: `WishlistItem` type, `listWishlistItems(slug): Promise<WishlistItem[]>`, `addWishlistItem(slug, label): Promise<WishlistItem>`, `deleteWishlistItem(slug, id): Promise<{ success: boolean }>` in `api-client.ts`; `addWishlistItemAction(slug, formData)` and `deleteWishlistItemAction(slug, id)` server actions in `actions.ts`. Task 4's `WishlistSection.tsx` consumes the two actions directly (as form actions / click handlers) and receives `WishlistItem[]` as a prop from `page.tsx`.

- [ ] **Step 1: Add the `WishlistItem` type**

In `src/lib/types.ts`, add this interface right after the `Contribution` interface (after its closing `}`, before `export interface StockAdjustment`):

```typescript
export interface WishlistItem {
  id: string;
  eventId: string;
  label: string;
  createdAt: string;
}
```

- [ ] **Step 2: Add the api-client functions**

In `src/lib/api-client.ts`, add these three functions right after the existing `deleteContribution` function (after its closing `}`, before the `// Stock Adjustments` comment):

```typescript
export function listWishlistItems(slug: string): Promise<WishlistItem[]> {
  return request<WishlistItem[]>(`/events/${slug}/wishlist`);
}

export function addWishlistItem(slug: string, label: string): Promise<WishlistItem> {
  return request<WishlistItem>(`/events/${slug}/wishlist`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export function deleteWishlistItem(slug: string, id: string): Promise<{ success: boolean }> {
  return request(`/events/${slug}/wishlist/${id}`, { method: "DELETE" });
}
```

Add `WishlistItem` to the `import type { ... } from "./types";` block at the top of the file (alongside the existing `MyProfile` import).

- [ ] **Step 3: Add the server actions**

In `src/app/actions.ts`, add these two functions right after `deleteContributionAction` (after its closing `}`, before `export async function submitBilan`):

```typescript
export async function addWishlistItemAction(slug: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  await api.addWishlistItem(slug, label);
  revalidatePath(`/soirees/${slug}`);
}

export async function deleteWishlistItemAction(slug: string, id: string) {
  await api.deleteWishlistItem(slug, id);
  revalidatePath(`/soirees/${slug}`);
}
```

- [ ] **Step 4: Typecheck**

Run (from the repo root): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/api-client.ts src/app/actions.ts
git commit -m "feat(web): add types, api-client functions, and server actions for the event wishlist"
```

---

## Task 4: Frontend UI — `WishlistSection` and page wiring

**Files:**
- Create: `src/app/soirees/[slug]/WishlistSection.tsx`
- Modify: `src/app/soirees/[slug]/page.tsx`

**Interfaces:**
- Consumes: `WishlistItem` type, `addWishlistItemAction`/`deleteWishlistItemAction` (Task 3), `listWishlistItems` (Task 3), and `activeBar.myRole` / `session.role` (both already available in `page.tsx` per the existing code shown below).

- [ ] **Step 1: Write the component**

Create `src/app/soirees/[slug]/WishlistSection.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { addWishlistItemAction, deleteWishlistItemAction } from "@/app/actions";
import type { WishlistItem } from "@/lib/types";

export default function WishlistSection({
  slug,
  items,
  canManage,
}: {
  slug: string;
  items: WishlistItem[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-ink-2/80 p-5 sm:p-6 space-y-4 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange animate-pulse" />
          <h2 className="font-display text-xl font-bold text-cream">À ramener</h2>
        </div>
        <span className="text-xs font-mono font-bold text-orange bg-orange/15 px-3 py-1 rounded-full border border-orange/30">
          {items.length} Item{items.length > 1 ? "s" : ""}
        </span>
      </div>

      {canManage && (
        <form
          action={async (formData: FormData) => {
            await addWishlistItemAction(slug, formData);
          }}
          className="flex gap-2"
        >
          <input
            name="label"
            required
            placeholder="Ex: 2 sacs de glaçons"
            className="flex-1 bg-ink border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs placeholder:text-muted/60 focus:outline-none focus:border-orange text-cream font-medium"
          />
          <button
            type="submit"
            className="tap-target flex items-center justify-center bg-orange text-ink font-extrabold rounded-xl px-4 py-2.5 text-xs hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider cursor-pointer"
          >
            Ajouter
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-center py-8 rounded-xl bg-ink/40 border border-white/[0.05]">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-muted text-xs italic">
            {canManage ? "Ajoute des choses à ramener pour tes invités." : "L'hôte n'a rien demandé pour l'instant."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((wishlistItem) => (
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
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire it into `page.tsx`**

In `src/app/soirees/[slug]/page.tsx`:

Add `listWishlistItems` to the `@/lib/api-client` import (alongside `getEvent`, `listContributions`, etc.).

Add `WishlistSection` import: `import WishlistSection from "./WishlistSection";`

In the `Promise.all` that currently fetches `[bottles, adjustments, availability, contributions]`, add `listWishlistItems(slug)` as a fifth entry, and add `wishlistItems` to the destructured result:

```typescript
const [bottles, adjustments, availability, contributions, wishlistItems] = await Promise.all([
  listBottles(activeBar.id),
  listStockAdjustments(slug),
  evaluateCocktails(activeBar.id),
  listContributions(slug),
  listWishlistItems(slug),
]);
```

Right after `const vipCocktails = ...` (before the `netAdjustments` computation, order doesn't matter functionally but keep it there for readability), add:

```typescript
const canManageWishlist = activeBar.myRole === "OWNER" || session.role === "ADMIN";
```

Render `<WishlistSection />` right after the `<GuestPanel ... />` call, still inside the outer `<div className="space-y-8">`:

```tsx
<GuestPanel
  slug={slug}
  session={session}
  contributions={contributions}
  stock={stock}
  vipStock={vipStock}
  readyCocktails={readyCocktails}
  vipCocktails={vipCocktails}
/>

<WishlistSection slug={slug} items={wishlistItems} canManage={canManageWishlist} />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/soirees/[slug]/WishlistSection.tsx src/app/soirees/[slug]/page.tsx`
Expected: no new errors (pre-existing unrelated warnings elsewhere in the repo are not this task's concern — if this command reports 0 problems for these two files, the task is clean).

- [ ] **Step 4: Commit**

```bash
git add "src/app/soirees/[slug]/WishlistSection.tsx" "src/app/soirees/[slug]/page.tsx"
git commit -m "feat(web): show the host-managed wishlist on the soirée page"
```
