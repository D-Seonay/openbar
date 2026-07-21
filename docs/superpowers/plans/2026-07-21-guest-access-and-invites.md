# Guest Access, Public/Private Bars & Improved Invites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor without an account browse a directory of public bars, let each bar's owner choose public/private visibility (private by default for new bars, existing bars stay public), and give owners two easier ways to add members: searching existing accounts instead of typing an exact username, and a reusable invite link that works for people without an account yet.

**Architecture:** One Prisma migration (`Bar.isPublic`, `Bar.inviteToken`), several new/modified `BarsService`/`BarsController` methods (all in `api/src/bars/`), one new `UsersService.search` method, and on the frontend a new public directory page, new `/membres` sections, a rewritten invite form, and a new `/rejoindre/[token]` landing page plus small `login`/`signup` wiring.

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL (API), Next.js 16 App Router + Server Actions (frontend), Jest (API unit tests only).

## Global Constraints

- Follow the existing module pattern exactly (`api/src/bars/`, `api/src/users/`) — controller thin, DTO the only validation layer where a DTO exists.
- No new npm dependencies (invite tokens use Node's built-in `crypto` module).
- French user-facing strings and exception messages, matching the rest of the codebase.
- `next.config.ts` has `basePath: "/bar"` — any `redirect()`/`<Link href>` written must be a logical path with no `/bar` prefix.
- NestJS composes class-level and method-level guards (both run; neither overrides the other). `BarsController` currently has a class-level `@UseGuards(JwtAuthGuard)` — this must be **removed** and replaced with an explicit `@UseGuards(JwtAuthGuard)` on every method except `findDirectory` and `previewInviteLink`, which get `@UseGuards(OptionalJwtAuthGuard)`. This mirrors the existing pattern in `api/src/contributions/contributions.controller.ts` (no class-level guard, one guard per method) — read that file for the precedent before touching `bars.controller.ts`.
- A bar's `isPublic` default is `true` at the **database/migration level only**, so existing rows are unaffected (backward compatibility) — but `BarsService.create()` must explicitly pass `isPublic: false` so newly created bars are private by default. Both facts must hold at once; don't "fix" one by changing the other.
- The frontend has no test framework — verify with `npx tsc --noEmit -p .` and manual/curl checks.
- `Contribution` (event guest contributions) stays completely out of scope, as in every prior phase of this app.

---

### Task 1: Prisma schema — `Bar.isPublic` + `Bar.inviteToken`

**Files:**
- Modify: `api/prisma/schema.prisma`

**Interfaces:**
- Produces: `Bar.isPublic: boolean` (DB default `true`), `Bar.inviteToken: string | null` (unique).

- [ ] **Step 1: Add the two fields to the `Bar` model**

In `api/prisma/schema.prisma`, add `isPublic` and `inviteToken` to the existing `Bar` model:

```prisma
model Bar {
  id           String           @id @default(cuid())
  name         String
  isPublic     Boolean          @default(true)
  inviteToken  String?          @unique
  createdAt    DateTime         @default(now())
  memberships  BarMembership[]
  bottles      Bottle[]
  events       Event[]
  recipes      Recipe[]
  joinRequests BarJoinRequest[]
}
```

(Only `isPublic`/`inviteToken` are new — every other field/relation is unchanged from the current file.)

- [ ] **Step 2: Validate and migrate**

Run: `cd api && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

Run: `cd api && npx prisma migrate dev --name add_bar_public_invite_link`
Expected: `Your database is now in sync with your schema.` — the DB-level `DEFAULT true` on `isPublic` automatically backfills every existing row to `true`; no separate backfill script is needed.

- [ ] **Step 3: Run the full test suite**

Run: `cd api && npm test`
Expected: all existing suites still pass (this change is additive to the schema only).

- [ ] **Step 4: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add Bar.isPublic and Bar.inviteToken"
```

---

### Task 2: `BarsService` — public/private core

**Files:**
- Modify: `api/src/bars/bars.service.ts`
- Test: `api/src/bars/bars.service.spec.ts`

**Interfaces:**
- Consumes: existing `getBar`/`getMembership`/`assertOwner` helpers (unchanged).
- Produces:
  - `BarsService.create(name, userId)` — now passes `isPublic: false` in the create data.
  - `BarsService.findDirectory(userId?: string)` — `userId` becomes optional; always filters `where: { isPublic: true }`; when `userId` is omitted, every entry's `myStatus` is `'NONE'`.
  - `BarsService.createJoinRequest(barId, userId)` — now throws `ForbiddenException` if the bar is private.
  - `BarsService.setPublic(barId: string, requesterId: string, isPublic: boolean): Promise<{ id: string; isPublic: boolean }>` — new, owner-only.

- [ ] **Step 1: Update the `create` test and add the `isPublic: false` data field**

In `api/src/bars/bars.service.spec.ts`, update the `create` describe block's first test:

Replace:

```ts
      expect(prisma.bar.create).toHaveBeenCalledWith({
        data: {
          name: 'Chez Noa',
          memberships: {
            create: { userId: OWNER_ID, role: 'OWNER', vip: true },
          },
        },
        include: { memberships: true },
      });
```

with:

```ts
      expect(prisma.bar.create).toHaveBeenCalledWith({
        data: {
          name: 'Chez Noa',
          isPublic: false,
          memberships: {
            create: { userId: OWNER_ID, role: 'OWNER', vip: true },
          },
        },
        include: { memberships: true },
      });
```

In `api/src/bars/bars.service.ts`, update `create`:

Replace:

```ts
    return this.prisma.bar.create({
      data: {
        name,
        memberships: { create: { userId, role: 'OWNER', vip: true } },
      },
      include: { memberships: true },
    });
```

with:

```ts
    return this.prisma.bar.create({
      data: {
        name,
        isPublic: false,
        memberships: { create: { userId, role: 'OWNER', vip: true } },
      },
      include: { memberships: true },
    });
```

- [ ] **Step 2: Run the test to verify it fails, then passes**

Run: `cd api && npx jest bars/bars.service.spec.ts -t "creates a bar with an OWNER membership"`
Expected before the code change: FAIL (`isPublic: false` missing from the actual call). After the code change: PASS.

- [ ] **Step 3: Update `findDirectory`'s test and add the guest (no-`userId`) test**

In `api/src/bars/bars.service.spec.ts`, in the `findDirectory` describe block, add an assertion on the `bar.findMany` call inside the existing test, and add a new test right after it:

Replace:

```ts
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
```

with:

```ts
      const result = await service.findDirectory(OWNER_ID);

      expect(prisma.bar.findMany).toHaveBeenCalledWith({
        where: { isPublic: true },
        include: {
          memberships: {
            select: { userId: true, role: true, user: { select: { username: true } } },
          },
          _count: { select: { memberships: true } },
        },
        orderBy: { name: 'asc' },
      });
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

    it('returns myStatus NONE for every bar when called without a userId (guest)', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: 'bar-a',
          name: 'Bar A',
          memberships: [{ userId: OWNER_ID, role: 'OWNER', user: { username: 'owner1' } }],
          _count: { memberships: 1 },
        },
      ]);

      const result = await service.findDirectory();

      expect(prisma.barJoinRequest.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([
        { id: 'bar-a', name: 'Bar A', ownerUsername: 'owner1', memberCount: 1, myStatus: 'NONE' },
      ]);
    });
  });
```

In `api/src/bars/bars.service.ts`, replace `findDirectory`:

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
```

with:

```ts
  async findDirectory(userId?: string) {
    const bars = await this.prisma.bar.findMany({
      where: { isPublic: true },
      include: {
        memberships: {
          select: { userId: true, role: true, user: { select: { username: true } } },
        },
        _count: { select: { memberships: true } },
      },
      orderBy: { name: 'asc' },
    });

    let pendingBarIds = new Set<string>();
    if (userId) {
      const pendingRequests = await this.prisma.barJoinRequest.findMany({
        where: { userId, status: 'PENDING' },
        select: { barId: true },
      });
      pendingBarIds = new Set(pendingRequests.map((r) => r.barId));
    }

    return bars.map((bar) => {
      const owner = bar.memberships.find((m) => m.role === 'OWNER');
      const myMembership = userId ? bar.memberships.find((m) => m.userId === userId) : undefined;

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts -t "findDirectory"`
Expected: PASS (both the updated existing test and the new guest test).

- [ ] **Step 5: Replace the whole `createJoinRequest` describe block**

In `api/src/bars/bars.service.spec.ts`, the string `prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });` is not unique in this file (it also appears in `findMembers`, `inviteMember`, and other describe blocks), so a find-and-replace on that line alone is unsafe. Instead, replace the **entire** `describe('createJoinRequest', ...)` block verbatim — this both adds the new private-bar test and updates all 4 existing mocks in one unambiguous edit:

Replace:

```ts
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
```

with:

```ts
  describe('createJoinRequest', () => {
    it('rejects a join request for a private bar', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: false });

      await expect(service.createJoinRequest(BAR_ID, OTHER_ID)).rejects.toThrow(ForbiddenException);
      expect(prisma.barMembership.findUnique).not.toHaveBeenCalled();
    });

    it('rejects if the caller is already a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: true });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.createJoinRequest(BAR_ID, OTHER_ID)).rejects.toThrow(ConflictException);
      expect(prisma.barJoinRequest.create).not.toHaveBeenCalled();
    });

    it('rejects if a PENDING request already exists', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: true });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.barJoinRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

      await expect(service.createJoinRequest(BAR_ID, OTHER_ID)).rejects.toThrow(ConflictException);
      expect(prisma.barJoinRequest.create).not.toHaveBeenCalled();
    });

    it('reactivates a DECLINED request instead of creating a new row', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: true });
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
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, isPublic: true });
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
```

In `api/src/bars/bars.service.ts`, update `createJoinRequest`:

Replace:

```ts
  async createJoinRequest(barId: string, userId: string) {
    await this.getBar(barId);

    const membership = await this.getMembership(barId, userId);
```

with:

```ts
  async createJoinRequest(barId: string, userId: string) {
    const bar = await this.getBar(barId);
    if (!bar.isPublic) {
      throw new ForbiddenException('Ce bar est privé');
    }

    const membership = await this.getMembership(barId, userId);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts -t "createJoinRequest"`
Expected: PASS (5 tests: the new private-bar test plus the 4 existing ones with updated mocks).

- [ ] **Step 7: Add `setPublic` with its test**

In `api/src/bars/bars.service.spec.ts`, insert a new `describe('setPublic', ...)` block between the existing `removeMember` and `findDirectory` blocks. Anchor the edit on the exact boundary between them:

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

  describe('findDirectory', () => {
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
  });

  describe('setPublic', () => {
    it('forbids a non-owner from changing visibility', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.setPublic(BAR_ID, OTHER_ID, true)).rejects.toThrow(ForbiddenException);
    });

    it('updates the bar visibility for the owner', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      prisma.bar.update.mockResolvedValue({ id: BAR_ID, isPublic: false });

      const result = await service.setPublic(BAR_ID, OWNER_ID, false);

      expect(prisma.bar.update).toHaveBeenCalledWith({
        where: { id: BAR_ID },
        data: { isPublic: false },
      });
      expect(result).toEqual({ id: BAR_ID, isPublic: false });
    });
  });

  describe('findDirectory', () => {
```

(The trailing `describe('findDirectory', () => {` line matters — it's the same line that was consumed by the "Replace" text above, and must be put back here so the file's structure stays intact. Everything after it in the real file — the existing `findDirectory` tests, already updated by Step 3 — is untouched by this edit.)

Add `update: jest.fn()` to the `prisma.bar` mock object in `beforeEach`:

Replace:

```ts
      bar: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
```

with:

```ts
      bar: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
```

In `api/src/bars/bars.service.ts`, add the new method after `removeMember` and before `findDirectory`:

```ts
  async setPublic(barId: string, requesterId: string, isPublic: boolean) {
    await this.assertOwner(barId, requesterId);
    const bar = await this.prisma.bar.update({
      where: { id: barId },
      data: { isPublic },
    });
    return { id: bar.id, isPublic: bar.isPublic };
  }
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts -t "setPublic"`
Expected: PASS.

- [ ] **Step 9: Run the full test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 10: Commit**

```bash
git add api/src/bars/bars.service.ts api/src/bars/bars.service.spec.ts
git commit -m "feat(api): make bars public/private with owner-controlled visibility"
```

---

### Task 3: `BarsService`/`UsersService` — invite improvements

**Files:**
- Modify: `api/src/users/users.service.ts`
- Test: `api/src/users/users.service.spec.ts`
- Modify: `api/src/bars/bars.service.ts`
- Test: `api/src/bars/bars.service.spec.ts`

**Interfaces:**
- Consumes: `UsersService` (already injected into `BarsService`), existing `assertOwner`/`getMembership` helpers.
- Produces:
  - `UsersService.search(query: string): Promise<{ id: string; username: string }[]>`
  - `BarsService.searchUsers(query: string)` — delegates to `usersService.search`.
  - `BarsService.generateInviteLink(barId, requesterId): Promise<{ inviteToken: string }>` — owner-only.
  - `BarsService.previewInviteLink(token: string): Promise<{ barName: string }>`
  - `BarsService.joinViaInviteLink(token: string, userId: string): Promise<{ barId: string; barName: string; alreadyMember: boolean }>`

- [ ] **Step 1: Write the failing `UsersService.search` test**

Add to `api/src/users/users.service.spec.ts`:

```ts
  it('searches users by partial, case-insensitive username match', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: '1', username: 'noah' }]);

    const result = await service.search('noa');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { username: { contains: 'noa', mode: 'insensitive' } },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
      take: 10,
    });
    expect(result).toEqual([{ id: '1', username: 'noah' }]);
  });
```

(`prisma.user.findMany` is already mocked in this file's `beforeEach` — no setup change needed.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd api && npx jest users/users.service.spec.ts -t "searches users"`
Expected: FAIL — `service.search is not a function`.

- [ ] **Step 3: Implement `UsersService.search`**

In `api/src/users/users.service.ts`, add after `findByUsername`:

```ts
  search(query: string) {
    return this.prisma.user.findMany({
      where: { username: { contains: query, mode: 'insensitive' } },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
      take: 10,
    });
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd api && npx jest users/users.service.spec.ts`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Write the failing `BarsService` tests**

In `api/src/bars/bars.service.spec.ts`, update the `usersService` mock in `beforeEach`:

Replace:

```ts
    usersService = { findByUsername: jest.fn() };
```

with:

```ts
    usersService = { findByUsername: jest.fn(), search: jest.fn() };
```

Update the `let usersService` type declaration at the top of the file:

Replace:

```ts
  let usersService: { findByUsername: jest.Mock };
```

with:

```ts
  let usersService: { findByUsername: jest.Mock; search: jest.Mock };
```

Add `jest.mock('crypto', ...)` at the top of the file, right after the existing imports:

```ts
import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { BarsService } from './bars.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

jest.mock('crypto', () => ({ randomBytes: jest.fn() }));
```

(Only the `import { randomBytes } from 'crypto';` line and the `jest.mock('crypto', ...)` call are new — the other imports are unchanged.)

Add four new describe blocks at the end of the file, right before the final closing `});` of the outer `describe('BarsService', ...)`:

```ts
  describe('searchUsers', () => {
    it('delegates to UsersService.search', async () => {
      usersService.search.mockResolvedValue([{ id: '1', username: 'bob' }]);

      const result = await service.searchUsers('bo');

      expect(usersService.search).toHaveBeenCalledWith('bo');
      expect(result).toEqual([{ id: '1', username: 'bob' }]);
    });
  });

  describe('generateInviteLink', () => {
    it('forbids a non-owner from generating a link', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.generateInviteLink(BAR_ID, OTHER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('generates and stores a new token for the owner', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      (randomBytes as jest.Mock).mockReturnValue(Buffer.from('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'hex'));
      prisma.bar.update.mockResolvedValue({ id: BAR_ID, inviteToken: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' });

      const result = await service.generateInviteLink(BAR_ID, OWNER_ID);

      expect(prisma.bar.update).toHaveBeenCalledWith({
        where: { id: BAR_ID },
        data: { inviteToken: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' },
      });
      expect(result).toEqual({ inviteToken: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' });
    });
  });

  describe('previewInviteLink', () => {
    it('throws NotFoundException for an invalid token', async () => {
      prisma.bar.findUnique.mockResolvedValue(null);

      await expect(service.previewInviteLink('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('returns the bar name for a valid token', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, name: 'Chez Noa', inviteToken: 'tok-1' });

      const result = await service.previewInviteLink('tok-1');

      expect(prisma.bar.findUnique).toHaveBeenCalledWith({ where: { inviteToken: 'tok-1' } });
      expect(result).toEqual({ barName: 'Chez Noa' });
    });
  });

  describe('joinViaInviteLink', () => {
    it('throws NotFoundException for an invalid token', async () => {
      prisma.bar.findUnique.mockResolvedValue(null);

      await expect(service.joinViaInviteLink('bad-token', OTHER_ID)).rejects.toThrow(NotFoundException);
    });

    it('is idempotent if the caller is already a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, name: 'Chez Noa', inviteToken: 'tok-1' });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      const result = await service.joinViaInviteLink('tok-1', OTHER_ID);

      expect(prisma.barMembership.create).not.toHaveBeenCalled();
      expect(result).toEqual({ barId: BAR_ID, barName: 'Chez Noa', alreadyMember: true });
    });

    it('creates a MEMBER membership for a new joiner', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID, name: 'Chez Noa', inviteToken: 'tok-1' });
      prisma.barMembership.findUnique.mockResolvedValue(null);
      prisma.barMembership.create.mockResolvedValue({ id: 'm2' });

      const result = await service.joinViaInviteLink('tok-1', OTHER_ID);

      expect(prisma.barMembership.create).toHaveBeenCalledWith({
        data: { barId: BAR_ID, userId: OTHER_ID, role: 'MEMBER', vip: false },
      });
      expect(result).toEqual({ barId: BAR_ID, barName: 'Chez Noa', alreadyMember: false });
    });
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: FAIL — `service.searchUsers`/`generateInviteLink`/`previewInviteLink`/`joinViaInviteLink` are not functions.

- [ ] **Step 7: Implement the four new `BarsService` methods**

In `api/src/bars/bars.service.ts`, add the import at the top:

```ts
import { randomBytes } from 'crypto';
```

Add the four methods after `setPublic` (from Task 2) and before `findDirectory`:

```ts
  searchUsers(query: string) {
    return this.usersService.search(query);
  }

  async generateInviteLink(barId: string, requesterId: string) {
    await this.assertOwner(barId, requesterId);
    const inviteToken = randomBytes(16).toString('hex');
    await this.prisma.bar.update({
      where: { id: barId },
      data: { inviteToken },
    });
    return { inviteToken };
  }

  async previewInviteLink(token: string) {
    const bar = await this.prisma.bar.findUnique({ where: { inviteToken: token } });
    if (!bar) throw new NotFoundException("Lien d'invitation invalide");
    return { barName: bar.name };
  }

  async joinViaInviteLink(token: string, userId: string) {
    const bar = await this.prisma.bar.findUnique({ where: { inviteToken: token } });
    if (!bar) throw new NotFoundException("Lien d'invitation invalide");

    const existing = await this.getMembership(bar.id, userId);
    if (existing) {
      return { barId: bar.id, barName: bar.name, alreadyMember: true };
    }

    await this.prisma.barMembership.create({
      data: { barId: bar.id, userId, role: 'MEMBER', vip: false },
    });
    return { barId: bar.id, barName: bar.name, alreadyMember: false };
  }
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: PASS, all tests (existing + new) green.

- [ ] **Step 9: Run the full test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 10: Commit**

```bash
git add api/src/users/users.service.ts api/src/users/users.service.spec.ts api/src/bars/bars.service.ts api/src/bars/bars.service.spec.ts
git commit -m "feat(api): add user search and bar invite-link logic"
```

---

### Task 4: `BarsController` — guard restructuring + wire all routes

**Files:**
- Create: `api/src/bars/dto/update-bar-visibility.dto.ts`
- Modify: `api/src/bars/bars.controller.ts`

**Interfaces:**
- Consumes: `BarsService.setPublic`, `searchUsers`, `generateInviteLink`, `previewInviteLink`, `joinViaInviteLink` (Tasks 2–3).
- Produces: `PATCH /bars/:id/visibility`, `GET /bars/search-users`, `POST /bars/:id/invite-link`, `GET /bars/invite/:token/preview`, `POST /bars/invite/:token/join`. `GET /bars/directory` moves from `JwtAuthGuard` to `OptionalJwtAuthGuard`.

No dedicated controller test file (matches existing convention).

- [ ] **Step 1: Create the DTO**

```ts
// api/src/bars/dto/update-bar-visibility.dto.ts
import { IsBoolean } from 'class-validator';

export class UpdateBarVisibilityDto {
  @IsBoolean()
  isPublic: boolean;
}
```

- [ ] **Step 2: Rewrite the controller**

Replace the entire content of `api/src/bars/bars.controller.ts` with:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarsService } from './bars.service';
import { CreateBarDto } from './dto/create-bar.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { RespondJoinRequestDto } from './dto/respond-join-request.dto';
import { UpdateBarVisibilityDto } from './dto/update-bar-visibility.dto';

@Controller('bars')
export class BarsController {
  constructor(private readonly barsService: BarsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() dto: CreateBarDto) {
    const user = req.user as JwtPayload;
    return this.barsService.create(dto.name, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.barsService.findMine(user.sub);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('directory')
  findDirectory(@Req() req: Request) {
    const user = req.user as JwtPayload | undefined;
    return this.barsService.findDirectory(user?.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search-users')
  searchUsers(@Query('q') q: string) {
    return this.barsService.searchUsers(q ?? '');
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('invite/:token/preview')
  previewInviteLink(@Param('token') token: string) {
    return this.barsService.previewInviteLink(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invite/:token/join')
  joinViaInviteLink(@Req() req: Request, @Param('token') token: string) {
    const user = req.user as JwtPayload;
    return this.barsService.joinViaInviteLink(token, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/members')
  findMembers(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.findMembers(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/members')
  inviteMember(@Req() req: Request, @Param('id') id: string, @Body() dto: InviteMemberDto) {
    const user = req.user as JwtPayload;
    return this.barsService.inviteMember(id, user.sub, dto.username, dto.vip ?? false);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/members/:membershipId')
  updateMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const user = req.user as JwtPayload;
    return this.barsService.updateMemberVip(id, user.sub, membershipId, dto.vip);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/members/:membershipId')
  removeMember(@Req() req: Request, @Param('id') id: string, @Param('membershipId') membershipId: string) {
    const user = req.user as JwtPayload;
    return this.barsService.removeMember(id, user.sub, membershipId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/visibility')
  setPublic(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBarVisibilityDto) {
    const user = req.user as JwtPayload;
    return this.barsService.setPublic(id, user.sub, dto.isPublic);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/invite-link')
  generateInviteLink(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.generateInviteLink(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join-requests')
  createJoinRequest(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.createJoinRequest(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/join-requests')
  findPendingRequests(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.findPendingRequests(id, user.sub);
  }

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

- [ ] **Step 3: Run the full test suite**

Run: `cd api && npm test`
Expected: all suites pass (no regressions from the guard restructuring — every previously-`JwtAuthGuard`-protected route still is, just via an explicit per-method decorator instead of a class-level one).

- [ ] **Step 4: Manual smoke test**

With the stack running:

```bash
curl -s http://localhost:3001/bars/directory
```

Expected: a JSON array (public bars only), returned even **without** any session cookie — this is the concrete proof the guard change works. Compare against the same call with a valid session cookie (`-b /tmp/cookies.txt`), which should return the same bars but with real `myStatus` values instead of all `'NONE'`.

- [ ] **Step 5: Commit**

```bash
git add api/src/bars
git commit -m "feat(api): wire up public/private and invite-link routes, make directory guest-accessible"
```

---

### Task 5: Frontend — types & `api-client.ts` additions

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api-client.ts`

**Interfaces:**
- Produces: `Bar.isPublic: boolean`, `Bar.inviteToken: string | null` (extended type); new types `UserSearchResult`, `InviteLinkPreview`; new functions `searchUsers`, `generateInviteLink`, `previewInviteLink`, `joinViaInviteLink`, `joinViaInviteLinkWithToken`, `updateBarVisibility`.

- [ ] **Step 1: Extend the `Bar` type and add two new types**

In `src/lib/types.ts`, replace:

```ts
export interface Bar {
  id: string;
  name: string;
  createdAt: string;
  myRole: "OWNER" | "MEMBER";
  myVip: boolean;
}
```

with:

```ts
export interface Bar {
  id: string;
  name: string;
  createdAt: string;
  myRole: "OWNER" | "MEMBER";
  myVip: boolean;
  isPublic: boolean;
  inviteToken: string | null;
}
```

Add after the existing `PendingJoinRequest` interface:

```ts
export interface UserSearchResult {
  id: string;
  username: string;
}

export interface InviteLinkPreview {
  barName: string;
}
```

- [ ] **Step 2: Add the six new functions to `api-client.ts`**

In `src/lib/api-client.ts`, merge the two new types into the existing type-only import:

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
} from "./types";
```

Add at the end of the file (after `respondToJoinRequest`):

```ts
export function searchUsers(query: string): Promise<UserSearchResult[]> {
  return request<UserSearchResult[]>(`/bars/search-users?q=${encodeURIComponent(query)}`);
}

export function generateInviteLink(barId: string): Promise<{ inviteToken: string }> {
  return request(`/bars/${barId}/invite-link`, { method: "POST" });
}

export function previewInviteLink(token: string): Promise<InviteLinkPreview> {
  return request<InviteLinkPreview>(`/bars/invite/${token}/preview`);
}

export function joinViaInviteLink(token: string): Promise<{ barId: string; barName: string; alreadyMember: boolean }> {
  return request(`/bars/invite/${token}/join`, { method: "POST" });
}

export async function joinViaInviteLinkWithToken(
  token: string,
  sessionToken: string,
): Promise<{ barId: string; barName: string; alreadyMember: boolean }> {
  const res = await fetch(`${API_URL}/bars/invite/${token}/join`, {
    method: "POST",
    headers: { Cookie: `${SESSION_COOKIE}=${sessionToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? `Erreur API (${res.status})`);
  }
  return res.json();
}

export function updateBarVisibility(barId: string, isPublic: boolean): Promise<{ id: string; isPublic: boolean }> {
  return request(`/bars/${barId}/visibility`, { method: "PATCH", body: JSON.stringify({ isPublic }) });
}
```

(`joinViaInviteLinkWithToken` deliberately bypasses the cookie-reading `request()` helper — it's used right after signup, in the same server action that just issued a brand-new session token, so it takes that token explicitly instead of depending on whether a freshly-`cookies().set()` value is already visible to a `cookies().get()` call later in the same request. This sidesteps the question entirely rather than relying on it.)

- [ ] **Step 3: Update `BarsService.findMine`'s return shape (API side) is already covered by Task 2 — this step updates the frontend type usage only.**

No code change in this step; this is a placeholder reminder that `src/lib/active-bar.ts`'s `resolveActiveBar` and any other consumer of `Bar` now receives `isPublic`/`inviteToken` fields once Task 6's `BarsService.findMine` change (see Task 6, Step 1) ships. Nothing to do here.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors (new functions aren't called from anywhere yet).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/api-client.ts
git commit -m "feat(web): add types and api-client functions for public/private bars and invites"
```

---

### Task 6: Backend — `findMine` exposes `isPublic`/`inviteToken`; Frontend — guest directory page

**Files:**
- Modify: `api/src/bars/bars.service.ts`
- Test: `api/src/bars/bars.service.spec.ts`
- Modify: `src/app/BarDirectory.tsx`
- Modify: `src/app/login/page.tsx`
- Create: `src/app/decouvrir/page.tsx`

**Interfaces:**
- Consumes: `listBarsDirectory()` (existing, now optionally-authenticated per Task 4).
- Produces: `BarsService.findMine` now returns `isPublic`/`inviteToken` per bar (`inviteToken` only when the caller is that bar's OWNER); `<BarDirectory entries guestMode?: boolean />`.

- [ ] **Step 1: Update `findMine`'s test**

In `api/src/bars/bars.service.spec.ts`, in the `findMine` describe block, replace:

```ts
    it('flattens each bar to include the caller role and vip', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: BAR_ID,
          name: 'Chez Noa',
          createdAt: new Date('2026-01-01'),
          memberships: [{ role: 'OWNER', vip: true }],
        },
      ]);

      const result = await service.findMine(OWNER_ID);

      expect(prisma.bar.findMany).toHaveBeenCalledWith({
        where: { memberships: { some: { userId: OWNER_ID } } },
        include: { memberships: { where: { userId: OWNER_ID } } },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        {
          id: BAR_ID,
          name: 'Chez Noa',
          createdAt: new Date('2026-01-01'),
          myRole: 'OWNER',
          myVip: true,
        },
      ]);
    });
```

with:

```ts
    it('flattens each bar to include the caller role, vip, visibility, and invite token (owner only)', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: BAR_ID,
          name: 'Chez Noa',
          createdAt: new Date('2026-01-01'),
          isPublic: true,
          inviteToken: 'tok-1',
          memberships: [{ role: 'OWNER', vip: true }],
        },
      ]);

      const result = await service.findMine(OWNER_ID);

      expect(prisma.bar.findMany).toHaveBeenCalledWith({
        where: { memberships: { some: { userId: OWNER_ID } } },
        include: { memberships: { where: { userId: OWNER_ID } } },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        {
          id: BAR_ID,
          name: 'Chez Noa',
          createdAt: new Date('2026-01-01'),
          myRole: 'OWNER',
          myVip: true,
          isPublic: true,
          inviteToken: 'tok-1',
        },
      ]);
    });

    it('hides the invite token from a non-owner member', async () => {
      prisma.bar.findMany.mockResolvedValue([
        {
          id: BAR_ID,
          name: 'Chez Noa',
          createdAt: new Date('2026-01-01'),
          isPublic: true,
          inviteToken: 'tok-1',
          memberships: [{ role: 'MEMBER', vip: false }],
        },
      ]);

      const result = await service.findMine(OTHER_ID);

      expect(result[0].inviteToken).toBeNull();
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd api && npx jest bars/bars.service.spec.ts -t "findMine"`
Expected: FAIL — `isPublic`/`inviteToken` missing from the actual result.

- [ ] **Step 3: Update `findMine`**

In `api/src/bars/bars.service.ts`, replace:

```ts
    return bars.map((bar) => ({
      id: bar.id,
      name: bar.name,
      createdAt: bar.createdAt,
      myRole: bar.memberships[0].role,
      myVip: bar.memberships[0].vip,
    }));
```

with:

```ts
    return bars.map((bar) => ({
      id: bar.id,
      name: bar.name,
      createdAt: bar.createdAt,
      myRole: bar.memberships[0].role,
      myVip: bar.memberships[0].vip,
      isPublic: bar.isPublic,
      inviteToken: bar.memberships[0].role === 'OWNER' ? bar.inviteToken : null,
    }));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts -t "findMine"`
Expected: PASS.

- [ ] **Step 5: Run the full API test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit the API change**

```bash
git add api/src/bars/bars.service.ts api/src/bars/bars.service.spec.ts
git commit -m "feat(api): expose bar visibility and invite token via findMine"
```

- [ ] **Step 7: Add `guestMode` support to `BarDirectory.tsx`**

In `src/app/BarDirectory.tsx`, add the `Link` import and the `guestMode` prop:

Replace:

```tsx
"use client";

import { useState, useTransition } from "react";
import type { BarDirectoryEntry } from "@/lib/types";
import { requestToJoinBarAction } from "@/app/bar-actions";

export default function BarDirectory({ entries }: { entries: BarDirectoryEntry[] }) {
```

with:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { BarDirectoryEntry } from "@/lib/types";
import { requestToJoinBarAction } from "@/app/bar-actions";

export default function BarDirectory({
  entries,
  guestMode = false,
}: {
  entries: BarDirectoryEntry[];
  guestMode?: boolean;
}) {
```

Replace the `myStatus === "NONE"` branch:

```tsx
              {entry.myStatus === "NONE" && (
                <button
                  disabled={isPending && pendingId === entry.id}
                  onClick={() => handleRequest(entry.id)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors cursor-pointer"
                >
                  Demander à rejoindre
                </button>
              )}
```

with:

```tsx
              {entry.myStatus === "NONE" &&
                (guestMode ? (
                  <Link
                    href="/signup"
                    className="text-xs px-3 py-1.5 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors"
                  >
                    Créer un compte pour rejoindre
                  </Link>
                ) : (
                  <button
                    disabled={isPending && pendingId === entry.id}
                    onClick={() => handleRequest(entry.id)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors cursor-pointer"
                  >
                    Demander à rejoindre
                  </button>
                ))}
```

- [ ] **Step 8: Add the "Voir les bars sans compte" link to `/login`**

In `src/app/login/page.tsx`, replace:

```tsx
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

with:

```tsx
      <p className="text-center text-xs text-muted">
        Pas de compte ?{" "}
        <Link href="/signup" className="text-orange hover:underline">
          Créer un compte
        </Link>
      </p>
      <p className="text-center text-xs text-muted">
        <Link href="/decouvrir" className="text-orange hover:underline">
          Voir les bars sans compte
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 9: Create `src/app/decouvrir/page.tsx`**

```tsx
import { listBarsDirectory } from "@/lib/api-client";
import PageTransition from "@/components/PageTransition";
import BarDirectory from "@/app/BarDirectory";

export default async function DecouvrirPage() {
  const directory = await listBarsDirectory();

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Sans compte</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Découvrir les bars
        </h1>
      </div>

      <BarDirectory entries={directory} guestMode />
    </PageTransition>
  );
}
```

(No session check, no redirect — this page is intentionally reachable without any account, per the design. `listBarsDirectory()` now works unauthenticated since Task 4 made `GET /bars/directory` use `OptionalJwtAuthGuard`.)

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 11: Manual check**

With no session cookie (e.g. a private/incognito browser context, or `curl` without `-b`), visit `/bar/decouvrir` — confirm it renders the directory of public bars with "Créer un compte pour rejoindre" links instead of request buttons, and does **not** redirect to `/login`.

- [ ] **Step 12: Commit the frontend change**

```bash
git add src/app/BarDirectory.tsx src/app/login/page.tsx src/app/decouvrir
git commit -m "feat(web): add guest-accessible public bar directory"
```

---

### Task 7: Frontend — `/membres` public/private toggle + invite link section

**Files:**
- Create: `src/app/membres/BarVisibilitySection.tsx`
- Create: `src/app/membres/InviteLinkSection.tsx`
- Modify: `src/app/membres/page.tsx`
- Modify: `src/app/bar-actions.ts`

**Interfaces:**
- Consumes: `updateBarVisibility`, `generateInviteLink` (Task 5); `activeBar.isPublic`/`activeBar.inviteToken` (Task 6).
- Produces: Server Actions `setBarVisibilityAction(barId, isPublic)`, `generateInviteLinkAction(barId): Promise<{ inviteToken?: string; error?: string }>`.

- [ ] **Step 1: Add the two new Server Actions to `src/app/bar-actions.ts`**

Add after `respondToJoinRequestAction`:

```ts
export async function setBarVisibilityAction(barId: string, isPublic: boolean) {
  await requireSession();
  await api.updateBarVisibility(barId, isPublic);
  revalidatePath("/membres");
}

export async function generateInviteLinkAction(barId: string): Promise<{ inviteToken?: string; error?: string }> {
  await requireSession();
  try {
    const result = await api.generateInviteLink(barId);
    revalidatePath("/membres");
    return { inviteToken: result.inviteToken };
  } catch (err) {
    return { error: err instanceof api.ApiError ? err.message : "Erreur lors de la génération du lien" };
  }
}
```

- [ ] **Step 2: Create `BarVisibilitySection.tsx`**

```tsx
// src/app/membres/BarVisibilitySection.tsx
"use client";

import { useTransition } from "react";
import { setBarVisibilityAction } from "@/app/bar-actions";

export default function BarVisibilitySection({ barId, isPublic }: { barId: string; isPublic: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-3">
      <div>
        <h2 className="font-display text-xl text-cream">Visibilité du bar</h2>
        <p className="text-muted text-[11px] mt-0.5">
          {isPublic
            ? "Ce bar apparaît dans l'annuaire public et celui des comptes connectés."
            : "Ce bar est privé : invisible sauf invitation directe ou lien."}
        </p>
      </div>
      <label className="flex items-center gap-2.5 text-xs text-cream cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isPublic}
          disabled={isPending}
          onChange={(e) => startTransition(() => setBarVisibilityAction(barId, e.target.checked))}
          className="w-5 h-5 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-orange cursor-pointer"
        />
        <span className="font-medium">Bar public (visible dans l&apos;annuaire)</span>
      </label>
    </section>
  );
}
```

- [ ] **Step 3: Create `InviteLinkSection.tsx`**

```tsx
// src/app/membres/InviteLinkSection.tsx
"use client";

import { useState, useTransition } from "react";
import { generateInviteLinkAction } from "@/app/bar-actions";

export default function InviteLinkSection({ barId, inviteToken }: { barId: string; inviteToken: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState(inviteToken);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = token
    ? typeof window !== "undefined"
      ? `${window.location.origin}/rejoindre/${token}`
      : `/rejoindre/${token}`
    : null;

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateInviteLinkAction(barId);
      if (result.error) setError(result.error);
      else if (result.inviteToken) setToken(result.inviteToken);
    });
  };

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-3">
      <div>
        <h2 className="font-display text-xl text-cream">Lien d&apos;invitation</h2>
        <p className="text-muted text-[11px] mt-0.5">
          Toute personne avec ce lien peut rejoindre le bar, avec ou sans compte existant.
        </p>
      </div>
      {token ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link ?? ""}
            className="flex-1 bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs text-cream"
          />
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-2 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors cursor-pointer"
          >
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted/70 italic">Aucun lien généré pour le moment.</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        disabled={isPending}
        onClick={handleGenerate}
        className="text-xs px-3 py-2 rounded-xl bg-ink border border-white/[0.1] text-cream hover:border-orange/50 transition-colors cursor-pointer"
      >
        {token ? "Régénérer le lien" : "Générer un lien"}
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Update `src/app/membres/page.tsx`**

Replace:

```tsx
import InviteMemberForm from "./InviteMemberForm";
import MemberRow from "./MemberRow";
import PendingRequests from "./PendingRequests";
```

with:

```tsx
import InviteMemberForm from "./InviteMemberForm";
import MemberRow from "./MemberRow";
import PendingRequests from "./PendingRequests";
import BarVisibilitySection from "./BarVisibilitySection";
import InviteLinkSection from "./InviteLinkSection";
```

Replace:

```tsx
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 rounded-2xl bg-ink-2 border border-white/[0.08] p-6 shadow-xl">
          <InviteMemberForm barId={activeBar.id} />
        </div>

        <div className="lg:col-span-8 rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
          {members.map((member) => (
            <MemberRow key={member.id} barId={activeBar.id} member={member} />
          ))}
        </div>
      </div>
```

with:

```tsx
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl bg-ink-2 border border-white/[0.08] p-6 shadow-xl">
            <InviteMemberForm barId={activeBar.id} />
          </div>
          <BarVisibilitySection barId={activeBar.id} isPublic={activeBar.isPublic} />
          <InviteLinkSection barId={activeBar.id} inviteToken={activeBar.inviteToken} />
        </div>

        <div className="lg:col-span-8 rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
          {members.map((member) => (
            <MemberRow key={member.id} barId={activeBar.id} member={member} />
          ))}
        </div>
      </div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 6: Manual check**

As a bar owner, visit `/bar/membres`, confirm the two new cards appear below the invite form: toggling the visibility checkbox persists across a page reload, and generating an invite link shows a copyable URL that changes when "Régénérer le lien" is clicked.

- [ ] **Step 7: Commit**

```bash
git add src/app/membres src/app/bar-actions.ts
git commit -m "feat(web): add bar visibility toggle and invite link generation to /membres"
```

---

### Task 8: Frontend — `InviteMemberForm` search-based invite

**Files:**
- Modify: `src/app/membres/InviteMemberForm.tsx`
- Modify: `src/app/bar-actions.ts`

**Interfaces:**
- Consumes: `searchUsers` (Task 5).
- Produces: Server Action `searchUsersAction(query: string): Promise<UserSearchResult[]>`.

- [ ] **Step 1: Add `searchUsersAction` to `src/app/bar-actions.ts`**

Add after `generateInviteLinkAction` (from Task 7):

```ts
export async function searchUsersAction(query: string) {
  await requireSession();
  if (!query.trim()) return [];
  try {
    return await api.searchUsers(query);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Rewrite `InviteMemberForm.tsx`**

Replace the entire content of `src/app/membres/InviteMemberForm.tsx` with:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { inviteMemberAction, searchUsersAction } from "@/app/bar-actions";
import type { UserSearchResult } from "@/lib/types";

export default function InviteMemberForm({ barId }: { barId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [results, setResults] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    if (!query.trim() || selected) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchUsersAction(query).then(setResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, selected]);

  const handleSelect = (user: UserSearchResult) => {
    setSelected(user);
    setQuery(user.username);
    setResults([]);
  };

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-4">
      <div>
        <h2 className="font-display text-xl text-cream">Inviter un membre</h2>
        <p className="text-muted text-[11px] mt-0.5">Cherche parmi les comptes existants.</p>
      </div>
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await inviteMemberAction(barId, formData);
            if (result.error) {
              setError(result.error);
            } else {
              setQuery("");
              setSelected(null);
            }
          });
        }}
        className="space-y-3.5"
      >
        <div className="relative">
          <input
            name="username"
            required
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Chercher un identifiant"
            autoComplete="off"
            className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange transition-all text-cream"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-ink-2 border border-orange/20 rounded-xl overflow-hidden shadow-xl">
              {results.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  className="w-full text-left px-3 py-2 text-xs text-cream hover:bg-orange/10 transition-colors cursor-pointer"
                >
                  {user.username}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="vip" className="accent-gold" />
          Accès VIP sur ce bar
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-orange text-white font-medium rounded-xl py-2.5 hover:bg-orange-hover transition-all text-xs uppercase tracking-wider font-semibold"
        >
          Inviter
        </button>
      </form>
      {error && (
        <div className="text-xs bg-red-950/30 border border-red-500/30 rounded-xl p-3 text-red-300">{error}</div>
      )}
    </section>
  );
}
```

(The `username` field submitted on form submit is still whatever text is in the input — selecting a search result just fills that same input, so `inviteMemberAction` doesn't change at all.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 4: Manual check**

As a bar owner on `/bar/membres`, type a few characters of another account's username into the invite field, confirm a dropdown of matches appears after a brief pause, and selecting one fills the field and lets the existing "Inviter" submit work unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/membres/InviteMemberForm.tsx src/app/bar-actions.ts
git commit -m "feat(web): search existing accounts when inviting a bar member"
```

---

### Task 9: Frontend — `/rejoindre/[token]` page + `login`/`signup` wiring

**Files:**
- Create: `src/app/rejoindre/[token]/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`
- Modify: `src/app/bar-actions.ts`

**Interfaces:**
- Consumes: `previewInviteLink`, `joinViaInviteLink`, `joinViaInviteLinkWithToken` (Task 5).
- Produces: Server Action `joinViaInviteLinkAction(token: string)`; `signup()` accepts an optional `inviteToken` form field.

- [ ] **Step 1: Add `redirectTo` support to `/login`**

In `src/app/login/page.tsx`, replace:

```tsx
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
```

with:

```tsx
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;
```

Replace:

```tsx
      <form action={login} className="space-y-3">
        <input
          name="username"
```

with:

```tsx
      <form action={login} className="space-y-3">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/"} />
        <input
          name="username"
```

(The `login` Server Action in `src/app/login/actions.ts` already reads `formData.get("redirectTo")` with a `"/"` default — it was already written to support this, just never had a form field feeding it. No change needed there.)

- [ ] **Step 2: Add `inviteToken` support to `/signup`**

In `src/app/signup/page.tsx`, replace:

```tsx
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
```

with:

```tsx
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; inviteToken?: string }>;
}) {
  const { error, inviteToken } = await searchParams;
```

Replace:

```tsx
      <form action={signup} className="space-y-3">
        <input
          name="username"
```

with:

```tsx
      <form action={signup} className="space-y-3">
        {inviteToken && <input type="hidden" name="inviteToken" value={inviteToken} />}
        <input
          name="username"
```

- [ ] **Step 3: Update the `signup` Server Action**

In `src/app/bar-actions.ts`, replace:

```ts
export async function signup(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!username || password.length < 6 || password !== confirmPassword) {
    redirect("/signup?error=1");
  }

  const result = await api.apiSignup(username, password);
  if (!result) {
    redirect("/signup?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/creer");
}
```

with:

```ts
export async function signup(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const inviteToken = formData.get("inviteToken");

  if (!username || password.length < 6 || password !== confirmPassword) {
    redirect("/signup?error=1");
  }

  const result = await api.apiSignup(username, password);
  if (!result) {
    redirect("/signup?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  if (typeof inviteToken === "string" && inviteToken) {
    await api.joinViaInviteLinkWithToken(inviteToken, result.token);
    redirect("/");
  }

  redirect("/creer");
}
```

- [ ] **Step 4: Add `joinViaInviteLinkAction`**

In `src/app/bar-actions.ts`, add after `searchUsersAction` (from Task 8):

```ts
export async function joinViaInviteLinkAction(token: string) {
  await requireSession();
  await api.joinViaInviteLink(token);
}
```

- [ ] **Step 5: Create `src/app/rejoindre/[token]/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { previewInviteLink, ApiError } from "@/lib/api-client";
import { joinViaInviteLinkAction } from "@/app/bar-actions";
import PageTransition from "@/components/PageTransition";

export default async function RejoindreParLienPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let barName: string | null = null;
  try {
    const preview = await previewInviteLink(token);
    barName = preview.barName;
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err;
  }

  if (!barName) {
    return (
      <PageTransition className="max-w-sm mx-auto mt-16 text-center space-y-4">
        <h1 className="font-display text-2xl text-cream">Lien invalide</h1>
        <p className="text-sm text-muted">Ce lien d&apos;invitation n&apos;existe plus ou n&apos;est plus valide.</p>
        <Link href="/login" className="text-orange hover:underline text-sm">
          Retour à la connexion
        </Link>
      </PageTransition>
    );
  }

  const session = await getSession();
  if (session) {
    await joinViaInviteLinkAction(token);
    redirect("/");
  }

  return (
    <PageTransition className="max-w-sm mx-auto mt-16 bg-ink-2/40 border border-orange/10 p-8 rounded-xl box-orange-glow space-y-4 text-center">
      <h1 className="font-display text-2xl text-cream">Rejoindre {barName}</h1>
      <p className="text-sm text-muted">Connecte-toi ou crée un compte pour rejoindre ce bar.</p>
      <div className="flex flex-col gap-2">
        <Link
          href={`/login?redirectTo=/rejoindre/${token}`}
          className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Se connecter
        </Link>
        <Link
          href={`/signup?inviteToken=${token}`}
          className="w-full bg-ink border border-orange/15 text-cream font-medium rounded-xl py-3 hover:border-orange/40 transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Créer un compte
        </Link>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 7: Manual check**

Two scenarios, using a real invite link generated from Task 7's UI:

1. **Already logged in**: visit `/bar/rejoindre/<token>` while logged in as an account that isn't yet a member of that bar — confirm it joins immediately and redirects to `/`, and the bar now appears in that account's bar switcher.
2. **Not logged in, new account**: visit the same link logged out, click "Créer un compte", complete signup — confirm you land on `/` (not `/creer`) and are already a member of the invited bar. This is the step most worth double-checking manually: it depends on `joinViaInviteLinkWithToken` correctly using the just-issued token rather than any cookie timing assumption.

- [ ] **Step 8: Commit**

```bash
git add src/app/rejoindre src/app/login/page.tsx src/app/signup/page.tsx src/app/bar-actions.ts
git commit -m "feat(web): add invite-link landing page with login/signup wiring"
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

Using three accounts — `owner1` (owns a public bar, pre-existing), `owner2` (owns a newly-created bar, private by default), and `newcomer` (no bar):

1. Without any session, visit `/bar/login`, click "Voir les bars sans compte", confirm `/bar/decouvrir` shows `owner1`'s bar (public) but **not** `owner2`'s bar (private, just created).
2. As `owner2`, visit `/bar/membres`, toggle the bar to public — confirm it now appears in `/bar/decouvrir` for a logged-out visitor, and in the logged-in directory too.
3. Toggle it back to private — confirm it disappears from both, and confirm `POST /bars/:id/join-requests` against that bar's id now returns a 403 even from a logged-in account that isn't a member (this closes the loophole the final review of the previous feature didn't need to consider, since privacy didn't exist yet).
4. As `owner1`, generate an invite link from `/bar/membres`, copy it.
5. As `newcomer` (logged out), open the invite link, click "Créer un compte", complete signup — confirm landing on `/` already a member of `owner1`'s bar, without visiting `/creer`.
6. Generate a second invite link scenario: as a fourth, already-logged-in test account (not yet a member), open `owner1`'s invite link directly — confirm immediate join + redirect to `/`, no signup/login prompt shown.
7. As `owner1`, use the rewritten invite form on `/bar/membres` to search for `newcomer` by partial username — confirm the dropdown appears and selecting it correctly invites them via the existing (unchanged) `inviteMemberAction` path.
8. Regenerate `owner1`'s invite link — confirm the old link (from step 4) no longer works (404 / "Lien invalide").

- [ ] **Step 4: Clean up test data**

Remove any test accounts/bars/tokens created for this walkthrough (direct SQL against the Postgres container, or leave them if the user prefers — ask before deleting anything).

- [ ] **Step 5: Commit (only if the walkthrough surfaced fixes)**

No-op if the walkthrough passed clean — the feature is already fully committed task-by-task.
