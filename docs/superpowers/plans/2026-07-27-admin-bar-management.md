# Admin Bar Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an ADMIN account see every bar on the platform, manage any of them (rename, visibility, members, invite link) even without being a member, and view/edit their full content (cave, cocktails, soirées) from a dedicated admin section.

**Architecture:** A shared `isAdmin(userId)` helper in `BarsService` unlocks the existing owner-only checks for admin (no new routes needed for that part), two new read routes (`GET /bars/all`, `GET /bars/:id`) power a new admin-only page tree (`/admin/bars`, `/admin/bars/[id]`, `/admin/bars/[id]/stock|cocktails|soirees`) that reuses every existing bar-management and content component unchanged, just fed a `barId` from the URL instead of the cookie-resolved active bar.

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL (API), Next.js 16 App Router (frontend), Jest (API unit tests only).

## Global Constraints

- Follow the existing module pattern exactly (`api/src/bars/`) — controller thin, no business logic there.
- No new npm dependencies.
- French user-facing strings, matching the rest of the codebase.
- `next.config.ts` has `basePath: "/bar"` — no literal `/bar` prefix in any `redirect()`/`<Link href>`.
- The frontend has no test framework — verify with `npx tsc --noEmit -p .` and manual checks.
- Every new admin page must reuse existing components/actions rather than duplicating their logic — `BarNameSection`, `BarVisibilitySection`, `InviteLinkSection`, `InviteMemberForm`, `MemberRow`, `PendingRequests`, `StockStudio`, `CocktailStudio`, `AddBottleForm`, `AlertsManagerTrigger`, `CopyLink`, `DeleteEventButton` are all imported as-is, not copied.
- `requireBarOwnerOrAdmin`/`requireBarVipOrAdmin`/`requireVipOrAdmin` in `src/app/actions.ts` already bypass for `session.role === "ADMIN"` — the content-mutation actions (`createBottle`, `updateBottle*`, `deleteBottleAction`, `createRecipe`, `updateRecipe`, `deleteRecipeAction`, `createEvent`, `deleteEventAction`) already work for an admin acting on any bar. **Do not modify `src/app/actions.ts` or `src/app/bar-actions.ts` in this plan** — the only gap is the owner-only checks inside `BarsService` (Task 1), and the missing frontend routes to reach an arbitrary bar (Tasks 5-9).
- Out of scope: deleting a bar, transferring ownership, pagination of the admin bar list (matches `findDirectory`'s existing precedent).

---

### Task 1: `BarsService` — admin bypass for owner/member checks

**Files:**
- Modify: `api/src/bars/bars.service.ts`
- Test: `api/src/bars/bars.service.spec.ts`

**Interfaces:**
- Produces: private `BarsService.isAdmin(userId: string): Promise<boolean>`. No public signature changes — `assertOwner`, `findMembers`, `removeMember` behave identically for real owners/members, and additionally succeed for any ADMIN account regardless of membership.

- [ ] **Step 1: Add the `prisma.user` mock and write the failing tests**

In `api/src/bars/bars.service.spec.ts`, add `user: { findUnique: jest.fn() }` to the `prisma` mock object in `beforeEach`:

Replace:

```ts
      barJoinRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
```

with:

```ts
      barJoinRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
```

Add a new test to the existing `describe('rename', ...)` block (this exercises the shared `assertOwner` bypass — no need to duplicate this test across every other method that calls `assertOwner`, since they all delegate to the exact same private helper):

Replace:

```ts
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
```

with:

```ts
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

    it('allows an admin without a real membership to rename the bar', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.bar.update.mockResolvedValue({ id: BAR_ID, name: 'Nouveau Nom' });

      const result = await service.rename(BAR_ID, 'admin-1', 'Nouveau Nom');

      expect(prisma.barMembership.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual({ id: BAR_ID, name: 'Nouveau Nom' });
    });
  });
```

Add a new test to the existing `describe('findMembers', ...)` block:

Replace:

```ts
    it('returns the roster for a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      prisma.barMembership.findMany.mockResolvedValue([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);

      const result = await service.findMembers(BAR_ID, OWNER_ID);

      expect(result).toEqual([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);
    });
  });
```

with:

```ts
    it('returns the roster for a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({
        id: 'm1',
        role: 'OWNER',
      });
      prisma.barMembership.findMany.mockResolvedValue([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);

      const result = await service.findMembers(BAR_ID, OWNER_ID);

      expect(result).toEqual([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);
    });

    it('allows an admin without a real membership to view the roster', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.barMembership.findMany.mockResolvedValue([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);

      const result = await service.findMembers(BAR_ID, 'admin-1');

      expect(result).toEqual([
        { id: 'm1', role: 'OWNER', user: { username: 'noa' } },
      ]);
    });
  });
```

Add a new test to the existing `describe('removeMember', ...)` block:

Replace:

```ts
    it('forbids a non-owner from removing someone else', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({
          id: 'm3',
          barId: BAR_ID,
          role: 'MEMBER',
          userId: 'third-user',
        })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER', userId: OTHER_ID });

      await expect(
        service.removeMember(BAR_ID, OTHER_ID, 'm3'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.barMembership.delete).not.toHaveBeenCalled();
    });
  });
```

with:

```ts
    it('forbids a non-owner from removing someone else', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({
          id: 'm3',
          barId: BAR_ID,
          role: 'MEMBER',
          userId: 'third-user',
        })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER', userId: OTHER_ID });

      await expect(
        service.removeMember(BAR_ID, OTHER_ID, 'm3'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.barMembership.delete).not.toHaveBeenCalled();
    });

    it('allows an admin without a real membership to remove a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({
          id: 'm2',
          barId: BAR_ID,
          role: 'MEMBER',
          userId: OTHER_ID,
        })
        .mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.barMembership.delete.mockResolvedValue({ id: 'm2' });

      const result = await service.removeMember(BAR_ID, 'admin-1', 'm2');

      expect(result).toEqual({ success: true });
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: the 3 new tests FAIL (the admin bypass doesn't exist yet — they'll hit the real `ForbiddenException` paths instead of succeeding).

- [ ] **Step 3: Implement the bypass**

In `api/src/bars/bars.service.ts`, add the new private helper right after `getMembership` and before `assertOwner`:

```ts
  private async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'ADMIN';
  }
```

Replace `assertOwner`:

```ts
  private async assertOwner(barId: string, userId: string) {
    await this.getBar(barId);
    const membership = await this.getMembership(barId, userId);
    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException(
        'Seul le propriétaire du bar peut effectuer cette action',
      );
    }
  }
```

with:

```ts
  private async assertOwner(barId: string, userId: string) {
    await this.getBar(barId);
    if (await this.isAdmin(userId)) return;
    const membership = await this.getMembership(barId, userId);
    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException(
        'Seul le propriétaire du bar peut effectuer cette action',
      );
    }
  }
```

Replace `findMembers`:

```ts
  async findMembers(barId: string, userId: string) {
    await this.getBar(barId);
    const membership = await this.getMembership(barId, userId);
    if (!membership) {
      throw new ForbiddenException("Vous n'avez pas accès à ce bar");
    }

    return this.prisma.barMembership.findMany({
      where: { barId },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }
```

with:

```ts
  async findMembers(barId: string, userId: string) {
    await this.getBar(barId);
    const membership = await this.getMembership(barId, userId);
    if (!membership && !(await this.isAdmin(userId))) {
      throw new ForbiddenException("Vous n'avez pas accès à ce bar");
    }

    return this.prisma.barMembership.findMany({
      where: { barId },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }
```

Replace the `isOwner` line in `removeMember`:

```ts
    const requesterMembership = await this.getMembership(barId, requesterId);
    const isOwner = requesterMembership?.role === 'OWNER';
    const isSelf = membership.userId === requesterId;
```

with:

```ts
    const requesterMembership = await this.getMembership(barId, requesterId);
    const isOwner = requesterMembership?.role === 'OWNER' || (await this.isAdmin(requesterId));
    const isSelf = membership.userId === requesterId;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: PASS, all tests (existing + 3 new) green. Every existing test that exercises `assertOwner`/`findMembers`/`removeMember` for a real owner/member/non-member still passes unmodified — `prisma.user.findUnique` defaults to resolving `undefined` when not explicitly mocked, so `isAdmin()` safely evaluates to `false` for all of them, preserving current behavior exactly.

- [ ] **Step 5: Run the full test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add api/src/bars/bars.service.ts api/src/bars/bars.service.spec.ts
git commit -m "feat(api): let an admin manage any bar without being a member"
```

---

### Task 2: `BarsService` — `findAll` and `findOne`

**Files:**
- Modify: `api/src/bars/bars.service.ts`
- Test: `api/src/bars/bars.service.spec.ts`

**Interfaces:**
- Produces: `BarsService.findAll(): Promise<Array<{ id, name, ownerUsername, memberCount, isPublic, createdAt }>>`, `BarsService.findOne(barId: string): Promise<{ id, name, isPublic, inviteToken, memberCount, ownerUsername }>` (throws `NotFoundException` for an unknown bar).

- [ ] **Step 1: Write the failing tests**

Add `count: jest.fn()` to the `barMembership` mock object in `beforeEach`:

Replace:

```ts
      barMembership: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
```

with:

```ts
      barMembership: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
```

Add two new describe blocks at the end of the file, right before the final closing `});` of the outer `describe('BarsService', ...)`:

```ts
  describe('findAll', () => {
    it('returns every bar, public and private, with owner and member count', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: 'bar-a',
          name: 'Bar Public',
          isPublic: true,
          createdAt: new Date('2026-01-01'),
          memberships: [{ role: 'OWNER', user: { username: 'owner1' } }],
          _count: { memberships: 1 },
        },
        {
          id: 'bar-b',
          name: 'Bar Privé',
          isPublic: false,
          createdAt: new Date('2026-01-02'),
          memberships: [{ role: 'OWNER', user: { username: 'owner2' } }],
          _count: { memberships: 3 },
        },
      ]);

      const result = await service.findAll();

      expect(prisma.bar.findMany).toHaveBeenCalledWith({
        include: {
          memberships: { select: { role: true, user: { select: { username: true } } } },
          _count: { select: { memberships: true } },
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        { id: 'bar-a', name: 'Bar Public', ownerUsername: 'owner1', memberCount: 1, isPublic: true, createdAt: new Date('2026-01-01') },
        { id: 'bar-b', name: 'Bar Privé', ownerUsername: 'owner2', memberCount: 3, isPublic: false, createdAt: new Date('2026-01-02') },
      ]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException if the bar does not exist', async () => {
      prisma.bar.findUnique.mockResolvedValue(null);

      await expect(service.findOne(BAR_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns bar details with member count and owner username', async () => {
      prisma.bar.findUnique.mockResolvedValue({
        id: BAR_ID,
        name: 'Chez Noa',
        isPublic: true,
        inviteToken: 'tok-1',
      });
      prisma.barMembership.count.mockResolvedValue(4);
      prisma.barMembership.findFirst.mockResolvedValue({
        user: { username: 'owner1' },
      });

      const result = await service.findOne(BAR_ID);

      expect(prisma.barMembership.count).toHaveBeenCalledWith({ where: { barId: BAR_ID } });
      expect(prisma.barMembership.findFirst).toHaveBeenCalledWith({
        where: { barId: BAR_ID, role: 'OWNER' },
        include: { user: { select: { username: true } } },
      });
      expect(result).toEqual({
        id: BAR_ID,
        name: 'Chez Noa',
        isPublic: true,
        inviteToken: 'tok-1',
        memberCount: 4,
        ownerUsername: 'owner1',
      });
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: FAIL — `service.findAll`/`service.findOne` are not functions.

- [ ] **Step 3: Implement `findAll` and `findOne`**

In `api/src/bars/bars.service.ts`, add both methods after `joinViaInviteLink` and before `findDirectory`:

```ts
  async findAll() {
    const bars = await this.prisma.bar.findMany({
      include: {
        memberships: {
          select: { role: true, user: { select: { username: true } } },
        },
        _count: { select: { memberships: true } },
      },
      orderBy: { name: 'asc' },
    });

    return bars.map((bar) => {
      const owner = bar.memberships.find((m) => m.role === 'OWNER');
      return {
        id: bar.id,
        name: bar.name,
        ownerUsername: owner?.user.username ?? '—',
        memberCount: bar._count.memberships,
        isPublic: bar.isPublic,
        createdAt: bar.createdAt,
      };
    });
  }

  async findOne(barId: string) {
    const bar = await this.getBar(barId);
    const [memberCount, ownerMembership] = await Promise.all([
      this.prisma.barMembership.count({ where: { barId } }),
      this.prisma.barMembership.findFirst({
        where: { barId, role: 'OWNER' },
        include: { user: { select: { username: true } } },
      }),
    ]);
    return {
      id: bar.id,
      name: bar.name,
      isPublic: bar.isPublic,
      inviteToken: bar.inviteToken,
      memberCount,
      ownerUsername: ownerMembership?.user.username ?? '—',
    };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add api/src/bars/bars.service.ts api/src/bars/bars.service.spec.ts
git commit -m "feat(api): add BarsService.findAll and findOne for admin"
```

---

### Task 3: `BarsController` — wire `GET /bars/all` and `GET /bars/:id`

**Files:**
- Modify: `api/src/bars/bars.controller.ts`

**Interfaces:**
- Consumes: `BarsService.findAll`, `BarsService.findOne` (Task 2).
- Produces: `GET /bars/all` (admin-only), `GET /bars/:id` (admin-only).

No dedicated controller test file (matches existing convention).

- [ ] **Step 1: Add the imports**

In `api/src/bars/bars.controller.ts`, replace:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
```

with:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { JwtPayload } from '../auth/auth.service';
```

- [ ] **Step 2: Add `GET /bars/all`, placed among the other 1-segment GET routes**

Replace:

```ts
  @UseGuards(JwtAuthGuard)
  @Get('search-users')
  searchUsers(@Query('q') q: string) {
    return this.barsService.searchUsers(q ?? '');
  }
```

with:

```ts
  @UseGuards(JwtAuthGuard)
  @Get('search-users')
  searchUsers(@Query('q') q: string) {
    return this.barsService.searchUsers(q ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('all')
  findAll() {
    return this.barsService.findAll();
  }
```

- [ ] **Step 3: Add `GET /bars/:id`, placed last among the routes without an `:id`/`:token` prefix, after `respondToJoinRequest`**

**This ordering matters**: `GET /bars/:id` is a 1-segment wildcard route that would shadow `GET /bars/mine`, `/bars/directory`, `/bars/search-users`, and `/bars/all` if declared before them — NestJS/Express match routes in declaration order, and all five are structurally identical (one segment after `/bars`). Since Step 2 already placed `findAll` after the other three, and this step places `findOne` after everything else in the file, the four literal 1-segment GETs are guaranteed to be declared first.

Replace the very last method in the class:

```ts
  @UseGuards(JwtAuthGuard)
  @Patch(':id/join-requests/:requestId')
  respondToJoinRequest(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: RespondJoinRequestDto,
  ) {
    const user = req.user as JwtPayload;
    return this.barsService.respondToJoinRequest(id, user.sub, requestId, dto.accept);
  }
}
```

with:

```ts
  @UseGuards(JwtAuthGuard)
  @Patch(':id/join-requests/:requestId')
  respondToJoinRequest(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: RespondJoinRequestDto,
  ) {
    const user = req.user as JwtPayload;
    return this.barsService.respondToJoinRequest(id, user.sub, requestId, dto.accept);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.barsService.findOne(id);
  }
}
```

- [ ] **Step 4: Run the full test suite**

Run: `cd api && npm test`
Expected: all suites pass (no regressions).

- [ ] **Step 5: Manual smoke test**

With the stack running and an admin session cookie:

```bash
curl -s http://localhost:3001/bars/all -b /tmp/admin-cookies.txt
curl -s http://localhost:3001/bars/mine -b /tmp/admin-cookies.txt
```

Expected: both return valid JSON (not each other's shape) — confirms `:id` doesn't shadow `mine`. Also confirm a non-admin session gets a 403 on `GET /bars/all`.

- [ ] **Step 6: Commit**

```bash
git add api/src/bars/bars.controller.ts
git commit -m "feat(api): wire up admin bar directory and detail routes"
```

---

### Task 4: Frontend — types & `api-client.ts` additions

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api-client.ts`

**Interfaces:**
- Produces: types `BarAdminSummary`, `BarAdminDetail`; functions `listAllBars(): Promise<BarAdminSummary[]>`, `getBarById(barId): Promise<BarAdminDetail>`.

- [ ] **Step 1: Add the two types**

Add to `src/lib/types.ts`, after the existing `InviteLinkPreview` interface:

```ts
export interface BarAdminSummary {
  id: string;
  name: string;
  ownerUsername: string;
  memberCount: number;
  isPublic: boolean;
  createdAt: string;
}

export interface BarAdminDetail {
  id: string;
  name: string;
  isPublic: boolean;
  inviteToken: string | null;
  memberCount: number;
  ownerUsername: string;
}
```

- [ ] **Step 2: Add the two functions to `api-client.ts`**

Merge the two new types into the existing type-only import:

Replace:

```ts
import type {
  Bottle,
  EventItem,
  Contribution,
  StockAdjustment,
  AccountUser,
  Bar,
  BarMember,
  BarDirectoryEntry,
  PendingJoinRequest,
  UserSearchResult,
  InviteLinkPreview,
} from "./types";
```

with:

```ts
import type {
  Bottle,
  EventItem,
  Contribution,
  StockAdjustment,
  AccountUser,
  Bar,
  BarMember,
  BarDirectoryEntry,
  PendingJoinRequest,
  UserSearchResult,
  InviteLinkPreview,
  BarAdminSummary,
  BarAdminDetail,
} from "./types";
```

Add at the end of the file:

```ts
export function listAllBars(): Promise<BarAdminSummary[]> {
  return request<BarAdminSummary[]>("/bars/all");
}

export function getBarById(barId: string): Promise<BarAdminDetail> {
  return request<BarAdminDetail>(`/bars/${barId}`);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/api-client.ts
git commit -m "feat(web): add types and api-client functions for admin bar management"
```

---

### Task 5: Frontend — `/admin/bars` list page + navigation link

**Files:**
- Create: `src/app/admin/bars/page.tsx`
- Modify: `src/components/Navigation.tsx`

**Interfaces:**
- Consumes: `listAllBars()` (Task 4).

- [ ] **Step 1: Create `/admin/bars/page.tsx`**

```tsx
// src/app/admin/bars/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { listAllBars } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";

export default async function AdminBarsPage() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const bars = await listAllBars();

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Espace Administrateur</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            Tous les bars
          </h1>
        </div>

        <div className="text-xs text-muted bg-ink-2 px-4 py-2 rounded-xl border border-white/[0.08]">
          Bars enregistrés : <span className="text-cream font-bold">{bars.length}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
        {bars.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">Aucun bar sur la plateforme.</div>
        ) : (
          bars.map((bar) => (
            <Link
              key={bar.id}
              href={`/admin/bars/${bar.id}`}
              className="p-4.5 flex items-center justify-between gap-4 hover:bg-ink-2 transition-colors"
            >
              <div>
                <p className="font-semibold text-sm text-cream">{bar.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  Par {bar.ownerUsername} · {bar.memberCount} membre{bar.memberCount > 1 ? "s" : ""}
                </p>
              </div>
              <span
                className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                  bar.isPublic
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/[0.05] text-muted border border-white/[0.08]"
                }`}
              >
                {bar.isPublic ? "Public" : "Privé"}
              </span>
            </Link>
          ))
        )}
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Add the nav link**

In `src/components/Navigation.tsx`, replace:

```tsx
const ADMIN_NAV = [{ href: "/comptes", label: "Comptes" }];
```

with:

```tsx
const ADMIN_NAV = [
  { href: "/comptes", label: "Comptes" },
  { href: "/admin/bars", label: "Tous les bars" },
];
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 4: Manual check**

As an admin, visit `/bar/admin/bars` — confirm every bar on the platform appears (including private ones you don't own), each with the correct public/private badge. As a non-admin, visiting the same URL should redirect to `/bar/login`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/bars/page.tsx src/components/Navigation.tsx
git commit -m "feat(web): add admin page listing every bar"
```

---

### Task 6: Frontend — `/admin/bars/[id]` management hub

**Files:**
- Create: `src/app/admin/bars/[id]/page.tsx`

**Interfaces:**
- Consumes: `getBarById`, `listBarMembers`, `listPendingJoinRequests` (existing), `BarNameSection`, `BarVisibilitySection`, `InviteLinkSection`, `InviteMemberForm`, `MemberRow`, `PendingRequests` (existing, imported from `src/app/membres/`).

- [ ] **Step 1: Create the page**

```tsx
// src/app/admin/bars/[id]/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBarById, listBarMembers, listPendingJoinRequests } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import BarNameSection from "@/app/membres/BarNameSection";
import BarVisibilitySection from "@/app/membres/BarVisibilitySection";
import InviteLinkSection from "@/app/membres/InviteLinkSection";
import InviteMemberForm from "@/app/membres/InviteMemberForm";
import MemberRow from "@/app/membres/MemberRow";
import PendingRequests from "@/app/membres/PendingRequests";

export default async function AdminBarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const { id } = await params;
  const [bar, members, pendingRequests] = await Promise.all([
    getBarById(id),
    listBarMembers(id),
    listPendingJoinRequests(id),
  ]);

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Espace Administrateur</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Gestion de {bar.name}
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/bars/${id}/stock`}
          className="text-xs px-3 py-2 rounded-xl bg-ink-2 border border-white/[0.08] text-cream hover:border-orange/50 transition-colors"
        >
          Voir la cave →
        </Link>
        <Link
          href={`/admin/bars/${id}/cocktails`}
          className="text-xs px-3 py-2 rounded-xl bg-ink-2 border border-white/[0.08] text-cream hover:border-orange/50 transition-colors"
        >
          Voir les cocktails →
        </Link>
        <Link
          href={`/admin/bars/${id}/soirees`}
          className="text-xs px-3 py-2 rounded-xl bg-ink-2 border border-white/[0.08] text-cream hover:border-orange/50 transition-colors"
        >
          Voir les soirées →
        </Link>
      </div>

      <PendingRequests barId={id} requests={pendingRequests} />

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <BarNameSection barId={id} name={bar.name} />
          <div className="rounded-2xl bg-ink-2 border border-white/[0.08] p-6 shadow-xl">
            <InviteMemberForm barId={id} />
          </div>
          <BarVisibilitySection barId={id} isPublic={bar.isPublic} />
          <InviteLinkSection barId={id} inviteToken={bar.inviteToken} />
        </div>

        <div className="lg:col-span-8 rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
          {members.map((member) => (
            <MemberRow key={member.id} barId={id} member={member} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Manual check**

As an admin, from `/bar/admin/bars`, click into a bar you do NOT own or belong to. Confirm: the name field, visibility toggle, invite link, invite-by-search form, and member list all render and work exactly as they do on the real owner's `/membres` page — rename it, toggle its visibility, invite a member, remove a member, all without any 403.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/bars/\[id\]/page.tsx
git commit -m "feat(web): add admin bar management hub page"
```

---

### Task 7: Frontend — `/admin/bars/[id]/stock`

**Files:**
- Create: `src/app/admin/bars/[id]/stock/page.tsx`

**Interfaces:**
- Consumes: `getBarById`, `listBottles` (existing), `StockStudio`, `AddBottleForm`, `AlertsManagerTrigger` (existing, imported from `src/app/stock/`).

- [ ] **Step 1: Create the page**

```tsx
// src/app/admin/bars/[id]/stock/page.tsx
import { redirect } from "next/navigation";
import { getBarById, listBottles } from "@/lib/api-client";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import StockStudio from "@/app/stock/StockStudio";
import AddBottleForm from "@/app/stock/AddBottleForm";
import AlertsManagerTrigger from "@/app/stock/AlertsManagerTrigger";

export default async function AdminBarStockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const { id } = await params;
  const [bar, bottles] = await Promise.all([getBarById(id), listBottles(id)]);

  const normal = bottles.filter((b) => !b.vip);
  const vip = bottles.filter((b) => b.vip);
  const totalBottlesCount = bottles.reduce((sum, b) => sum + calculateTotalBottlesCount(b), 0);
  const totalLitersCount = bottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const lowStockCount = bottles.filter(
    (b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold
  ).length;

  const addBottleForm = <AddBottleForm isVip barId={id} />;

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Espace Administrateur</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            Cave de {bar.name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="px-4 py-2 rounded-xl bg-ink-2 border border-white/[0.08]">
            <span className="text-muted block text-[10px] uppercase font-semibold">En Rayon</span>
            <span className="text-cream font-bold text-sm">{totalBottlesCount} btl</span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-ink-2 border border-white/[0.08]">
            <span className="text-muted block text-[10px] uppercase font-semibold">Volume Total</span>
            <span className="text-orange font-bold text-sm">{formatLiters(totalLitersCount)}</span>
          </div>

          <AlertsManagerTrigger bottles={bottles} lowStockCount={lowStockCount} />
        </div>
      </div>

      <StockStudio
        normalBottles={normal}
        vipBottles={vip}
        addBottleForm={addBottleForm}
        isAdmin
        isVip
      />
    </PageTransition>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Manual check**

As an admin, from a bar's management hub, click "Voir la cave →". Confirm the full stock studio renders (including VIP bottles), and adding/editing/deleting a bottle works exactly as it does for the bar's real owner.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/bars/\[id\]/stock/page.tsx
git commit -m "feat(web): let an admin view and manage any bar's stock"
```

---

### Task 8: Frontend — `/admin/bars/[id]/cocktails`

**Files:**
- Create: `src/app/admin/bars/[id]/cocktails/page.tsx`

**Interfaces:**
- Consumes: `getBarById`, `evaluateCocktails`, `listBottles` (existing), `CocktailStudio` (existing, imported from `src/app/cocktails/`).

- [ ] **Step 1: Create the page**

```tsx
// src/app/admin/bars/[id]/cocktails/page.tsx
import { redirect } from "next/navigation";
import { getBarById, evaluateCocktails, listBottles } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import CocktailStudio from "@/app/cocktails/CocktailStudio";

export default async function AdminBarCocktailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const [bar, results, bottles] = await Promise.all([
    getBarById(id),
    evaluateCocktails(id),
    listBottles(id),
  ]);

  const allTags = Array.from(new Set(bottles.flatMap((b) => b.tags))).sort();

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Espace Administrateur</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Cocktails de {bar.name}
        </h1>
      </div>

      <CocktailStudio
        initialResults={results}
        isVip
        currentUserId={session.sub}
        isAdmin
        allTags={allTags}
        barId={id}
      />
    </PageTransition>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Manual check**

As an admin, from a bar's management hub, click "Voir les cocktails →". Confirm the full cocktail studio renders (including VIP recipes), and creating/editing/deleting a recipe works exactly as it does for the bar's real owner.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/bars/\[id\]/cocktails/page.tsx
git commit -m "feat(web): let an admin view and manage any bar's cocktails"
```

---

### Task 9: Frontend — `/admin/bars/[id]/soirees`

**Files:**
- Create: `src/app/admin/bars/[id]/soirees/page.tsx`

**Interfaces:**
- Consumes: `getBarById`, `listEvents` (existing), `createEvent` (existing, from `src/app/actions.ts` — already bypasses for admin via `requireBarOwnerOrAdmin`), `CopyLink`, `DeleteEventButton` (existing, imported from `src/app/soirees/`).

- [ ] **Step 1: Create the page**

```tsx
// src/app/admin/bars/[id]/soirees/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBarById, listEvents } from "@/lib/api-client";
import { createEvent } from "@/app/actions";
import { getSession } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import CopyLink from "@/app/soirees/CopyLink";
import DeleteEventButton from "@/app/soirees/DeleteEventButton";

export default async function AdminBarSoireesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const [bar, events] = await Promise.all([getBarById(id), listEvents(id)]);
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Espace Administrateur</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Soirées de {bar.name}
        </h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl box-orange-glow md:col-span-1 space-y-4">
          <div>
            <h2 className="font-display text-xl text-cream">Créer un Événement</h2>
            <p className="text-muted text-[11px] mt-0.5">Configurez une nouvelle date.</p>
          </div>
          <form action={createEvent.bind(null, id)} className="space-y-3.5">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Nom de la soirée</label>
              <input
                name="name"
                placeholder="Ex: Soirée Mojitos"
                required
                className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Date</label>
              <input
                name="date"
                type="date"
                required
                className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-orange text-white font-medium rounded-xl py-2.5 hover:bg-orange-hover box-orange-glow transition-all text-xs uppercase tracking-wider font-semibold"
            >
              Créer la soirée
            </button>
          </form>
        </section>

        <section className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-3 border-b border-orange/10 pb-2">
            <span className="w-1.5 h-3 bg-orange rounded-full" />
            <h2 className="font-display text-xl text-cream">Historique & Événements à venir</h2>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-orange/10 bg-ink-2/20">
              <span className="text-3xl block mb-2">📅</span>
              <p className="text-muted text-sm">Aucune soirée de planifiée pour le moment.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sorted.map((event) => (
                <div
                  key={event.slug}
                  className="rounded-xl border border-orange/10 bg-ink-2/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-orange/20 transition-all box-orange-glow-hover"
                >
                  <div>
                    <Link href={`/soirees/${event.slug}`} className="font-display text-lg text-cream hover:text-orange transition-colors">
                      {event.name}
                    </Link>
                    <p className="text-xs text-muted mt-1 flex flex-wrap gap-2 items-center">
                      <span className="text-orange-dim capitalize font-mono text-[10px]">
                        {new Date(event.date).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 border-orange/5 pt-2 sm:pt-0 shrink-0">
                    <CopyLink path={`/soirees/${event.slug}`} />
                    <DeleteEventButton slug={event.slug} name={event.name} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Manual check**

As an admin, from a bar's management hub, click "Voir les soirées →". Confirm existing soirées list, creating a new one redirects to its own `/soirees/[slug]` detail page (accessible to the admin regardless of bar membership, via the existing content-access bypass), and deleting one works.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/bars/\[id\]/soirees/page.tsx
git commit -m "feat(web): let an admin view and manage any bar's soirées"
```

---

### Task 10: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full API test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 2: Type-check the whole frontend**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Full manual walkthrough**

Using an admin account and a bar owned by someone else (`owner1`), where the admin is NOT a member:

1. Visit `/bar/admin/bars` — confirm every bar appears, including `owner1`'s private bar.
2. Click into `owner1`'s bar — confirm the hub page loads without any 403, showing real data (members, current name, visibility, invite link state).
3. Rename the bar — confirm it persists (revisit the page, name updated) and that `owner1`'s own `/membres` page (as `owner1`) also reflects the new name.
4. Toggle visibility, generate an invite link, invite a new member by search, remove a member — confirm each succeeds.
5. Visit the cave, cocktails, and soirées sub-pages — confirm full content loads (including VIP items) and that adding a bottle / creating a recipe / creating a soirée all succeed.
6. As a non-admin account, confirm `/bar/admin/bars` and `/bar/admin/bars/<id>` both redirect to `/bar/login` (or otherwise deny access) — the section must not be reachable by a regular owner or member.
7. Confirm `GET /bars/all` and `GET /bars/:id` both return 403 for a non-admin session via a direct API call.

- [ ] **Step 4: Clean up test data**

Remove any test bottles/recipes/soirées/renames created for this walkthrough on `owner1`'s bar (or leave them if the user prefers — ask before deleting anything, and restore the bar's original name if you changed it).

- [ ] **Step 5: Commit (only if the walkthrough surfaced fixes)**

No-op if the walkthrough passed clean — the feature is already fully committed task-by-task.
