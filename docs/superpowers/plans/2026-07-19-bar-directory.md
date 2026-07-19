# Bar Directory & Join Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public (any-logged-in-account) directory of all bars, a join-request flow (request → owner accepts/declines) as an alternative to direct invitation, and a new home page that replaces the current one — showing your active bar's stats, the next soirée across all your bars, and the directory.

**Architecture:** One new Prisma model (`BarJoinRequest`), four new methods on the existing `BarsService`/`BarsController` (`api/src/bars/`), and on the frontend a rewritten `src/app/page.tsx` plus a new `BarDirectory` client component, and a new `PendingRequests` section on `/membres`.

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL (API), Next.js 16 App Router + Server Actions (frontend), Jest (API unit tests only).

## Global Constraints

- Follow the existing module pattern exactly (`api/src/bars/`) — controller thin, DTO the only validation layer where a DTO exists.
- No new npm dependencies.
- French user-facing strings and exception messages, matching the rest of the codebase.
- `next.config.ts` has `basePath: "/bar"` — any `redirect()`/`<Link href>` written must be a logical path with no `/bar` prefix.
- The frontend has no test framework — verify with `npx tsc --noEmit -p .` and manual checks.
- All bar-directory/join-request routes sit behind `JwtAuthGuard` only (any logged-in account) except listing/responding to pending requests, which is owner-only via the existing `assertOwner` pattern.
- `Contribution` stays completely out of scope, as established in the prior phase — this plan doesn't touch anything under `api/src/contributions/`.

---

### Task 1: Prisma schema — `BarJoinRequest` model + migration

**Files:**
- Modify: `api/prisma/schema.prisma`

**Interfaces:**
- Produces: `BarJoinRequest { id, barId, userId, status: JoinRequestStatus, createdAt, updatedAt }`, enum `JoinRequestStatus { PENDING, ACCEPTED, DECLINED }`, `@@unique([barId, userId])`. `Bar` gains `joinRequests BarJoinRequest[]`, `User` gains `barJoinRequests BarJoinRequest[]`.

- [ ] **Step 1: Add the enum and model to the schema**

In `api/prisma/schema.prisma`, add after the existing `BarRole` enum:

```prisma
enum JoinRequestStatus {
  PENDING
  ACCEPTED
  DECLINED
}
```

Add at the end of the file:

```prisma
model BarJoinRequest {
  id        String            @id @default(cuid())
  barId     String
  bar       Bar               @relation(fields: [barId], references: [id], onDelete: Cascade)
  userId    String
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  status    JoinRequestStatus @default(PENDING)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@unique([barId, userId])
}
```

Add `joinRequests BarJoinRequest[]` to the `Bar` model (alongside `memberships`/`bottles`/`events`/`recipes`), and add `barJoinRequests BarJoinRequest[]` to the `User` model (alongside `barMemberships`).

- [ ] **Step 2: Validate and migrate**

Run: `cd api && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

Run: `cd api && npx prisma migrate dev --name add_bar_join_request`
Expected: `Your database is now in sync with your schema.` — this is a brand-new table, no backfill needed (unlike the phase-2 `barId` migration).

- [ ] **Step 3: Run the full test suite**

Run: `cd api && npm test`
Expected: all existing suites still pass (this change is additive to the schema only).

- [ ] **Step 4: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add BarJoinRequest model"
```

---

### Task 2: `BarsService` — directory and join-request methods

**Files:**
- Modify: `api/src/bars/bars.service.ts`
- Test: `api/src/bars/bars.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (existing), the existing private `getBar`/`getMembership`/`assertOwner` helpers.
- Produces (used by Task 3's controller):
  - `BarsService.findDirectory(userId: string): Promise<Array<{ id, name, ownerUsername, memberCount, myStatus: 'OWNER'|'MEMBER'|'PENDING'|'NONE' }>>`
  - `BarsService.createJoinRequest(barId: string, userId: string): Promise<BarJoinRequest>`
  - `BarsService.findPendingRequests(barId: string, requesterId: string): Promise<Array<BarJoinRequest & { user: { username: string } }>>`
  - `BarsService.respondToJoinRequest(barId: string, requesterId: string, requestId: string, accept: boolean): Promise<BarJoinRequest>`

- [ ] **Step 1: Write the failing tests**

Add to `api/src/bars/bars.service.spec.ts`: first update the `prisma` mock object in `beforeEach` to add a `barJoinRequest` model and a `findMany` mock on `bar`:

Replace:

```ts
    prisma = {
      bar: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      barMembership: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
```

with:

```ts
    prisma = {
      bar: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      barMembership: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      barJoinRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
```

Then add these four `describe` blocks at the end of the file, right before the final closing `});` of the outer `describe('BarsService', ...)`:

```ts
  describe('findDirectory', () => {
    it('flags OWNER/MEMBER/PENDING/NONE correctly per bar', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: 'bar-owned',
          name: 'Mon Bar',
          memberships: [{ userId: OWNER_ID, role: 'OWNER', user: { username: 'owner1' } }],
          _count: { memberships: 1 },
        },
        {
          id: 'bar-member',
          name: 'Bar Ami',
          memberships: [
            { userId: 'friend-1', role: 'OWNER', user: { username: 'friend1' } },
            { userId: OWNER_ID, role: 'MEMBER', user: { username: 'owner1' } },
          ],
          _count: { memberships: 2 },
        },
        {
          id: 'bar-pending',
          name: 'Bar Inconnu',
          memberships: [{ userId: 'stranger-1', role: 'OWNER', user: { username: 'stranger1' } }],
          _count: { memberships: 1 },
        },
        {
          id: 'bar-none',
          name: 'Bar Lointain',
          memberships: [{ userId: 'stranger-2', role: 'OWNER', user: { username: 'stranger2' } }],
          _count: { memberships: 1 },
        },
      ]);
      prisma.barJoinRequest.findMany.mockResolvedValue([{ barId: 'bar-pending' }]);

      const result = await service.findDirectory(OWNER_ID);

      expect(prisma.barJoinRequest.findMany).toHaveBeenCalledWith({
        where: { userId: OWNER_ID, status: 'PENDING' },
        select: { barId: true },
      });
      expect(result).toEqual([
        { id: 'bar-owned', name: 'Mon Bar', ownerUsername: 'owner1', memberCount: 1, myStatus: 'OWNER' },
        { id: 'bar-member', name: 'Bar Ami', ownerUsername: 'friend1', memberCount: 2, myStatus: 'MEMBER' },
        { id: 'bar-pending', name: 'Bar Inconnu', ownerUsername: 'stranger1', memberCount: 1, myStatus: 'PENDING' },
        { id: 'bar-none', name: 'Bar Lointain', ownerUsername: 'stranger2', memberCount: 1, myStatus: 'NONE' },
      ]);
    });
  });

  describe('createJoinRequest', () => {
    it('rejects if the caller is already a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.createJoinRequest(BAR_ID, OTHER_ID)).rejects.toThrow(ConflictException);
      expect(prisma.barJoinRequest.create).not.toHaveBeenCalled();
    });

    it('rejects if a PENDING request already exists', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.barJoinRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

      await expect(service.createJoinRequest(BAR_ID, OTHER_ID)).rejects.toThrow(ConflictException);
      expect(prisma.barJoinRequest.create).not.toHaveBeenCalled();
    });

    it('reactivates a DECLINED request instead of creating a new row', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.barJoinRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'DECLINED' });
      prisma.barJoinRequest.update.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

      const result = await service.createJoinRequest(BAR_ID, OTHER_ID);

      expect(prisma.barJoinRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'PENDING' },
      });
      expect(prisma.barJoinRequest.create).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'req-1', status: 'PENDING' });
    });

    it('creates a new PENDING request when none exists', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.barJoinRequest.findUnique.mockResolvedValue(null);
      prisma.barJoinRequest.create.mockResolvedValue({ id: 'req-2', status: 'PENDING' });

      const result = await service.createJoinRequest(BAR_ID, OTHER_ID);

      expect(prisma.barJoinRequest.create).toHaveBeenCalledWith({
        data: { barId: BAR_ID, userId: OTHER_ID, status: 'PENDING' },
      });
      expect(result).toEqual({ id: 'req-2', status: 'PENDING' });
    });
  });

  describe('findPendingRequests', () => {
    it('forbids a non-owner from listing requests', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.findPendingRequests(BAR_ID, OTHER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('returns PENDING requests for the owner', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      prisma.barJoinRequest.findMany.mockResolvedValue([
        { id: 'req-1', status: 'PENDING', user: { username: 'bob' } },
      ]);

      const result = await service.findPendingRequests(BAR_ID, OWNER_ID);

      expect(prisma.barJoinRequest.findMany).toHaveBeenCalledWith({
        where: { barId: BAR_ID, status: 'PENDING' },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([{ id: 'req-1', status: 'PENDING', user: { username: 'bob' } }]);
    });
  });

  describe('respondToJoinRequest', () => {
    it('forbids a non-owner from responding', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(
        service.respondToJoinRequest(BAR_ID, OTHER_ID, 'req-1', true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for an unknown request', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      prisma.barJoinRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.respondToJoinRequest(BAR_ID, OWNER_ID, 'missing', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a request that is no longer PENDING', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      prisma.barJoinRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        barId: BAR_ID,
        userId: OTHER_ID,
        status: 'ACCEPTED',
      });

      await expect(
        service.respondToJoinRequest(BAR_ID, OWNER_ID, 'req-1', true),
      ).rejects.toThrow(ConflictException);
    });

    it('accepting creates a membership and marks the request ACCEPTED', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      prisma.barJoinRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        barId: BAR_ID,
        userId: OTHER_ID,
        status: 'PENDING',
      });
      prisma.$transaction.mockResolvedValue([
        { id: 'm2' },
        { id: 'req-1', status: 'ACCEPTED' },
      ]);

      const result = await service.respondToJoinRequest(BAR_ID, OWNER_ID, 'req-1', true);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ id: 'req-1', status: 'ACCEPTED' });
    });

    it('declining marks the request DECLINED without creating a membership', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      prisma.barJoinRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        barId: BAR_ID,
        userId: OTHER_ID,
        status: 'PENDING',
      });
      prisma.barJoinRequest.update.mockResolvedValue({ id: 'req-1', status: 'DECLINED' });

      const result = await service.respondToJoinRequest(BAR_ID, OWNER_ID, 'req-1', false);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.barJoinRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'DECLINED' },
      });
      expect(result).toEqual({ id: 'req-1', status: 'DECLINED' });
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: FAIL — `service.findDirectory is not a function` (and similarly for the other three new methods).

- [ ] **Step 3: Implement the four new methods**

In `api/src/bars/bars.service.ts`, add these four public methods (place them after `removeMember` and before the private `getBar`/`getMembership`/`assertOwner` helpers, which they reuse):

```ts
  async findDirectory(userId: string) {
    const bars = await this.prisma.bar.findMany({
      include: {
        memberships: {
          select: { userId: true, role: true, user: { select: { username: true } } },
        },
        _count: { select: { memberships: true } },
      },
      orderBy: { name: 'asc' },
    });

    const pendingRequests = await this.prisma.barJoinRequest.findMany({
      where: { userId, status: 'PENDING' },
      select: { barId: true },
    });
    const pendingBarIds = new Set(pendingRequests.map((r) => r.barId));

    return bars.map((bar) => {
      const owner = bar.memberships.find((m) => m.role === 'OWNER');
      const myMembership = bar.memberships.find((m) => m.userId === userId);

      let myStatus: 'OWNER' | 'MEMBER' | 'PENDING' | 'NONE' = 'NONE';
      if (myMembership?.role === 'OWNER') myStatus = 'OWNER';
      else if (myMembership) myStatus = 'MEMBER';
      else if (pendingBarIds.has(bar.id)) myStatus = 'PENDING';

      return {
        id: bar.id,
        name: bar.name,
        ownerUsername: owner?.user.username ?? '—',
        memberCount: bar._count.memberships,
        myStatus,
      };
    });
  }

  async createJoinRequest(barId: string, userId: string) {
    await this.getBar(barId);

    const membership = await this.getMembership(barId, userId);
    if (membership) {
      throw new ConflictException('Vous êtes déjà membre de ce bar');
    }

    const existing = await this.prisma.barJoinRequest.findUnique({
      where: { barId_userId: { barId, userId } },
    });

    if (existing?.status === 'PENDING') {
      throw new ConflictException('Vous avez déjà une demande en attente pour ce bar');
    }

    if (existing) {
      return this.prisma.barJoinRequest.update({
        where: { id: existing.id },
        data: { status: 'PENDING' },
      });
    }

    return this.prisma.barJoinRequest.create({
      data: { barId, userId, status: 'PENDING' },
    });
  }

  async findPendingRequests(barId: string, requesterId: string) {
    await this.assertOwner(barId, requesterId);

    return this.prisma.barJoinRequest.findMany({
      where: { barId, status: 'PENDING' },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async respondToJoinRequest(
    barId: string,
    requesterId: string,
    requestId: string,
    accept: boolean,
  ) {
    await this.assertOwner(barId, requesterId);

    const request = await this.prisma.barJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.barId !== barId) {
      throw new NotFoundException('Demande introuvable');
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('Cette demande a déjà été traitée');
    }

    if (accept) {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.barMembership.create({
          data: { barId, userId: request.userId, role: 'MEMBER', vip: false },
        }),
        this.prisma.barJoinRequest.update({
          where: { id: requestId },
          data: { status: 'ACCEPTED' },
        }),
      ]);
      return updated;
    }

    return this.prisma.barJoinRequest.update({
      where: { id: requestId },
      data: { status: 'DECLINED' },
    });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: PASS, all tests (existing + 11 new) green.

- [ ] **Step 5: Run the full test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add api/src/bars
git commit -m "feat(api): add bar directory and join-request logic to BarsService"
```

---

### Task 3: `BarsController` — wire the new routes

**Files:**
- Create: `api/src/bars/dto/respond-join-request.dto.ts`
- Modify: `api/src/bars/bars.controller.ts`

**Interfaces:**
- Consumes: the four `BarsService` methods from Task 2.
- Produces: `GET /bars/directory`, `POST /bars/:id/join-requests`, `GET /bars/:id/join-requests`, `PATCH /bars/:id/join-requests/:requestId`.

No dedicated controller test file for this task — matches the existing convention (no test file for `bars.controller.ts`'s existing routes either).

- [ ] **Step 1: Create the DTO**

```ts
// api/src/bars/dto/respond-join-request.dto.ts
import { IsBoolean } from 'class-validator';

export class RespondJoinRequestDto {
  @IsBoolean()
  accept: boolean;
}
```

- [ ] **Step 2: Add the four routes to the controller**

In `api/src/bars/bars.controller.ts`, add the import:

```ts
import { RespondJoinRequestDto } from './dto/respond-join-request.dto';
```

Add these methods (place `findDirectory` right after `findMine`, and the three join-request methods after `removeMember`, matching the service's method order):

```ts
  @Get('directory')
  findDirectory(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.barsService.findDirectory(user.sub);
  }
```

```ts
  @Post(':id/join-requests')
  createJoinRequest(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.createJoinRequest(id, user.sub);
  }

  @Get(':id/join-requests')
  findPendingRequests(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.findPendingRequests(id, user.sub);
  }

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
```

- [ ] **Step 3: Run the full test suite**

Run: `cd api && npm test`
Expected: all suites pass (no regressions).

- [ ] **Step 4: Manual smoke test**

With the stack running (Docker or native, whichever is reachable in your environment):

```bash
curl -s http://localhost:3001/bars/directory -b /tmp/cookies.txt
```

Expected: an array of bars with `myStatus` fields, using a cookie jar from an existing logged-in session (see Task 4's plan for the phase-2 pattern of signing up and capturing cookies with curl, if you need to set one up fresh).

- [ ] **Step 5: Commit**

```bash
git add api/src/bars
git commit -m "feat(api): wire up bar directory and join-request routes"
```

---

### Task 4: Frontend — types & `api-client.ts` additions

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api-client.ts`

**Interfaces:**
- Produces: types `BarDirectoryEntry { id, name, ownerUsername, memberCount, myStatus: "OWNER"|"MEMBER"|"PENDING"|"NONE" }` and `PendingJoinRequest { id, barId, userId, status, createdAt, user: { username } }` in `src/lib/types.ts`; functions `listBarsDirectory()`, `requestToJoinBar(barId)`, `listPendingJoinRequests(barId)`, `respondToJoinRequest(barId, requestId, accept)` in `src/lib/api-client.ts`.

- [ ] **Step 1: Add the two types**

Add to `src/lib/types.ts` (after the existing `BarMember` interface):

```ts
export interface BarDirectoryEntry {
  id: string;
  name: string;
  ownerUsername: string;
  memberCount: number;
  myStatus: "OWNER" | "MEMBER" | "PENDING" | "NONE";
}

export interface PendingJoinRequest {
  id: string;
  barId: string;
  userId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  user: { username: string };
}
```

- [ ] **Step 2: Add the four functions to `api-client.ts`**

In `src/lib/api-client.ts`, merge the two new types into the existing type-only import from `./types`:

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
} from "./types";
```

Add at the end of the file (after `removeBarMember`):

```ts
export function listBarsDirectory(): Promise<BarDirectoryEntry[]> {
  return request<BarDirectoryEntry[]>("/bars/directory");
}

export function requestToJoinBar(barId: string): Promise<{ id: string; status: string }> {
  return request(`/bars/${barId}/join-requests`, { method: "POST" });
}

export function listPendingJoinRequests(barId: string): Promise<PendingJoinRequest[]> {
  return request<PendingJoinRequest[]>(`/bars/${barId}/join-requests`);
}

export function respondToJoinRequest(
  barId: string,
  requestId: string,
  accept: boolean,
): Promise<{ id: string; status: string }> {
  return request(`/bars/${barId}/join-requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({ accept }),
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors (these functions aren't called from anywhere yet, so nothing downstream should break).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/api-client.ts
git commit -m "feat(web): add bar directory and join-request types/api-client functions"
```

---

### Task 5: Frontend — new home page with directory

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/BarDirectory.tsx`
- Modify: `src/app/bar-actions.ts`

**Interfaces:**
- Consumes: `listBarsDirectory`, `requestToJoinBar` (Task 4), `listMyBars`, `listEvents`, `listBottles`, `evaluateCocktails`, `resolveActiveBar` (all existing).
- Produces: exported Server Action `requestToJoinBarAction(barId: string): Promise<{ error?: string }>` in `src/app/bar-actions.ts`; `<BarDirectory entries={BarDirectoryEntry[]} />` client component.

- [ ] **Step 1: Add `requestToJoinBarAction` to `src/app/bar-actions.ts`**

Add this action (it reuses the existing `requireLoggedIn()` helper already in the file from the earlier login-UX work):

```ts
export async function requestToJoinBarAction(barId: string): Promise<{ error?: string }> {
  await requireLoggedIn();
  try {
    await api.requestToJoinBar(barId);
    revalidatePath("/");
    return {};
  } catch (err) {
    return { error: err instanceof api.ApiError ? err.message : "Erreur lors de la demande" };
  }
}
```

- [ ] **Step 2: Create `BarDirectory.tsx`**

```tsx
// src/app/BarDirectory.tsx
"use client";

import { useState, useTransition } from "react";
import type { BarDirectoryEntry } from "@/lib/types";
import { requestToJoinBarAction } from "@/app/bar-actions";

export default function BarDirectory({ entries }: { entries: BarDirectoryEntry[] }) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRequest = (barId: string) => {
    setPendingId(barId);
    startTransition(async () => {
      const result = await requestToJoinBarAction(barId);
      if (result.error) {
        setErrors((prev) => ({ ...prev, [barId]: result.error! }));
      }
      setPendingId(null);
    });
  };

  return (
    <div className="rounded-2xl bg-ink-2/80 border border-white/[0.08] p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
        <span className="text-xs uppercase tracking-caps text-gold font-bold">Annuaire des Bars</span>
        <span className="text-[11px] text-muted bg-white/[0.05] px-2.5 py-0.5 rounded-full">
          {entries.length} bar{entries.length > 1 ? "s" : ""}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted/70 italic py-4">Aucun bar sur la plateforme pour le moment.</p>
      ) : (
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3.5 rounded-xl bg-ink/70 border border-white/[0.06] hover:border-orange/30 transition-colors"
            >
              <div>
                <p className="font-semibold text-sm text-cream">{entry.name}</p>
                <p className="text-xs text-muted">
                  Par {entry.ownerUsername} · {entry.memberCount} membre{entry.memberCount > 1 ? "s" : ""}
                </p>
                {errors[entry.id] && <p className="text-xs text-red-400 mt-1">{errors[entry.id]}</p>}
              </div>

              {entry.myStatus === "OWNER" && (
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-gold/15 text-gold border border-gold/30">
                  Propriétaire
                </span>
              )}
              {entry.myStatus === "MEMBER" && (
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-white/[0.05] text-muted border border-white/[0.08]">
                  Membre
                </span>
              )}
              {entry.myStatus === "PENDING" && (
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-orange/10 text-orange border border-orange/30">
                  Demande envoyée
                </span>
              )}
              {entry.myStatus === "NONE" && (
                <button
                  disabled={isPending && pendingId === entry.id}
                  onClick={() => handleRequest(entry.id)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors cursor-pointer"
                >
                  Demander à rejoindre
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `src/app/page.tsx`**

`src/app/page.tsx` is 263 lines total. Only the top of the file (imports through the `nextEvent` computation), one small JSX addition to the "Prochain Party Board" card, and the file's final closing lines change — the rest (the KPI grid, the low-stock alerts card, `LoungeMetricCard`) is untouched.

Replace:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { listBottles, listEvents, evaluateCocktails, listMyBars } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const [bottles, events, availability] = await Promise.all([
    listBottles(activeBar.id),
    listEvents(activeBar.id),
    evaluateCocktails(activeBar.id),
  ]);

  const isVipOrAdmin = Boolean(session.vip || session.role === "ADMIN" || activeBar.myVip);
  const accessibleBottles = isVipOrAdmin ? bottles : bottles.filter((b) => !b.vip);

  const stockCount = accessibleBottles.filter((b) => !b.vip && b.type !== "mixer" && b.quantity > 0).length;
  const vipCount = bottles.filter((b) => b.vip).length;
  const totalLiters = accessibleBottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const makeableNow = availability.filter((a) => a.makeable && !a.usesVip).length;

  const lowStock = accessibleBottles
    .filter((b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold)
    .sort((a, b) => (a.quantity - a.lowStockThreshold!) - (b.quantity - b.lowStockThreshold!));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = upcoming[0];
```

with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { listBottles, listEvents, evaluateCocktails, listMyBars, listBarsDirectory } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";
import BarDirectory from "./BarDirectory";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const [bottles, availability, directory, eventsByBar] = await Promise.all([
    listBottles(activeBar.id),
    evaluateCocktails(activeBar.id),
    listBarsDirectory(),
    Promise.all(
      bars.map(async (bar) => {
        const barEvents = await listEvents(bar.id);
        return barEvents.map((event) => ({ ...event, barName: bar.name }));
      }),
    ),
  ]);

  const isVipOrAdmin = Boolean(session.vip || session.role === "ADMIN" || activeBar.myVip);
  const accessibleBottles = isVipOrAdmin ? bottles : bottles.filter((b) => !b.vip);

  const stockCount = accessibleBottles.filter((b) => !b.vip && b.type !== "mixer" && b.quantity > 0).length;
  const vipCount = bottles.filter((b) => b.vip).length;
  const totalLiters = accessibleBottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const makeableNow = availability.filter((a) => a.makeable && !a.usesVip).length;

  const lowStock = accessibleBottles
    .filter((b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold)
    .sort((a, b) => (a.quantity - a.lowStockThreshold!) - (b.quantity - b.lowStockThreshold!));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = eventsByBar
    .flat()
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = upcoming[0];
```

(`upcoming`/`nextEvent` now span every bar the user belongs to instead of just the active one — this is the only behavioral change; the KPI tile counting `upcoming.length` and the "Prochain Party Board" card automatically reflect this with no further changes needed there, except the one label addition below.)

Next, replace (inside the "Prochain Party Board" card's `nextEvent` branch):

```tsx
                <h3 className="font-display text-2xl font-bold text-cream">{nextEvent.name}</h3>
                <p className="text-orange text-xs font-semibold capitalize">
                  {new Date(nextEvent.date).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
```

with:

```tsx
                <h3 className="font-display text-2xl font-bold text-cream">{nextEvent.name}</h3>
                <p className="text-orange text-xs font-semibold capitalize">
                  {new Date(nextEvent.date).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {" · "}
                  {nextEvent.barName}
                </p>
```

Finally, replace the very end of the file:

```tsx
        </div>
      </div>
    </PageTransition>
  );
}
```

with:

```tsx
        </div>
      </div>

      <BarDirectory entries={directory} />
    </PageTransition>
  );
}
```

(This exact 5-line block appears once, immediately after the low-stock alerts card's closing `</div>`s — everything above it, including the whole KPI grid and both cards' JSX, is untouched.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 5: Manual check**

With the dev server running and at least two accounts (one owning a bar, one not a member of it), visit `/bar` as the non-member account: confirm the directory shows the other account's bar with a "Demander à rejoindre" button, clicking it shows "Demande envoyée" afterward (no page reload needed, but a manual refresh should also reflect it since the action calls `revalidatePath("/")`).

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/BarDirectory.tsx src/app/bar-actions.ts
git commit -m "feat(web): add bar directory to a rebuilt home page"
```

---

### Task 6: Frontend — pending join requests on `/membres`

**Files:**
- Modify: `src/app/membres/page.tsx`
- Create: `src/app/membres/PendingRequests.tsx`
- Modify: `src/app/bar-actions.ts`

**Interfaces:**
- Consumes: `listPendingJoinRequests`, `respondToJoinRequest` (Task 4).
- Produces: exported Server Action `respondToJoinRequestAction(barId: string, requestId: string, accept: boolean): Promise<void>`.

- [ ] **Step 1: Add `respondToJoinRequestAction` to `src/app/bar-actions.ts`**

```ts
export async function respondToJoinRequestAction(barId: string, requestId: string, accept: boolean) {
  await requireLoggedIn();
  await api.respondToJoinRequest(barId, requestId, accept);
  revalidatePath("/membres");
}
```

- [ ] **Step 2: Create `PendingRequests.tsx`**

```tsx
// src/app/membres/PendingRequests.tsx
"use client";

import { useState, useTransition } from "react";
import type { PendingJoinRequest } from "@/lib/types";
import { respondToJoinRequestAction } from "@/app/bar-actions";

export default function PendingRequests({ barId, requests }: { barId: string; requests: PendingJoinRequest[] }) {
  const [isPending, startTransition] = useTransition();
  const [handledIds, setHandledIds] = useState<string[]>([]);

  const visible = requests.filter((r) => !handledIds.includes(r.id));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl bg-ink-2 border border-orange/20 p-6 shadow-xl space-y-3">
      <h2 className="font-display text-xl text-cream">Demandes en attente</h2>
      {visible.map((request) => (
        <div
          key={request.id}
          className="flex items-center justify-between p-3 rounded-xl bg-ink border border-white/[0.08]"
        >
          <span className="text-sm text-cream font-semibold">{request.user.username}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await respondToJoinRequestAction(barId, request.id, true);
                  setHandledIds((prev) => [...prev, request.id]);
                })
              }
              className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-semibold transition-colors cursor-pointer"
            >
              Accepter
            </button>
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await respondToJoinRequestAction(barId, request.id, false);
                  setHandledIds((prev) => [...prev, request.id]);
                })
              }
              className="text-xs px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold transition-colors cursor-pointer"
            >
              Refuser
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update `src/app/membres/page.tsx`**

Replace:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listMyBars, listBarMembers } from "@/lib/api-client";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import InviteMemberForm from "./InviteMemberForm";
import MemberRow from "./MemberRow";

export default async function BarMembresPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");
  if (activeBar.myRole !== "OWNER") redirect("/");

  const members = await listBarMembers(activeBar.id);

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Gestion du bar</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Membres de {activeBar.name}
        </h1>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
```

with:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listMyBars, listBarMembers, listPendingJoinRequests } from "@/lib/api-client";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import InviteMemberForm from "./InviteMemberForm";
import MemberRow from "./MemberRow";
import PendingRequests from "./PendingRequests";

export default async function BarMembresPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");
  if (activeBar.myRole !== "OWNER") redirect("/");

  const [members, pendingRequests] = await Promise.all([
    listBarMembers(activeBar.id),
    listPendingJoinRequests(activeBar.id),
  ]);

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Gestion du bar</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Membres de {activeBar.name}
        </h1>
      </div>

      <PendingRequests barId={activeBar.id} requests={pendingRequests} />

      <div className="grid lg:grid-cols-12 gap-8 items-start">
```

(The rest of the file — the `InviteMemberForm`/`MemberRow` grid and its closing tags — is unchanged.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 5: Manual check**

As a bar owner with at least one pending join request (created via Task 5's manual check), visit `/bar/membres`, confirm the "Demandes en attente" section appears above the members list with Accepter/Refuser buttons, accepting makes the requester show up in the members list below (after a page refresh, since the section only removes the row from its own local state — the members list refetches via `revalidatePath`), and refusing removes it from view without adding a member.

- [ ] **Step 6: Commit**

```bash
git add src/app/membres src/app/bar-actions.ts
git commit -m "feat(web): add pending join-request approval to /membres"
```

---

### Task 7: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full API test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 2: Type-check the whole frontend**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Full manual walkthrough**

Using two accounts, one owning a bar (`owner1`) and one without access to it (`newcomer`):

1. As `newcomer`, visit the home page, confirm the directory lists `owner1`'s bar with a "Demander à rejoindre" button and the correct member count.
2. Click "Demander à rejoindre" — confirm it becomes "Demande envoyée" and stays that way on reload.
3. Attempting to request again (e.g. via a direct API call) should be rejected — already covered by Task 2's unit tests, no need to re-verify manually.
4. As `owner1`, visit `/bar/membres`, confirm the pending request from `newcomer` appears with Accepter/Refuser.
5. Accept it — confirm `newcomer` now appears in the members list, and as `newcomer`, confirm the bar now appears in their bar switcher/`listMyBars()`.
6. Repeat with a second newcomer account, but refuse instead — confirm no membership was created, and that a second request from the same account is possible after a refusal (re-request reactivates instead of erroring).
7. Confirm the "Prochaine soirée" section on the home page reflects the earliest upcoming soirée across all bars the viewing account belongs to (create soirées in two different bars the same account is in, confirm the earliest one wins and shows the correct bar name).

- [ ] **Step 4: Clean up test data**

Remove any test accounts/bars/requests created for this walkthrough (direct SQL against the Postgres container, or leave them if the user prefers — ask before deleting anything).

- [ ] **Step 5: Commit (only if the walkthrough surfaced fixes)**

No-op if the walkthrough passed clean — the feature is already fully committed task-by-task.
