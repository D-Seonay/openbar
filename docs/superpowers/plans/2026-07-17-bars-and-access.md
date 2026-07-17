# Bars & accès (phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any signed-up user create their own bar and control, by username, who else has access to it — without changing how the existing global stock/cocktails/soirées pages behave (that's phase 2, a separate plan).

**Architecture:** New Prisma `Bar`/`BarMembership` models (additive, no FK from existing tables). New NestJS `bars/` module (service + controller) following the exact pattern of the existing `recipes/` module. Public `POST /auth/signup` added to the existing `auth/` module, reusing `UsersService.create`. On the frontend, a `bardenoa_active_bar` cookie (separate from the JWT session cookie) tracks which bar is "active" for the current browser session, read by a small `resolveActiveBar` helper and switched via a header dropdown.

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL (API), Next.js 16 App Router + Server Actions (frontend), Jest (API unit tests only — the frontend has no test runner, verify via `npx tsc --noEmit -p .` and manual browser testing).

## Global Constraints

- Follow the existing module pattern exactly: `module.ts` / `controller.ts` / `service.ts` / `dto/*.ts`, controller thin (delegates to service), no `@nestjs` decorators duplicating validation the DTO already does (see `api/src/recipes/`).
- Global `ValidationPipe({ whitelist: true, transform: true })` is already registered in `api/src/main.ts` — DTOs are the only validation layer needed, no manual checks in controllers.
- No new npm dependencies. Everything needed (`class-validator`, `@nestjs/*`, `jose`, Prisma) is already installed.
- French user-facing strings and exception messages, matching the rest of the codebase (see `recipes.service.ts`, `users.service.ts`).
- The frontend has no test framework — verify frontend tasks with `npx tsc --noEmit -p .` from the repo root, plus the manual browser pass in Task 10.
- This phase must not change the behavior of `/stock`, `/cocktails`, or `/soirees` — do not touch `Bottle`, `Recipe`, `Event`, `Contribution`, or `StockAdjustment` models, services, or pages.
- Read `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` before writing any new Server Action — this Next.js version's action/security model differs from older training data (already summarized in Task 6-9 code below, but re-check if unsure).
- `next.config.ts` sets `basePath: "/bar"`. Every route path written in code — `redirect(...)`, `<Link href=...>`, folder names under `src/app/` — is the **logical** path and must NOT include `/bar`; Next.js prepends it automatically. Only real browser URLs (typed in the address bar, or `curl` against the frontend) need the `/bar` prefix. This is also why the new pages in Tasks 6-9 live at `src/app/creer` and `src/app/membres`, not `src/app/bar/...` — a literal `bar` route segment would double up with the basePath and produce broken `/bar/bar/...` URLs.

---

### Task 1: Prisma schema — Bar & BarMembership models + migration

**Files:**
- Modify: `api/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `Bar { id, name, createdAt, memberships }`, `BarMembership { id, barId, userId, role: BarRole, vip, createdAt }` with `@@unique([barId, userId])` (accessible in code as the compound key `barId_userId`), enum `BarRole { OWNER, MEMBER }`. `User` gains `barMemberships BarMembership[]`.

- [ ] **Step 1: Add the enum and models to the schema**

Add after the existing `RecipeDifficulty` enum in `api/prisma/schema.prisma`:

```prisma
enum BarRole {
  OWNER
  MEMBER
}
```

Add at the end of the file:

```prisma
model Bar {
  id          String          @id @default(cuid())
  name        String
  createdAt   DateTime        @default(now())
  memberships BarMembership[]
}

model BarMembership {
  id        String   @id @default(cuid())
  barId     String
  bar       Bar      @relation(fields: [barId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      BarRole
  vip       Boolean  @default(false)
  createdAt DateTime @default(now())

  @@unique([barId, userId])
}
```

Add `barMemberships BarMembership[]` to the `User` model, alongside the existing `recipes Recipe[]` line.

- [ ] **Step 2: Validate the schema**

Run: `cd api && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Generate and apply the migration**

Run: `cd api && npx prisma migrate dev --name add_bar_model`
Expected: `Your database is now in sync with your schema.` and a new folder under `api/prisma/migrations/`.

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `cd api && npm test`
Expected: all existing suites still pass (same count as before this change).

- [ ] **Step 5: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add Bar and BarMembership models"
```

---

### Task 2: Auth — public signup endpoint

**Files:**
- Create: `api/src/auth/dto/signup.dto.ts`
- Modify: `api/src/auth/auth.service.ts`
- Modify: `api/src/auth/auth.controller.ts`
- Test: `api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `UsersService.create(input: { username: string; password: string; role?: Role; vip?: boolean })` (existing, returns `{ id, username, role, vip, createdAt }`, throws `ConflictException` on duplicate username).
- Produces: `AuthService.signup(username: string, password: string): Promise<{ token: string; user: { id, username, role, vip } }>` — same return shape as the existing `login()`. `POST /auth/signup` (public, no guard), sets the `bardenoa_session` cookie exactly like `POST /auth/login`.

- [ ] **Step 1: Write the failing test for `AuthService.signup`**

Add to `api/src/auth/auth.service.spec.ts`, inside the existing `describe('AuthService', ...)` block, alongside the existing `beforeEach`. First update the mock so `usersService` also has a `create` mock:

```ts
usersService = { findByUsername: jest.fn(), create: jest.fn() };
```

Then add these tests after the existing three:

```ts
  it('creates a new account and returns a signed token on signup', async () => {
    usersService.create.mockResolvedValue({
      id: '2',
      username: 'newuser',
      role: 'USER',
      vip: false,
    });

    const result = await service.signup('newuser', 'secret123');

    expect(usersService.create).toHaveBeenCalledWith({ username: 'newuser', password: 'secret123' });
    expect(result.token).toBe('signed.jwt.token');
    expect(result.user).toEqual({ id: '2', username: 'newuser', role: 'USER', vip: false });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd api && npx jest auth/auth.service.spec.ts -t "creates a new account"`
Expected: FAIL — `service.signup is not a function`.

- [ ] **Step 3: Create the signup DTO**

```ts
// api/src/auth/dto/signup.dto.ts
import { IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

- [ ] **Step 4: Refactor `AuthService` to add `signup`, sharing token-issuing logic with `login`**

Replace the full contents of `api/src/auth/auth.service.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: 'ADMIN' | 'USER';
  vip: boolean;
}

interface AuthenticatedUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'USER';
  vip: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private async validateUser(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Identifiants invalides');
    return user;
  }

  private issueToken(user: AuthenticatedUser) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      vip: user.vip,
    };
    return {
      token: this.jwtService.sign(payload),
      user: { id: user.id, username: user.username, role: user.role, vip: user.vip },
    };
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    return this.issueToken(user);
  }

  async signup(username: string, password: string) {
    const user = await this.usersService.create({ username, password });
    return this.issueToken(user);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd api && npx jest auth/auth.service.spec.ts`
Expected: PASS, all 4 tests (3 existing + 1 new).

- [ ] **Step 6: Add the `POST /auth/signup` controller route**

Replace the full contents of `api/src/auth/auth.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { SESSION_COOKIE } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setSessionCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  @Post('signup')
  @HttpCode(200)
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.signup(dto.username, dto.password);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.login(dto.username, dto.password);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE);
    return { success: true };
  }
}
```

- [ ] **Step 7: Run the full API test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 8: Commit**

```bash
git add api/src/auth
git commit -m "feat(api): add public signup endpoint"
```

---

### Task 3: BarsService — core membership logic + tests

**Files:**
- Create: `api/src/bars/dto/create-bar.dto.ts`
- Create: `api/src/bars/dto/invite-member.dto.ts`
- Create: `api/src/bars/dto/update-member.dto.ts`
- Create: `api/src/bars/bars.service.ts`
- Test: `api/src/bars/bars.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`prisma.bar`, `prisma.barMembership` — Prisma Client models generated in Task 1), `UsersService.findByUsername(username): Promise<User | null>` (existing).
- Produces (used by Task 4's controller):
  - `BarsService.create(name: string, userId: string): Promise<Bar & { memberships: BarMembership[] }>`
  - `BarsService.findMine(userId: string): Promise<Array<{ id: string; name: string; createdAt: Date; myRole: 'OWNER'|'MEMBER'; myVip: boolean }>>`
  - `BarsService.findMembers(barId: string, userId: string): Promise<Array<BarMembership & { user: { username: string } }>>`
  - `BarsService.inviteMember(barId: string, requesterId: string, username: string, vip: boolean): Promise<BarMembership & { user: { username: string } }>`
  - `BarsService.updateMemberVip(barId: string, requesterId: string, membershipId: string, vip: boolean): Promise<BarMembership & { user: { username: string } }>`
  - `BarsService.removeMember(barId: string, requesterId: string, membershipId: string): Promise<{ success: true }>`

- [ ] **Step 1: Write the DTOs**

```ts
// api/src/bars/dto/create-bar.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreateBarDto {
  @IsString()
  @MinLength(1)
  name: string;
}
```

```ts
// api/src/bars/dto/invite-member.dto.ts
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class InviteMemberDto {
  @IsString()
  username: string;

  @IsOptional()
  @IsBoolean()
  vip?: boolean;
}
```

```ts
// api/src/bars/dto/update-member.dto.ts
import { IsBoolean } from 'class-validator';

export class UpdateMemberDto {
  @IsBoolean()
  vip: boolean;
}
```

- [ ] **Step 2: Write the failing test file**

```ts
// api/src/bars/bars.service.spec.ts
import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BarsService } from './bars.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

describe('BarsService', () => {
  let service: BarsService;
  let prisma: {
    bar: Record<string, jest.Mock>;
    barMembership: Record<string, jest.Mock>;
  };
  let usersService: { findByUsername: jest.Mock };

  const OWNER_ID = 'owner-1';
  const OTHER_ID = 'other-1';
  const BAR_ID = 'bar-1';

  beforeEach(async () => {
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
    usersService = { findByUsername: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BarsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(BarsService);
  });

  describe('create', () => {
    it('creates a bar with an OWNER membership for the creator', async () => {
      prisma.barMembership.findFirst.mockResolvedValue(null);
      prisma.bar.create.mockResolvedValue({ id: BAR_ID, name: 'Chez Noa', memberships: [] });

      await service.create('Chez Noa', OWNER_ID);

      expect(prisma.barMembership.findFirst).toHaveBeenCalledWith({
        where: { userId: OWNER_ID, role: 'OWNER' },
      });
      expect(prisma.bar.create).toHaveBeenCalledWith({
        data: {
          name: 'Chez Noa',
          memberships: { create: { userId: OWNER_ID, role: 'OWNER', vip: true } },
        },
        include: { memberships: true },
      });
    });

    it('rejects if the user already owns a bar', async () => {
      prisma.barMembership.findFirst.mockResolvedValue({ id: 'm1', role: 'OWNER' });

      await expect(service.create('Second bar', OWNER_ID)).rejects.toThrow(ConflictException);
      expect(prisma.bar.create).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
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
        { id: BAR_ID, name: 'Chez Noa', createdAt: new Date('2026-01-01'), myRole: 'OWNER', myVip: true },
      ]);
    });
  });

  describe('findMembers', () => {
    it('throws NotFoundException if the bar does not exist', async () => {
      prisma.bar.findUnique.mockResolvedValue(null);

      await expect(service.findMembers(BAR_ID, OWNER_ID)).rejects.toThrow(NotFoundException);
    });

    it('forbids a non-member from viewing the roster', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue(null);

      await expect(service.findMembers(BAR_ID, OTHER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('returns the roster for a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      prisma.barMembership.findMany.mockResolvedValue([{ id: 'm1', role: 'OWNER', user: { username: 'noa' } }]);

      const result = await service.findMembers(BAR_ID, OWNER_ID);

      expect(result).toEqual([{ id: 'm1', role: 'OWNER', user: { username: 'noa' } }]);
    });
  });

  describe('inviteMember', () => {
    it('forbids a non-owner from inviting', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.inviteMember(BAR_ID, OTHER_ID, 'bob', false)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for an unknown username', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'OWNER' });
      usersService.findByUsername.mockResolvedValue(null);

      await expect(service.inviteMember(BAR_ID, OWNER_ID, 'ghost', false)).rejects.toThrow(NotFoundException);
    });

    it('rejects if the target is already a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER' });
      usersService.findByUsername.mockResolvedValue({ id: OTHER_ID, username: 'bob' });

      await expect(service.inviteMember(BAR_ID, OWNER_ID, 'bob', false)).rejects.toThrow(ConflictException);
    });

    it('creates a MEMBER membership for the target user', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce(null);
      usersService.findByUsername.mockResolvedValue({ id: OTHER_ID, username: 'bob' });
      prisma.barMembership.create.mockResolvedValue({ id: 'm2', role: 'MEMBER', vip: true, user: { username: 'bob' } });

      const result = await service.inviteMember(BAR_ID, OWNER_ID, 'bob', true);

      expect(prisma.barMembership.create).toHaveBeenCalledWith({
        data: { barId: BAR_ID, userId: OTHER_ID, role: 'MEMBER', vip: true },
        include: { user: { select: { username: true } } },
      });
      expect(result).toEqual({ id: 'm2', role: 'MEMBER', vip: true, user: { username: 'bob' } });
    });
  });

  describe('updateMemberVip', () => {
    it('forbids a non-owner from updating VIP status', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValue({ id: 'm1', role: 'MEMBER' });

      await expect(service.updateMemberVip(BAR_ID, OTHER_ID, 'm2', true)).rejects.toThrow(ForbiddenException);
    });

    it('refuses to change the OWNER membership', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce({ id: 'm1', barId: BAR_ID, role: 'OWNER' });

      await expect(service.updateMemberVip(BAR_ID, OWNER_ID, 'm1', false)).rejects.toThrow(ForbiddenException);
    });

    it('updates the vip flag for a member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER' })
        .mockResolvedValueOnce({ id: 'm2', barId: BAR_ID, role: 'MEMBER' });
      prisma.barMembership.update.mockResolvedValue({ id: 'm2', role: 'MEMBER', vip: true, user: { username: 'bob' } });

      const result = await service.updateMemberVip(BAR_ID, OWNER_ID, 'm2', true);

      expect(prisma.barMembership.update).toHaveBeenCalledWith({
        where: { id: 'm2' },
        data: { vip: true },
        include: { user: { select: { username: true } } },
      });
      expect(result.vip).toBe(true);
    });
  });

  describe('removeMember', () => {
    it('refuses to remove the OWNER membership', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique.mockResolvedValueOnce({ id: 'm1', barId: BAR_ID, role: 'OWNER', userId: OWNER_ID });

      await expect(service.removeMember(BAR_ID, OWNER_ID, 'm1')).rejects.toThrow(ForbiddenException);
    });

    it('allows the owner to remove another member', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm2', barId: BAR_ID, role: 'MEMBER', userId: OTHER_ID })
        .mockResolvedValueOnce({ id: 'm1', role: 'OWNER', userId: OWNER_ID });
      prisma.barMembership.delete.mockResolvedValue({ id: 'm2' });

      const result = await service.removeMember(BAR_ID, OWNER_ID, 'm2');

      expect(result).toEqual({ success: true });
      expect(prisma.barMembership.delete).toHaveBeenCalledWith({ where: { id: 'm2' } });
    });

    it('allows a member to remove themselves', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm2', barId: BAR_ID, role: 'MEMBER', userId: OTHER_ID })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER', userId: OTHER_ID });
      prisma.barMembership.delete.mockResolvedValue({ id: 'm2' });

      const result = await service.removeMember(BAR_ID, OTHER_ID, 'm2');

      expect(result).toEqual({ success: true });
    });

    it('forbids a non-owner from removing someone else', async () => {
      prisma.bar.findUnique.mockResolvedValue({ id: BAR_ID });
      prisma.barMembership.findUnique
        .mockResolvedValueOnce({ id: 'm3', barId: BAR_ID, role: 'MEMBER', userId: 'third-user' })
        .mockResolvedValueOnce({ id: 'm2', role: 'MEMBER', userId: OTHER_ID });

      await expect(service.removeMember(BAR_ID, OTHER_ID, 'm3')).rejects.toThrow(ForbiddenException);
      expect(prisma.barMembership.delete).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: FAIL — `Cannot find module './bars.service'`.

- [ ] **Step 4: Implement `BarsService`**

```ts
// api/src/bars/bars.service.ts
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const MEMBER_INCLUDE = { user: { select: { username: true } } } as const;

@Injectable()
export class BarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(name: string, userId: string) {
    const existingOwnership = await this.prisma.barMembership.findFirst({
      where: { userId, role: 'OWNER' },
    });
    if (existingOwnership) {
      throw new ConflictException('Vous possédez déjà un bar');
    }

    return this.prisma.bar.create({
      data: {
        name,
        memberships: { create: { userId, role: 'OWNER', vip: true } },
      },
      include: { memberships: true },
    });
  }

  async findMine(userId: string) {
    const bars = await this.prisma.bar.findMany({
      where: { memberships: { some: { userId } } },
      include: { memberships: { where: { userId } } },
      orderBy: { name: 'asc' },
    });

    return bars.map((bar) => ({
      id: bar.id,
      name: bar.name,
      createdAt: bar.createdAt,
      myRole: bar.memberships[0].role,
      myVip: bar.memberships[0].vip,
    }));
  }

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

  async inviteMember(barId: string, requesterId: string, username: string, vip: boolean) {
    await this.assertOwner(barId, requesterId);

    const target = await this.usersService.findByUsername(username);
    if (!target) throw new NotFoundException('Utilisateur introuvable');

    const existing = await this.getMembership(barId, target.id);
    if (existing) throw new ConflictException('Cette personne a déjà accès à ce bar');

    return this.prisma.barMembership.create({
      data: { barId, userId: target.id, role: 'MEMBER', vip },
      include: MEMBER_INCLUDE,
    });
  }

  async updateMemberVip(barId: string, requesterId: string, membershipId: string, vip: boolean) {
    await this.assertOwner(barId, requesterId);

    const membership = await this.prisma.barMembership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.barId !== barId) throw new NotFoundException('Membre introuvable');
    if (membership.role === 'OWNER') {
      throw new ForbiddenException('Impossible de modifier le statut du propriétaire');
    }

    return this.prisma.barMembership.update({
      where: { id: membershipId },
      data: { vip },
      include: MEMBER_INCLUDE,
    });
  }

  async removeMember(barId: string, requesterId: string, membershipId: string) {
    await this.getBar(barId);

    const membership = await this.prisma.barMembership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.barId !== barId) throw new NotFoundException('Membre introuvable');
    if (membership.role === 'OWNER') {
      throw new ForbiddenException('Impossible de retirer le propriétaire du bar');
    }

    const requesterMembership = await this.getMembership(barId, requesterId);
    const isOwner = requesterMembership?.role === 'OWNER';
    const isSelf = membership.userId === requesterId;
    if (!isOwner && !isSelf) {
      throw new ForbiddenException('Vous ne pouvez retirer que vous-même, ou être le propriétaire du bar');
    }

    await this.prisma.barMembership.delete({ where: { id: membershipId } });
    return { success: true as const };
  }

  private async getBar(barId: string) {
    const bar = await this.prisma.bar.findUnique({ where: { id: barId } });
    if (!bar) throw new NotFoundException('Bar introuvable');
    return bar;
  }

  private getMembership(barId: string, userId: string) {
    return this.prisma.barMembership.findUnique({ where: { barId_userId: { barId, userId } } });
  }

  private async assertOwner(barId: string, userId: string) {
    await this.getBar(barId);
    const membership = await this.getMembership(barId, userId);
    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException('Seul le propriétaire du bar peut effectuer cette action');
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: PASS, all tests green.

- [ ] **Step 6: Run the full API test suite**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add api/src/bars
git commit -m "feat(api): add BarsService with membership permission logic"
```

---

### Task 4: BarsController + BarsModule + wiring

**Files:**
- Create: `api/src/bars/bars.controller.ts`
- Create: `api/src/bars/bars.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `BarsService` (Task 3), `JwtAuthGuard` (existing, `api/src/auth/jwt-auth.guard.ts`), `JwtPayload` (existing, `api/src/auth/auth.service.ts`).
- Produces: routes `POST /bars`, `GET /bars/mine`, `GET /bars/:id/members`, `POST /bars/:id/members`, `PATCH /bars/:id/members/:membershipId`, `DELETE /bars/:id/members/:membershipId`, all behind `JwtAuthGuard`.

This task has no dedicated controller test file — the existing codebase doesn't unit-test controllers (see `recipes.controller.ts`, `bottles.controller.ts`), only services. Verify via the full test suite (no regressions) and the manual pass in Task 10.

- [ ] **Step 1: Write `BarsController`**

```ts
// api/src/bars/bars.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarsService } from './bars.service';
import { CreateBarDto } from './dto/create-bar.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@UseGuards(JwtAuthGuard)
@Controller('bars')
export class BarsController {
  constructor(private readonly barsService: BarsService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateBarDto) {
    const user = req.user as JwtPayload;
    return this.barsService.create(dto.name, user.sub);
  }

  @Get('mine')
  findMine(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.barsService.findMine(user.sub);
  }

  @Get(':id/members')
  findMembers(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    return this.barsService.findMembers(id, user.sub);
  }

  @Post(':id/members')
  inviteMember(@Req() req: Request, @Param('id') id: string, @Body() dto: InviteMemberDto) {
    const user = req.user as JwtPayload;
    return this.barsService.inviteMember(id, user.sub, dto.username, dto.vip ?? false);
  }

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

  @Delete(':id/members/:membershipId')
  removeMember(@Req() req: Request, @Param('id') id: string, @Param('membershipId') membershipId: string) {
    const user = req.user as JwtPayload;
    return this.barsService.removeMember(id, user.sub, membershipId);
  }
}
```

- [ ] **Step 2: Write `BarsModule`**

```ts
// api/src/bars/bars.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BarsService } from './bars.service';
import { BarsController } from './bars.controller';

@Module({
  imports: [UsersModule],
  controllers: [BarsController],
  providers: [BarsService],
  exports: [BarsService],
})
export class BarsModule {}
```

- [ ] **Step 3: Register `BarsModule` in `AppModule`**

In `api/src/app.module.ts`, add the import:

```ts
import { BarsModule } from './bars/bars.module';
```

And add `BarsModule` to the `imports` array (after `RecipesModule`).

- [ ] **Step 4: Run the full API test suite**

Run: `cd api && npm test`
Expected: all suites pass, no regressions.

- [ ] **Step 5: Start the API and manually smoke-test the routes**

Run: `docker compose up -d` then, from the repo root:

```bash
curl -s -X POST http://localhost:3001/auth/signup -H 'Content-Type: application/json' \
  -d '{"username":"smoketest1","password":"secret123"}' -c /tmp/cookies.txt -i | head -1
curl -s -X POST http://localhost:3001/bars -H 'Content-Type: application/json' \
  -b /tmp/cookies.txt -d '{"name":"Test Bar"}'
curl -s http://localhost:3001/bars/mine -b /tmp/cookies.txt
```

Expected: signup returns `200`, the bar is created with an `id`/`name`, and `/bars/mine` returns an array containing that bar with `"myRole":"OWNER"`.

- [ ] **Step 6: Commit**

```bash
git add api/src/bars api/src/app.module.ts
git commit -m "feat(api): wire up BarsController and BarsModule"
```

---

### Task 5: Frontend types & api-client — Bar/BarMember, signup, bars endpoints

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api-client.ts`
- Create: `src/lib/active-bar.ts`

**Interfaces:**
- Produces:
  - Types `Bar { id, name, createdAt, myRole: "OWNER"|"MEMBER", myVip: boolean }` and `BarMember { id, barId, userId, role: "OWNER"|"MEMBER", vip, createdAt, user: { username } }` in `src/lib/types.ts`.
  - `apiSignup(username, password): Promise<{ token: string } | null>`, `listMyBars(): Promise<Bar[]>`, `createBar(name): Promise<{ id: string; name: string }>`, `listBarMembers(barId): Promise<BarMember[]>`, `inviteBarMember(barId, username, vip): Promise<BarMember>`, `updateBarMemberVip(barId, membershipId, vip): Promise<BarMember>`, `removeBarMember(barId, membershipId): Promise<{ success: boolean }>` in `src/lib/api-client.ts`.
  - `resolveActiveBar(bars: Bar[]): Promise<Bar | null>` and `ACTIVE_BAR_COOKIE` constant in `src/lib/active-bar.ts`.

No test framework exists for the frontend; verification is `npx tsc --noEmit -p .` at the end of this task.

- [ ] **Step 1: Add `Bar` and `BarMember` types**

Add to `src/lib/types.ts`:

```ts
export interface Bar {
  id: string;
  name: string;
  createdAt: string;
  myRole: "OWNER" | "MEMBER";
  myVip: boolean;
}

export interface BarMember {
  id: string;
  barId: string;
  userId: string;
  role: "OWNER" | "MEMBER";
  vip: boolean;
  createdAt: string;
  user: { username: string };
}
```

- [ ] **Step 2: Add `apiSignup` and the bars functions to `api-client.ts`**

In `src/lib/api-client.ts`, add the import:

```ts
import type { Bar, BarMember } from "./types";
```

(merge into the existing `import type { Bottle, EventItem, Contribution, StockAdjustment, AccountUser } from "./types";` line instead of a second import statement.)

Add `apiSignup` right after `apiLogin`:

```ts
export async function apiSignup(
  username: string,
  password: string,
): Promise<{ token: string } | null> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const setCookie = res.headers.get("set-cookie");
  const match = setCookie?.match(/bardenoa_session=([^;]+)/);
  if (!match) return null;

  return { token: match[1] };
}
```

Add at the end of the file:

```ts
// Bars
export function listMyBars(): Promise<Bar[]> {
  return request<Bar[]>("/bars/mine");
}

export function createBar(name: string): Promise<{ id: string; name: string }> {
  return request("/bars", { method: "POST", body: JSON.stringify({ name }) });
}

export function listBarMembers(barId: string): Promise<BarMember[]> {
  return request<BarMember[]>(`/bars/${barId}/members`);
}

export function inviteBarMember(barId: string, username: string, vip: boolean): Promise<BarMember> {
  return request<BarMember>(`/bars/${barId}/members`, {
    method: "POST",
    body: JSON.stringify({ username, vip }),
  });
}

export function updateBarMemberVip(barId: string, membershipId: string, vip: boolean): Promise<BarMember> {
  return request<BarMember>(`/bars/${barId}/members/${membershipId}`, {
    method: "PATCH",
    body: JSON.stringify({ vip }),
  });
}

export function removeBarMember(barId: string, membershipId: string): Promise<{ success: boolean }> {
  return request(`/bars/${barId}/members/${membershipId}`, { method: "DELETE" });
}
```

- [ ] **Step 3: Create the active-bar resolver**

```ts
// src/lib/active-bar.ts
import { cookies } from "next/headers";
import type { Bar } from "./types";

export const ACTIVE_BAR_COOKIE = "bardenoa_active_bar";

export async function resolveActiveBar(bars: Bar[]): Promise<Bar | null> {
  if (bars.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BAR_COOKIE)?.value;
  const active = bars.find((bar) => bar.id === activeId);
  if (active) return active;

  return bars.find((bar) => bar.myRole === "OWNER") ?? bars[0];
}
```

- [ ] **Step 4: Type-check the frontend**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/api-client.ts src/lib/active-bar.ts
git commit -m "feat(web): add Bar/BarMember types and bars api-client functions"
```

---

### Task 6: Signup page

**Files:**
- Create: `src/app/bar-actions.ts`
- Create: `src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `apiSignup` (Task 5), `SESSION_COOKIE` (existing, `src/lib/session.ts`).
- Produces: exported Server Action `signup(formData: FormData)` in `src/app/bar-actions.ts` (this file will also hold the other bar-related actions added in Tasks 7-9), page at `/signup`.

- [ ] **Step 1: Create the `bar/actions.ts` file with `signup`**

```ts
// src/app/bar-actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as api from "@/lib/api-client";
import { SESSION_COOKIE } from "@/lib/session";

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

- [ ] **Step 2: Create the signup page**

```tsx
// src/app/signup/page.tsx
import Link from "next/link";
import { signup } from "@/app/bar-actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-16 bg-ink-2/40 border border-orange/10 p-8 rounded-xl box-orange-glow space-y-4">
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Nouveau compte</span>
        <h1 className="font-display text-3xl text-cream mt-1">Rejoindre Bardenoa</h1>
      </div>
      <form action={signup} className="space-y-3">
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
          placeholder="Mot de passe (6 caractères min.)"
          required
          minLength={6}
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirmer le mot de passe"
          required
          minLength={6}
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        {error && (
          <p className="text-xs text-red-400 text-center">Inscription impossible. Vérifie tes informations.</p>
        )}
        <button
          type="submit"
          className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Créer mon compte
        </button>
      </form>
      <p className="text-center text-xs text-muted">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-orange hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, visit `http://localhost:3000/bar/signup` (the app has `basePath: "/bar"` in `next.config.ts` — every URL typed directly in the browser needs that prefix; internal `redirect()`/`Link` calls in the code must NOT include it, Next.js adds it automatically), submit a new username/password. Expected: redirected towards `/bar/creer` (404 is fine for now — that page is Task 7) and a `bardenoa_session` cookie is set.

- [ ] **Step 5: Commit**

```bash
git add src/app/bar-actions.ts src/app/signup
git commit -m "feat(web): add public signup page"
```

---

### Task 7: Bar creation page

**Files:**
- Modify: `src/app/bar-actions.ts`
- Create: `src/app/creer/page.tsx`

**Interfaces:**
- Consumes: `listMyBars`, `createBar` (Task 5), `getSession` (existing, `src/lib/session.ts`).
- Produces: exported Server Action `createBarAction(formData: FormData)`, page at `/creer`.

- [ ] **Step 1: Add `createBarAction` to `src/app/bar-actions.ts`**

Add these to the top of the file (needed by the new action):

```ts
import { getSession } from "@/lib/session";
```

Add this helper and action to the file:

```ts
async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function createBarAction(formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/creer?error=1");

  await api.createBar(name);
  redirect("/");
}
```

- [ ] **Step 2: Create the bar-creation page**

```tsx
// src/app/creer/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listMyBars } from "@/lib/api-client";
import { createBarAction } from "@/app/bar-actions";

export default async function NewBarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  if (bars.some((bar) => bar.myRole === "OWNER")) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-16 bg-ink-2/40 border border-orange/10 p-8 rounded-xl box-orange-glow space-y-4">
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Bienvenue</span>
        <h1 className="font-display text-3xl text-cream mt-1">Crée ton bar</h1>
      </div>
      <form action={createBarAction} className="space-y-3">
        <input
          name="name"
          type="text"
          placeholder="Nom du bar"
          required
          autoFocus
          className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-2.5 text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
        {error && <p className="text-xs text-red-400 text-center">Nom requis.</p>}
        <button
          type="submit"
          className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Créer mon bar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Manual check**

With the dev server running, sign up a fresh account at `http://localhost:3000/bar/signup` (or reuse the Task 6 test account), get redirected to `/bar/creer`, submit a name, confirm redirect to `/bar` and no error. Visiting `/bar/creer` again while owning a bar should redirect to `/bar`.

- [ ] **Step 5: Commit**

```bash
git add src/app/bar-actions.ts src/app/creer
git commit -m "feat(web): add bar creation page"
```

---

### Task 8: Bar switcher in the header

**Files:**
- Modify: `src/app/bar-actions.ts`
- Create: `src/components/BarSwitcher.tsx`
- Modify: `src/components/Navigation.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `resolveActiveBar`, `listMyBars` (Task 5), `getSession` (existing).
- Produces: exported Server Action `switchBarAction(barId: string)`, `<BarSwitcher bars={Bar[]} activeBarId={string} />` client component, `Navigation` gains an optional `isBarOwner?: boolean` prop.

- [ ] **Step 1: Add `switchBarAction` to `src/app/bar-actions.ts`**

Add this import:

```ts
import { revalidatePath } from "next/cache";
import { ACTIVE_BAR_COOKIE } from "@/lib/active-bar";
```

Add this action:

```ts
export async function switchBarAction(barId: string) {
  await requireSession();
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BAR_COOKIE, barId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  revalidatePath("/");
}
```

- [ ] **Step 2: Create `BarSwitcher`**

```tsx
// src/components/BarSwitcher.tsx
"use client";

import { useTransition } from "react";
import type { Bar } from "@/lib/types";
import { switchBarAction } from "@/app/bar-actions";

export default function BarSwitcher({ bars, activeBarId }: { bars: Bar[]; activeBarId: string }) {
  const [isPending, startTransition] = useTransition();

  if (bars.length <= 1) return null;

  return (
    <select
      value={activeBarId}
      disabled={isPending}
      onChange={(e) => startTransition(() => switchBarAction(e.target.value))}
      className="bg-ink border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-cream focus:outline-none focus:border-orange transition-all cursor-pointer"
    >
      {bars.map((bar) => (
        <option key={bar.id} value={bar.id}>
          {bar.name}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Add the "Membres" nav link for bar owners**

Replace the full contents of `src/components/Navigation.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminBadge from "./AdminBadge";

const NAV = [
  { href: "/stock", label: "Cave & Stock" },
  { href: "/cocktails", label: "Cocktails" },
  { href: "/soirees", label: "Soirées" },
];

const ADMIN_NAV = [{ href: "/comptes", label: "Comptes" }];
const OWNER_NAV = [{ href: "/membres", label: "Membres" }];

function navLink(item: { href: string; label: string }, pathname: string) {
  const isActive = pathname.startsWith(item.href);
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

      <div className="pl-2 border-l border-white/[0.1] ml-1 flex items-center">
        <AdminBadge isAdmin={isAdmin} />
      </div>
    </nav>
  );
}
```

(This is a refactor to a shared `navLink` helper — same rendering, no visual change — plus the new `isBarOwner`/`OWNER_NAV` branch.)

- [ ] **Step 4: Wire it into the layout**

In `src/app/layout.tsx`, replace the `isAdminLoggedIn` import and usage. Replace:

```tsx
import { isAdminLoggedIn } from "@/lib/session";
import Navigation from "@/components/Navigation";
```

with:

```tsx
import { getSession } from "@/lib/session";
import { listMyBars } from "@/lib/api-client";
import { resolveActiveBar } from "@/lib/active-bar";
import Navigation from "@/components/Navigation";
import BarSwitcher from "@/components/BarSwitcher";
```

Replace:

```tsx
  const isAdmin = await isAdminLoggedIn();
```

with:

```tsx
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";
  const bars = session ? await listMyBars() : [];
  const activeBar = session ? await resolveActiveBar(bars) : null;
```

Replace the header's nav slot:

```tsx
            <Navigation isAdmin={isAdmin} />
```

with:

```tsx
            <div className="flex items-center gap-3">
              {session && !activeBar && (
                <Link
                  href="/creer"
                  className="text-xs font-semibold uppercase tracking-wider text-orange hover:text-orange-hover transition-colors"
                >
                  Crée ton bar
                </Link>
              )}
              {activeBar && bars.length > 1 && <BarSwitcher bars={bars} activeBarId={activeBar.id} />}
              <Navigation isAdmin={isAdmin} isBarOwner={activeBar?.myRole === "OWNER"} />
            </div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Manual check**

With two test accounts (create a second via `/bar/signup`, invite it to the first account's bar — this needs Task 9's invite UI, so if Task 9 isn't done yet, invite via `curl` against `POST /bars/:id/members` as in Task 4's smoke test), confirm the switcher dropdown appears once a user has access to 2+ bars, and selecting a different one persists across a page reload.

- [ ] **Step 7: Commit**

```bash
git add src/app/bar-actions.ts src/components/BarSwitcher.tsx src/components/Navigation.tsx src/app/layout.tsx
git commit -m "feat(web): add bar switcher to the header"
```

---

### Task 9: Members management page

**Files:**
- Modify: `src/app/bar-actions.ts`
- Create: `src/app/membres/page.tsx`
- Create: `src/app/membres/InviteMemberForm.tsx`
- Create: `src/app/membres/MemberRow.tsx`

**Interfaces:**
- Consumes: `listBarMembers`, `inviteBarMember`, `updateBarMemberVip`, `removeBarMember` (Task 5), `resolveActiveBar`, `listMyBars` (Task 5/8), `getSession` (existing), `ApiError` (existing, exported from `src/lib/api-client.ts`).
- Produces: exported Server Actions `inviteMemberAction`, `toggleMemberVipAction`, `removeMemberAction`; page at `/membres`.

- [ ] **Step 1: Add the member actions to `src/app/bar-actions.ts`**

Add these:

```ts
export async function inviteMemberAction(barId: string, formData: FormData): Promise<{ error?: string }> {
  await requireSession();
  const username = String(formData.get("username") ?? "").trim();
  const vip = formData.get("vip") === "on";
  if (!username) return { error: "Nom d'utilisateur requis" };

  try {
    await api.inviteBarMember(barId, username, vip);
    revalidatePath("/membres");
    return {};
  } catch (err) {
    return { error: err instanceof api.ApiError ? err.message : "Erreur lors de l'invitation" };
  }
}

export async function toggleMemberVipAction(barId: string, membershipId: string, vip: boolean) {
  await requireSession();
  await api.updateBarMemberVip(barId, membershipId, vip);
  revalidatePath("/membres");
}

export async function removeMemberAction(barId: string, membershipId: string): Promise<{ error?: string }> {
  await requireSession();
  try {
    await api.removeBarMember(barId, membershipId);
    revalidatePath("/membres");
    return {};
  } catch (err) {
    return { error: err instanceof api.ApiError ? err.message : "Erreur lors de la révocation" };
  }
}
```

- [ ] **Step 2: Create `InviteMemberForm`**

```tsx
// src/app/membres/InviteMemberForm.tsx
"use client";

import { useState, useTransition } from "react";
import { inviteMemberAction } from "@/app/bar-actions";

export default function InviteMemberForm({ barId }: { barId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-4">
      <div>
        <h2 className="font-display text-xl text-cream">Inviter un membre</h2>
        <p className="text-muted text-[11px] mt-0.5">Par identifiant d&apos;un compte existant.</p>
      </div>
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await inviteMemberAction(barId, formData);
            if (result.error) setError(result.error);
          });
        }}
        className="space-y-3.5"
      >
        <input
          name="username"
          required
          placeholder="Identifiant"
          className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange transition-all text-cream"
        />
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

- [ ] **Step 3: Create `MemberRow`**

```tsx
// src/app/membres/MemberRow.tsx
"use client";

import { useState, useTransition } from "react";
import type { BarMember } from "@/lib/types";
import { toggleMemberVipAction, removeMemberAction } from "@/app/bar-actions";

export default function MemberRow({ barId, member }: { barId: string; member: BarMember }) {
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-ink-2 transition-colors">
      <div className="flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-ink border border-white/[0.08] flex items-center justify-center font-display text-sm font-bold text-gold">
          {member.user.username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-sm text-cream">{member.user.username}</span>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white/[0.05] text-muted">
              {member.role === "OWNER" ? "Propriétaire" : "Membre"}
            </span>
            {member.vip && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gold text-ink shadow-sm">
                VIP
              </span>
            )}
          </div>
          {deleteError && <p className="text-xs text-red-400 mt-1">{deleteError}</p>}
        </div>
      </div>

      {member.role !== "OWNER" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            disabled={isPending}
            onClick={() => startTransition(() => toggleMemberVipAction(barId, member.id, !member.vip))}
            className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer font-semibold ${
              member.vip
                ? "bg-gold/15 border-gold/40 text-gold hover:bg-gold/25"
                : "bg-ink border-white/[0.08] text-muted hover:text-gold"
            }`}
          >
            {member.vip ? "Retirer accès VIP" : "Accorder VIP"}
          </button>
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setDeleteError(null);
                const result = await removeMemberAction(barId, member.id);
                if (result.error) setDeleteError(result.error);
              })
            }
            className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors cursor-pointer"
          >
            Révoquer
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the members page**

```tsx
// src/app/membres/page.tsx
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
        <div className="lg:col-span-4 rounded-2xl bg-ink-2 border border-white/[0.08] p-6 shadow-xl">
          <InviteMemberForm barId={activeBar.id} />
        </div>

        <div className="lg:col-span-8 rounded-2xl bg-ink-2/60 border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] shadow-xl">
          {members.map((member) => (
            <MemberRow key={member.id} barId={activeBar.id} member={member} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Manual check**

As the bar owner, visit `/bar/membres`, invite a second existing account by username, confirm it appears in the list, toggle its VIP badge, then revoke it and confirm it disappears. Confirm a non-owner visiting `/bar/membres` gets redirected to `/bar`.

- [ ] **Step 7: Commit**

```bash
git add src/app/bar-actions.ts src/app/membres
git commit -m "feat(web): add bar members management page"
```

---

### Task 10: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full API test suite one more time**

Run: `cd api && npm test`
Expected: all suites pass.

- [ ] **Step 2: Type-check the whole frontend**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Full manual walkthrough in the browser**

Using the running dev stack (`docker compose up -d` for the API/DB, `npm run dev` for the frontend). Remember the app runs under `basePath: "/bar"` — every URL below needs that prefix in the actual browser address bar (e.g. `http://localhost:3000/bar/signup`):

1. Sign up as `owner1` at `/bar/signup` → redirected to `/bar/creer` → create "Bar de owner1" → redirected to `/bar`.
2. Log out, sign up as `member1` → redirected to `/bar/creer` (this account has no bar yet, but should still be able to reach `/bar/stock`, `/bar/cocktails`, `/bar/soirees` without issue — phase 1 must not gate those pages).
3. Log back in as `owner1`, go to `/bar/membres`, invite `member1` (leave VIP unchecked), confirm the row appears.
4. Log in as `member1`: the header should now show a bar switcher (or at least the bar should appear as accessible — if `member1` still has no owned bar, `/bar/creer` should no longer force-redirect since they now have access via membership; confirm `resolveActiveBar` picks "Bar de owner1" for them). `/bar/membres` should redirect `member1` to `/bar` (not the owner).
5. As `owner1`, toggle VIP on for `member1`'s membership, then revoke `member1` entirely; confirm the row disappears and, back as `member1`, the bar no longer appears in their bar list.
6. Confirm `/bar/stock`, `/bar/cocktails`, `/bar/soirees` look and behave identically to before this feature for both accounts (no bar-based filtering — that's phase 2).

- [ ] **Step 4: Clean up test accounts**

Remove the manual test accounts/bars created above (via direct SQL against the Postgres container, or leave them if the user prefers — ask before deleting anything).

- [ ] **Step 5: Final commit (if any cleanup changed tracked files)**

Only if Step 4 touched tracked files; otherwise this step is a no-op — the feature is already fully committed task-by-task.
