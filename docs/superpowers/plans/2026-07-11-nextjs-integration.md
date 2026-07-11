# Next.js Integration + Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing Next.js app onto the NestJS + Postgres API (built in Plan 1), replacing the admin-password/VIP-vault-password/localStorage-name mechanisms with the new account system, and ship a 3-service Docker Compose deployment for the home server.

**Architecture:** The Next.js app keeps its current page structure and design; every Server Component/Action that currently reads `data/store.json` via `src/lib/db.ts` instead calls a new `src/lib/api-client.ts`, which forwards the session cookie to the NestJS API running as a sibling Docker service. Three of Plan 1's controllers (Bottles, Events, Cocktails) are revised to split public reads from admin-only writes, since the real app keeps most pages publicly readable. Auth state in Next.js is derived by verifying the shared-secret JWT directly (via `jose`, Edge-compatible) rather than calling the API on every request.

**Tech Stack:** Next.js 16 (unchanged), `jose` for JWT verification in Next.js (Edge-compatible, unlike `jsonwebtoken`), the existing NestJS API from Plan 1, Docker Compose for the 3-service deployment.

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-11-nextjs-integration-design.md`, and the Plan 1 spec `docs/superpowers/specs/2026-07-10-nestjs-postgres-backend-design.md` for context on what already exists.
- Keep the current read-model exactly as it is today: dashboard (`/`), `/cocktails`, `/stock`, `/soirees` (list) are publicly readable without login. Only mutations (bottle/event CRUD, bilan submit, contributions) and the `/soirees/[slug]/bilan` route require a session; contributions require ANY authenticated role, admin mutations require the `ADMIN` role.
- VIP reserve (stock + cocktails) is visible to: any `ADMIN`, OR any account with `vip: true`. This replaces the `v-i-p` keyboard-sequence vault password and the per-event `vipNames` list — both are being deleted, not kept as a fallback.
- `Event.vipNames` and `Contribution.guestName` no longer exist (Plan 1's Prisma schema already dropped them) — every remaining Next.js reference to these fields must be removed, not stubbed.
- No functional changes beyond the migration itself: page layouts, styling, and copy stay as they are except where a field (vipNames, guestName, VIP password) is being removed because its underlying data no longer exists.
- Do not touch anything under `api/src/` beyond the specific files each task lists — Plan 1's modules are done and reviewed; this plan only adds an `OptionalJwtAuthGuard`, revises 3 controllers' guard placement, and adds a password-reset field to `UsersService`.
- Session cookie name is `bardenoa_session` (matches Plan 1's `SESSION_COOKIE` constant in `api/src/auth/jwt.strategy.ts`) — the Next.js side must use the identical name so the same cookie set by `POST /auth/login` is read by both `proxy.ts` and any Server Component checking the session.
- `JwtPayload` shape (from Plan 1): `{ sub: string; username: string; role: 'ADMIN' | 'USER'; vip: boolean }`.

---

### Task 1: API — `OptionalJwtAuthGuard` + public `GET /bottles` with VIP filtering

**Files:**
- Create: `api/src/auth/optional-jwt-auth.guard.ts`
- Create: `api/src/auth/vip.util.ts`
- Modify: `api/src/bottles/bottles.service.ts`
- Modify: `api/src/bottles/bottles.controller.ts`
- Modify: `api/src/cocktails/cocktails.service.ts` (only the `findAll()` call site, no guard change yet — that's Task 2)
- Test: `api/src/bottles/bottles.service.spec.ts` (new — this service had no dedicated tests yet; add one covering the new `includeVip` filter)

**Interfaces:**
- Produces: `OptionalJwtAuthGuard`, importable from `../auth/optional-jwt-auth.guard`, consumed by Tasks 2 and 3 (Cocktails and Events controllers).
- Produces: `canSeeVip(user?: JwtPayload): boolean`, importable from `../auth/vip.util`, consumed by Task 2's `CocktailsController` — kept in the shared `auth/` module rather than inside `BottlesController`'s file, since two unrelated controllers depend on it.
- Produces: `BottlesService.findAll(includeVip: boolean)` — the `includeVip` parameter is now required (not optional with a default), so every existing call site must be updated in the same commit. Known call sites: `BottlesController.findAll`, `CocktailsService.evaluate()`.

- [ ] **Step 1: Create `OptionalJwtAuthGuard`**

Create `api/src/auth/optional-jwt-auth.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: unknown, user: unknown) {
    return user || undefined;
  }
}
```

- [ ] **Step 1b: Create the shared `canSeeVip` helper**

Create `api/src/auth/vip.util.ts`:

```ts
import type { JwtPayload } from './auth.service';

export function canSeeVip(user?: JwtPayload): boolean {
  return user?.role === 'ADMIN' || user?.vip === true;
}
```

- [ ] **Step 2: Write the failing test for `includeVip` filtering**

Create `api/src/bottles/bottles.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { BottlesService } from './bottles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BottlesService', () => {
  let service: BottlesService;
  let prisma: { bottle: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { bottle: { findMany: jest.fn().mockResolvedValue([]) } };

    const moduleRef = await Test.createTestingModule({
      providers: [BottlesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(BottlesService);
  });

  it('excludes VIP bottles from the query when includeVip is false', async () => {
    await service.findAll(false);

    expect(prisma.bottle.findMany).toHaveBeenCalledWith({
      where: { vip: false },
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
  });

  it('does not filter by vip when includeVip is true', async () => {
    await service.findAll(true);

    expect(prisma.bottle.findMany).toHaveBeenCalledWith({
      where: undefined,
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd api && npx jest bottles.service --no-coverage
```

Expected: FAIL — `findAll` doesn't accept a parameter yet, or the `where` clause doesn't match.

- [ ] **Step 4: Update `BottlesService.findAll`**

In `api/src/bottles/bottles.service.ts`, replace:

```ts
  findAll() {
    return this.prisma.bottle.findMany({ include: { volumes: true }, orderBy: { name: 'asc' } });
  }
```

with:

```ts
  findAll(includeVip: boolean) {
    return this.prisma.bottle.findMany({
      where: includeVip ? undefined : { vip: false },
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
  }
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd api && npx jest bottles.service --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 6: Update `BottlesController` to split read/write guards**

Replace the full content of `api/src/bottles/bottles.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { canSeeVip } from '../auth/vip.util';
import { BottlesService } from './bottles.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';

@Controller('bottles')
export class BottlesController {
  constructor(private readonly bottlesService: BottlesService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@Req() req: Request) {
    return this.bottlesService.findAll(canSeeVip(req.user as JwtPayload | undefined));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bottlesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateBottleDto) {
    return this.bottlesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBottleDto) {
    return this.bottlesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bottlesService.remove(id);
  }
}
```

- [ ] **Step 7: Update `CocktailsService.evaluate()`'s call to `findAll`**

In `api/src/cocktails/cocktails.service.ts`, this call site now fails to compile since `findAll` requires an argument. Change:

```ts
  async evaluate(): Promise<RecipeAvailability[]> {
    const bottles = await this.bottlesService.findAll();
    return evaluateRecipes(bottles);
  }
```

to (temporarily hardcode `true` here — Task 2 replaces this with a real parameter):

```ts
  async evaluate(): Promise<RecipeAvailability[]> {
    const bottles = await this.bottlesService.findAll(true);
    return evaluateRecipes(bottles);
  }
```

- [ ] **Step 8: Run the full test suite and verify the app boots**

```bash
cd api && npm test
docker compose up -d postgres
npm run start:dev
```

Expected: all test suites pass; startup log shows `Mapped {/bottles, GET} route` with no guard-related errors; stop the dev server with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
cd api
git add src/auth/optional-jwt-auth.guard.ts src/bottles src/cocktails/cocktails.service.ts
git commit -m "feat(api): make GET /bottles public, filtering VIP bottles by role/vip"
```

---

### Task 2: API — public `GET /cocktails` with VIP filtering

**Files:**
- Modify: `api/src/cocktails/cocktails.service.ts`
- Modify: `api/src/cocktails/cocktails.controller.ts`
- Test: `api/src/cocktails/cocktails.service.spec.ts` (add 2 cases to the existing file)

**Interfaces:**
- Consumes: `OptionalJwtAuthGuard` (Task 1), `canSeeVip` (exported from `../auth/vip.util` in Task 1).
- Produces: `CocktailsService.evaluate(includeVip: boolean)` — required parameter, replacing the hardcoded `true` from Task 1 Step 7.

- [ ] **Step 1: Write the failing tests for VIP-excluded evaluation**

Add to `api/src/cocktails/cocktails.service.spec.ts` (append inside the existing `describe('evaluateRecipes', ...)` block, after the last existing `it(...)`):

```ts
  it('excludes VIP bottles entirely when includeVip is false, so missingTags stays consistent with makeable', () => {
    const bottles = [
      bottle({ tags: ['whisky'], vip: true }),
      bottle({ tags: ['cola'] }),
    ];
    const nonVipOnly = bottles.filter((b) => !b.vip);
    const results = evaluateRecipes(nonVipOnly);
    const whiskyCoca = results.find((r) => r.recipe.id === 'whisky-coca')!;
    expect(whiskyCoca.makeable).toBe(false);
    expect(whiskyCoca.usesVip).toBe(false);
    expect(whiskyCoca.missingTags).toEqual(['whisky']);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd api && npx jest cocktails.service --no-coverage
```

Expected: this specific test should already PASS against the existing pure `evaluateRecipes` function (it doesn't need new logic — the test documents the filtering contract that `CocktailsService.evaluate` must uphold by filtering its input). Confirm it passes as-is; if it doesn't, `evaluateRecipes` itself has a bug outside this task's scope — stop and report NEEDS_CONTEXT rather than modifying `evaluateRecipes`.

- [ ] **Step 3: Update `CocktailsService.evaluate`**

Replace in `api/src/cocktails/cocktails.service.ts`:

```ts
  async evaluate(): Promise<RecipeAvailability[]> {
    const bottles = await this.bottlesService.findAll(true);
    return evaluateRecipes(bottles);
  }
```

with:

```ts
  async evaluate(includeVip: boolean): Promise<RecipeAvailability[]> {
    const bottles = await this.bottlesService.findAll(includeVip);
    return evaluateRecipes(bottles);
  }
```

- [ ] **Step 4: Update `CocktailsController`**

Replace the full content of `api/src/cocktails/cocktails.controller.ts`:

```ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { canSeeVip } from '../auth/vip.util';
import { CocktailsService } from './cocktails.service';

@Controller('cocktails')
export class CocktailsController {
  constructor(private readonly cocktailsService: CocktailsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  evaluate(@Req() req: Request) {
    return this.cocktailsService.evaluate(canSeeVip(req.user as JwtPayload | undefined));
  }
}
```

- [ ] **Step 5: Update `CocktailsModule` to import `BottlesModule`'s exported `BottlesController`-adjacent helper**

No module change is actually needed here — `canSeeVip` is a plain function import from the shared `auth/` module, not a DI provider, so `api/src/cocktails/cocktails.module.ts` needs no edit for this.

- [ ] **Step 6: Run the full test suite**

```bash
cd api && npm test
```

Expected: all suites pass, including the new test from Step 1.

- [ ] **Step 7: Verify the app boots**

```bash
docker compose up -d postgres
cd api && npm run start:dev
```

Expected: `Mapped {/cocktails, GET} route`, no errors. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
cd api
git add src/cocktails
git commit -m "feat(api): make GET /cocktails public, filtering VIP-only recipes by role/vip"
```

---

### Task 3: API — public `GET /events` + new `GET /events/:slug`

**Files:**
- Modify: `api/src/events/events.controller.ts`

**Interfaces:**
- Consumes: `OptionalJwtAuthGuard` (Task 1), `EventsService.findAll()` and `EventsService.findBySlug(slug)` (both already exist from Plan 1 Task 8 — `findBySlug` already throws `NotFoundException` on a missing slug, which Nest automatically turns into a 404 response).
- Produces: `GET /events/:slug`, a route that did not exist before this task — needed by the Next.js event detail page and bilan page (Task 13/13 of this plan) to fetch a single event by slug over HTTP (previously only used via direct service injection by `ContributionsService`/`StockAdjustmentsService`).

- [ ] **Step 1: Update `EventsController`**

Replace the full content of `api/src/events/events.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.eventsService.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.eventsService.remove(slug);
  }
}
```

Note: `@Get(':slug')` must be declared after `@Get()` (the list route) in the same controller — Nest matches routes in declaration order, and a bare `@Get()` (no param) never conflicts with `@Get(':slug')` regardless of order, but keep this order for readability since it mirrors the file's existing convention.

- [ ] **Step 2: Verify the app boots and both GET routes are registered**

```bash
docker compose up -d postgres
cd api && npm run start:dev
```

Expected: startup log shows both `Mapped {/events, GET} route` and `Mapped {/events/:slug, GET} route`. Stop with Ctrl+C.

- [ ] **Step 3: Manual verification that GET /events/:slug returns 404 for an unknown slug**

```bash
curl -i http://localhost:3001/events/does-not-exist
```

Expected: `404` with a JSON body containing `"message":"Soirée introuvable"` (from `EventsService.findBySlug`'s existing `NotFoundException`).

- [ ] **Step 4: Run the full test suite**

```bash
cd api && npm test
```

Expected: all suites still pass (no test changes needed for this task — `EventsService` itself is untouched, only the controller's routing).

- [ ] **Step 5: Commit**

```bash
cd api
git add src/events/events.controller.ts
git commit -m "feat(api): make GET /events and GET /events/:slug public, add slug lookup route"
```

---

### Task 4: API — admin password reset on `PATCH /users/:id`

**Files:**
- Modify: `api/src/users/dto/update-user.dto.ts`
- Modify: `api/src/users/users.service.ts`
- Test: `api/src/users/users.service.spec.ts` (add 1 case)

**Interfaces:**
- Produces: `UpdateUserDto.password?: string` and `UsersService.update(id, { role?, vip?, password? })` — the password, if present, is hashed before the Prisma write. Consumed by the Next.js `/comptes` admin page (Task 14 of this plan).

- [ ] **Step 1: Write the failing test**

Add to `api/src/users/users.service.spec.ts` (append a new `it(...)` inside the existing `describe('UsersService', ...)` block):

```ts
  it('hashes a new password when updating a user with one', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1', username: 'noa' });
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: '1', username: 'noa', role: 'USER', vip: false, createdAt: new Date(), ...data }),
    );

    await service.update('1', { password: 'newsecret123' });

    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.data.password).toBeUndefined();
    expect(updateArgs.data.passwordHash).toBeDefined();
    expect(updateArgs.data.passwordHash).not.toBe('newsecret123');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd api && npx jest users.service --no-coverage
```

Expected: FAIL — `update()` currently passes `input` straight through as `data`, so `data.password` would be `'newsecret123'` (defined) and `data.passwordHash` would be `undefined`, failing both assertions (and Prisma has no `password` column, so this would also fail at the database level in real use — the test catches the bug at the unit level instead).

- [ ] **Step 3: Update `UpdateUserDto`**

Replace the full content of `api/src/users/dto/update-user.dto.ts`:

```ts
import { IsBoolean, IsEnum, IsOptional, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  vip?: boolean;

  @IsOptional()
  @MinLength(6)
  password?: string;
}
```

- [ ] **Step 4: Update `UsersService.update`**

Replace in `api/src/users/users.service.ts`:

```ts
  async update(id: string, input: { role?: Role; vip?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.prisma.user.update({ where: { id }, data: input, select: PUBLIC_SELECT });
  }
```

with:

```ts
  async update(id: string, input: { role?: Role; vip?: boolean; password?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const { password, ...rest } = input;
    const data: { role?: Role; vip?: boolean; passwordHash?: string } = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    return this.prisma.user.update({ where: { id }, data, select: PUBLIC_SELECT });
  }
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd api && npx jest users.service --no-coverage
```

Expected: PASS (all `UsersService` tests, including the new one).

- [ ] **Step 6: Run the full test suite**

```bash
cd api && npm test
```

Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
cd api
git add src/users
git commit -m "feat(api): allow admin to reset a user's password via PATCH /users/:id"
```

---

### Task 5: Next.js — `src/lib/types.ts` update + `src/lib/session.ts` (replaces `src/lib/auth.ts`)

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/session.ts`
- Delete: `src/lib/auth.ts`, `src/lib/auth.test.ts`
- Modify: `package.json` (add `jose` dependency)

**Interfaces:**
- Produces: `SessionUser` interface (`{ sub, username, role, vip }`), `SESSION_COOKIE` constant (`'bardenoa_session'`), `getSession(): Promise<SessionUser | null>`, `isAdminLoggedIn(): Promise<boolean>` — consumed by every later task that touches a page or Server Action (Tasks 8 through 14).
- `types.ts`'s `EventItem` drops `vipNames`; `Contribution` drops `guestName`, gains `user: { id: string; username: string }`.

- [ ] **Step 1: Install `jose`**

```bash
npm install jose
```

Verify `package.json`'s `dependencies` now includes `"jose"` at whatever version was installed.

- [ ] **Step 2: Update `src/lib/types.ts`**

Replace the full content of `src/lib/types.ts`:

```ts
export type BottleType =
  | "whisky"
  | "rhum"
  | "vodka"
  | "gin"
  | "tequila"
  | "liqueur"
  | "vin"
  | "champagne"
  | "biere"
  | "mixer"
  | "autre";

export interface BottleVolume {
  size: string; // e.g. "70cl", "1L", "1.5L"
  quantity: number; // count of bottles of this size
}

export interface Bottle {
  id: string;
  name: string;
  type: BottleType;
  quantity: number; // Total sum of quantities
  tags: string[];
  vip: boolean;
  notes?: string;
  lowStockThreshold?: number;
  createdAt: string;
  volumes?: BottleVolume[];
  imageUrl?: string;
}

export interface EventItem {
  id: string;
  slug: string;
  name: string;
  date: string;
  createdAt: string;
}

export interface ContributionUser {
  id: string;
  username: string;
}

export interface Contribution {
  id: string;
  eventId: string;
  user: ContributionUser;
  item: string;
  quantity?: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  eventId: string;
  bottleId: string;
  bottleName: string;
  quantityBefore: number;
  quantityAfter: number;
  createdAt: string;
}

export interface AccountUser {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
  vip: boolean;
  createdAt: string;
}
```

- [ ] **Step 3: Delete the old auth module and its test**

```bash
rm src/lib/auth.ts src/lib/auth.test.ts
```

- [ ] **Step 4: Create `src/lib/session.ts`**

Create `src/lib/session.ts`:

```ts
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const SESSION_COOKIE = "bardenoa_session";

export interface SessionUser {
  sub: string;
  username: string;
  role: "ADMIN" | "USER";
  vip: boolean;
}

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me");
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function isAdminLoggedIn(): Promise<boolean> {
  const session = await getSession();
  return session?.role === "ADMIN";
}
```

- [ ] **Step 5: Verify nothing else references the deleted `src/lib/auth.ts` yet**

```bash
grep -rn "@/lib/auth" src/
```

Expected: several matches (in `src/app/layout.tsx`, `src/app/actions.ts`, `src/app/stock/page.tsx`, `src/proxy.ts`, `src/app/login/actions.ts`) — these are expected and will be fixed in Tasks 6, 7, 8, 9. Do not fix them in this task; just confirm the list matches those 5 files (later tasks touch each in turn).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/session.ts package.json package-lock.json
git rm src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: add session module (JWT verification via jose), update shared types"
```

Note: this commit intentionally leaves the codebase non-building (5 files still import the deleted `@/lib/auth`) — Tasks 6-9 fix each in turn. This is acceptable because Task 6 is dispatched immediately after and the working tree is never left in this state at the end of a review cycle; if you are executing this plan with review gates between tasks, mention this in your task report so the reviewer knows the build is expected to be broken until Task 9 lands.

---

### Task 6: Next.js — `src/proxy.ts` + login page/actions (real username+password)

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/app/login/actions.ts`
- Modify: `src/app/login/page.tsx`
- Create: `src/lib/api-client.ts` (only the `login` function and the shared `request` helper — the rest of `api-client.ts` is built out in Task 7)

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `verifySessionToken` from `src/lib/session.ts` (Task 5).
- Produces: `apiLogin(username, password): Promise<{ token: string } | null>` in `src/lib/api-client.ts`, consumed only by `src/app/login/actions.ts` in this task (the rest of Task 7's functions are additive to the same file).

- [ ] **Step 1: Read the current login page to preserve its layout**

```bash
cat src/app/login/page.tsx
```

Note its current structure (single password field, error query param) before editing — you are changing the form fields, not the visual design/copy framing.

- [ ] **Step 2: Create `src/lib/api-client.ts` with the login helper**

Create `src/lib/api-client.ts`:

```ts
const API_URL = process.env.NEST_API_URL ?? "http://localhost:3001";

export async function apiLogin(
  username: string,
  password: string,
): Promise<{ token: string } | null> {
  const res = await fetch(`${API_URL}/auth/login`, {
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

- [ ] **Step 3: Update `src/app/login/actions.ts`**

Replace the full content of `src/app/login/actions.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiLogin } from "@/lib/api-client";
import { SESSION_COOKIE } from "@/lib/session";

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!username || !password) {
    redirect("/login?error=1");
  }

  const result = await apiLogin(username, password);
  if (!result) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect(redirectTo);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
```

- [ ] **Step 4: Update `src/app/login/page.tsx`**

Read the existing file first (`cat src/app/login/page.tsx`) to match its exact visual structure (classNames, wrapper divs, error message copy). Modify only the `<form>` contents: replace the single password `<input name="password">` with two inputs — `<input name="username" placeholder="Identifiant" ...>` (same styling classes as the current password input) followed by the existing password input, both inside the same `<form action={login}>`. Keep the existing error-state rendering (`searchParams.error` check) and submit button unchanged. Do not add a "forgot password" link or any new UI beyond the username field — that's out of scope for this task.

- [ ] **Step 5: Update `src/proxy.ts`**

Replace the full content of `src/proxy.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.endsWith("/bilan")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (session?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
```

- [ ] **Step 6: Verify `jose`'s `jwtVerify` works in the Edge runtime used by `proxy.ts`**

```bash
npm run build
```

Expected: build succeeds with no runtime-incompatibility warnings about `src/proxy.ts` (Next.js reports at build time if middleware/proxy code uses a Node-only API `jose` is specifically chosen to avoid this, unlike `jsonwebtoken`). If the build reports an incompatibility, stop and report BLOCKED — do not swap in `jsonwebtoken` for `proxy.ts`, since that would silently break in the Edge runtime at request time instead of at build time.

- [ ] **Step 7: Manually verify the login page renders both fields**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/login | grep -o 'name="username"'
kill %1
```

Expected: one match (`name="username"`), confirming the new field is present in the rendered HTML.

- [ ] **Step 8: Commit**

```bash
git add src/proxy.ts src/app/login src/lib/api-client.ts
git commit -m "feat: real username+password login against the NestJS API"
```

---

### Task 7: Next.js — `src/lib/api-client.ts` (full resource surface)

**Files:**
- Modify: `src/lib/api-client.ts` (extends the file from Task 6 with every remaining resource function)

**Interfaces:**
- Produces every function consumed by Tasks 8-14: `listBottles`, `addBottle`, `updateBottle`, `deleteBottle`, `listEvents`, `getEvent`, `createEvent`, `deleteEvent`, `listContributions`, `addContribution`, `deleteContribution`, `listStockAdjustments`, `applyStockAdjustments`, `evaluateCocktails`, `listUsers`, `createUser`, `updateUser`, `deleteUser`.
- Consumes: `SESSION_COOKIE` from `src/lib/session.ts` (Task 5), the `Bottle`/`BottleVolume`/`EventItem`/`Contribution`/`StockAdjustment`/`AccountUser` types from `src/lib/types.ts` (Task 5).

- [ ] **Step 1: Add the shared authenticated-request helper**

Append to `src/lib/api-client.ts` (after the existing `API_URL` constant and `apiLogin` function from Task 6):

```ts
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session";
import type {
  Bottle,
  BottleVolume,
  BottleType,
  EventItem,
  Contribution,
  StockAdjustment,
  AccountUser,
} from "./types";
import type { RecipeAvailability } from "./cocktail-types";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? `Erreur API (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export { ApiError };
```

- [ ] **Step 2: Create `src/lib/cocktail-types.ts`**

The API's `GET /cocktails` response mirrors the `RecipeAvailability`/`CocktailRecipe` shapes from Plan 1's `api/src/cocktails/cocktails.data.ts` and `cocktails.service.ts`. Create a lightweight mirror (do not import across the `api/`/`web` boundary — the two projects are independent, per Plan 1's architecture decision):

```ts
export interface CocktailRecipe {
  id: string;
  name: string;
  glass?: string;
  tags: string[];
  ingredientsList: string[];
  instructions: string[];
  prepTime: string;
  difficulty: "Facile" | "Moyen" | "Expert";
  description: string;
}

export interface RecipeAvailability {
  recipe: CocktailRecipe;
  makeable: boolean;
  usesVip: boolean;
  missingTags: string[];
}
```

- [ ] **Step 3: Add the Bottles functions**

Append to `src/lib/api-client.ts`:

```ts
export function listBottles(): Promise<Bottle[]> {
  return request<Bottle[]>("/bottles");
}

export function addBottle(
  input: Omit<Bottle, "id" | "createdAt">,
): Promise<Bottle> {
  return request<Bottle>("/bottles", { method: "POST", body: JSON.stringify(input) });
}

export function updateBottle(
  id: string,
  input: Partial<Omit<Bottle, "id" | "createdAt">>,
): Promise<Bottle> {
  return request<Bottle>(`/bottles/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteBottle(id: string): Promise<{ success: boolean }> {
  return request(`/bottles/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 4: Add the Events functions**

Append to `src/lib/api-client.ts`:

```ts
export function listEvents(): Promise<EventItem[]> {
  return request<EventItem[]>("/events");
}

export async function getEvent(slug: string): Promise<EventItem | null> {
  try {
    return await request<EventItem>(`/events/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function createEvent(input: { name: string; date: string }): Promise<EventItem> {
  return request<EventItem>("/events", { method: "POST", body: JSON.stringify(input) });
}

export function deleteEvent(slug: string): Promise<{ success: boolean }> {
  return request(`/events/${slug}`, { method: "DELETE" });
}
```

- [ ] **Step 5: Add the Contributions functions**

Append to `src/lib/api-client.ts`:

```ts
export function listContributions(slug: string): Promise<Contribution[]> {
  return request<Contribution[]>(`/events/${slug}/contributions`);
}

export function addContribution(
  slug: string,
  input: { item: string; quantity?: string },
): Promise<Contribution> {
  return request<Contribution>(`/events/${slug}/contributions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteContribution(slug: string, id: string): Promise<{ success: boolean }> {
  return request(`/events/${slug}/contributions/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 6: Add the StockAdjustments functions**

Append to `src/lib/api-client.ts`:

```ts
export function listStockAdjustments(slug: string): Promise<StockAdjustment[]> {
  return request<StockAdjustment[]>(`/events/${slug}/stock-adjustments`);
}

export function applyStockAdjustments(
  slug: string,
  changes: { bottleId: string; quantityAfter: number }[],
): Promise<StockAdjustment[]> {
  return request<StockAdjustment[]>(`/events/${slug}/stock-adjustments`, {
    method: "POST",
    body: JSON.stringify({ changes }),
  });
}
```

- [ ] **Step 7: Add the Cocktails function**

Append to `src/lib/api-client.ts`:

```ts
export function evaluateCocktails(): Promise<RecipeAvailability[]> {
  return request<RecipeAvailability[]>("/cocktails");
}
```

- [ ] **Step 8: Add the Users functions**

Append to `src/lib/api-client.ts`:

```ts
export function listUsers(): Promise<AccountUser[]> {
  return request<AccountUser[]>("/users");
}

export function createUser(input: {
  username: string;
  password: string;
  role?: "ADMIN" | "USER";
  vip?: boolean;
}): Promise<AccountUser> {
  return request<AccountUser>("/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(
  id: string,
  input: { role?: "ADMIN" | "USER"; vip?: boolean; password?: string },
): Promise<AccountUser> {
  return request<AccountUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteUser(id: string): Promise<{ success: boolean }> {
  return request(`/users/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 9: Fix the unused `BottleVolume`/`BottleType` type imports if TypeScript flags them**

```bash
npx tsc --noEmit
```

If `BottleVolume` or `BottleType` are reported unused (they're not directly referenced by name in this file, only via `Bottle`'s own fields), remove them from the `import type { ... } from "./types"` line at the top — keep only `Bottle, EventItem, Contribution, StockAdjustment, AccountUser`.

- [ ] **Step 10: Run the type check and existing test suite**

```bash
npx tsc --noEmit
npm test
```

Expected: `tsc` reports no errors in `src/lib/api-client.ts` or `src/lib/cocktail-types.ts` (other files may still error — that's expected until Tasks 8-14 land, per Task 5's note). `npm test` (Vitest) still passes for whatever test files currently exist (the old `cocktails.test.ts`/`auth.test.ts` are deleted in Task 15, not yet).

- [ ] **Step 11: Commit**

```bash
git add src/lib/api-client.ts src/lib/cocktail-types.ts
git commit -m "feat: build out full api-client surface (bottles, events, contributions, stock-adjustments, cocktails, users)"
```

---

### Task 8: Next.js — `src/app/actions.ts` rewire

**Files:**
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: every function from `src/lib/api-client.ts` (Task 7), `isAdminLoggedIn` from `src/lib/session.ts` (Task 5).
- Produces: same exported function names/signatures as before (`createBottle`, `updateBottleQuantity`, `updateBottleVolumes`, `updateBottleThreshold`, `deleteBottleAction`, `createEvent`, `deleteEventAction`, `addContribution`, `deleteContributionAction`, `submitBilan`, `uploadBottleImage`) so every client component that imports them (`AddBottleForm`, `DeleteEventButton`, etc. — none of which are touched by this plan) keeps working unmodified. `verifyVipPassword` is removed (no longer imported anywhere after Task 10).

- [ ] **Step 1: Replace the full content of `src/app/actions.ts`**

```ts
"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as api from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import type { BottleType, BottleVolume } from "@/lib/types";

async function requireAdmin() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }
}

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export async function createBottle(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const type = String(formData.get("type") ?? "autre") as BottleType;
  const vip = formData.get("vip") === "on";
  const tags = parseTags(formData.get("tags"));
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const thresholdRaw = String(formData.get("lowStockThreshold") ?? "").trim();
  const lowStockThreshold = thresholdRaw ? Number(thresholdRaw) : undefined;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || undefined;

  const volumesRaw = String(formData.get("volumes") ?? "").trim();
  let volumes: BottleVolume[] = [];
  let quantity = Number(formData.get("quantity") ?? 0) || 0;

  if (volumesRaw) {
    try {
      volumes = JSON.parse(volumesRaw) as BottleVolume[];
      quantity = volumes.reduce((sum, v) => sum + v.quantity, 0);
    } catch {
      // fallback to basic quantity
    }
  }

  await api.addBottle({ name, type, quantity, vip, tags, notes, lowStockThreshold, volumes, imageUrl });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath("/");
}

export async function updateBottleQuantity(id: string, quantity: number) {
  await requireAdmin();
  await api.updateBottle(id, { quantity: Math.max(0, quantity) });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath("/");
}

export async function updateBottleVolumes(id: string, volumes: BottleVolume[], imageUrl?: string) {
  await requireAdmin();
  const quantity = volumes.reduce((sum, v) => sum + v.quantity, 0);
  await api.updateBottle(id, { volumes, quantity, imageUrl });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
}

export async function updateBottleThreshold(id: string, threshold: number | null) {
  await requireAdmin();
  await api.updateBottle(id, { lowStockThreshold: threshold ?? undefined });
  revalidatePath("/stock");
  revalidatePath("/");
}

export async function deleteBottleAction(id: string) {
  await requireAdmin();
  await api.deleteBottle(id);
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath("/");
}

export async function createEvent(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!name || !date) return;

  const event = await api.createEvent({ name, date });
  revalidatePath("/soirees");
  redirect(`/soirees/${event.slug}`);
}

export async function deleteEventAction(slug: string) {
  await requireAdmin();
  await api.deleteEvent(slug);
  revalidatePath("/soirees");
}

export async function addContribution(slug: string, formData: FormData) {
  const item = String(formData.get("item") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "").trim() || undefined;
  if (!item) return;

  await api.addContribution(slug, { item, quantity });
  revalidatePath(`/soirees/${slug}`);
}

export async function deleteContributionAction(slug: string, id: string) {
  await api.deleteContribution(slug, id);
  revalidatePath(`/soirees/${slug}`);
}

export async function submitBilan(slug: string, formData: FormData) {
  await requireAdmin();
  const changes: { bottleId: string; quantityAfter: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("quantity-")) continue;
    const bottleId = key.slice("quantity-".length);
    const quantityAfter = Number(value);
    if (Number.isNaN(quantityAfter)) continue;
    changes.push({ bottleId, quantityAfter });
  }

  await api.applyStockAdjustments(slug, changes);
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath(`/soirees/${slug}`);
  revalidatePath("/");
  redirect(`/soirees/${slug}`);
}

export async function uploadBottleImage(formData: FormData): Promise<string | null> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return null;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "png";
  const filename = `bottle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(uploadsDir, filename);

  await fs.writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}
```

Note: `uploadBottleImage` is unchanged (still writes to the local `public/uploads` filesystem directory — image upload storage is explicitly out of scope for this migration per the spec, only bottle/event/contribution/stock-adjustment/user data moves to Postgres).

- [ ] **Step 2: Verify no remaining references to the old `db`/`verifyVipPassword` in this file**

```bash
grep -n "@/lib/db\|verifyVipPassword" src/app/actions.ts
```

Expected: no output.

- [ ] **Step 3: Confirm which files still reference `verifyVipPassword` (should be exactly one, fixed in Task 10)**

```bash
grep -rn "verifyVipPassword" src/
```

Expected: exactly one remaining match, in `src/app/stock/VipSecretSection.tsx` — do not fix it in this task, Task 10 removes it there.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions.ts
git commit -m "feat: rewire Server Actions to call api-client instead of the JSON file store"
```

---

### Task 9: Next.js — `layout.tsx` + dashboard (`page.tsx`)

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `isAdminLoggedIn` from `src/lib/session.ts` (Task 5), `listBottles`, `listEvents`, `evaluateCocktails` from `src/lib/api-client.ts` (Task 7) — called directly, no intermediate wrapper: `/cocktails` (Task 11) and `/stock` (Task 10) each call these same `api-client` functions independently for their own needs, so a shared "summary" helper would have exactly one caller and isn't warranted.

- [ ] **Step 1: Update `src/app/layout.tsx`**

Replace:

```ts
import { isAdminLoggedIn } from "@/lib/auth";
```

with:

```ts
import { isAdminLoggedIn } from "@/lib/session";
```

Add `"Comptes"` to the `NAV` array, but only render it conditionally for an admin. Replace:

```ts
const NAV = [
  { href: "/stock", label: "Cave & Stock" },
  { href: "/cocktails", label: "Cocktails" },
  { href: "/soirees", label: "Soirées" },
];
```

with:

```ts
const NAV = [
  { href: "/stock", label: "Cave & Stock" },
  { href: "/cocktails", label: "Cocktails" },
  { href: "/soirees", label: "Soirées" },
];

const ADMIN_NAV = [{ href: "/comptes", label: "Comptes" }];
```

Replace the `<nav>` block's `{NAV.map(...)}` line with (adding the admin-only items right after the base nav, before the `AdminBadge`):

```tsx
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-muted hover:text-cream hover:bg-white/[0.04] transition-all duration-200"
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin &&
                ADMIN_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-muted hover:text-cream hover:bg-white/[0.04] transition-all duration-200"
                  >
                    {item.label}
                  </Link>
                ))}
```

- [ ] **Step 2: Update `src/app/page.tsx`**

Replace:

```ts
import { listBottles, listEvents } from "@/lib/db";
import { evaluateRecipes } from "@/lib/cocktails";
```

with:

```ts
import { listBottles, listEvents, evaluateCocktails } from "@/lib/api-client";
```

Replace:

```ts
  const bottles = await listBottles();
  const events = await listEvents();

  const stockCount = bottles.filter((b) => b.type !== "mixer" && b.quantity > 0).length;
  const vipCount = bottles.filter((b) => b.vip).length;
  const availability = evaluateRecipes(bottles);
```

with:

```ts
  const [bottles, events, availability] = await Promise.all([
    listBottles(),
    listEvents(),
    evaluateCocktails(),
  ]);

  const stockCount = bottles.filter((b) => b.type !== "mixer" && b.quantity > 0).length;
  const vipCount = bottles.filter((b) => b.vip).length;
```

Everything below this in the file (`lowStock`, `makeableNow`, `today`, `upcoming`, `nextEvent`, and the entire JSX) is unchanged — `availability` is used identically to before.

- [ ] **Step 3: Verify the dashboard compiles and boots**

```bash
npx tsc --noEmit
```

Expected: no new errors from `src/app/page.tsx`, `src/app/layout.tsx` (other files may still error until later tasks land).

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: wire dashboard and layout onto api-client and session"
```

---

### Task 10: Next.js — `/stock` page + `VipSecretSection` (remove vault password)

**Files:**
- Modify: `src/app/stock/page.tsx`
- Modify: `src/app/stock/VipSecretSection.tsx`

**Interfaces:**
- Consumes: `listBottles` from `src/lib/api-client.ts` (already returns VIP-filtered-or-not bottles depending on the caller's session, per Task 1's API change — no client-side filtering needed anymore for the *visibility* decision, only for splitting the already-correctly-scoped list into "normal" vs "vip" groups for layout purposes).
- `VipSecretSection` drops its `isAdmin`-gated password/keyboard-sequence unlock entirely — it now renders unconditionally if it receives any `vipBottles`, and renders nothing (`null`) if `vipBottles` is empty (which happens naturally for a non-VIP, non-admin visitor, since the API already excluded them).

- [ ] **Step 1: Update `src/app/stock/page.tsx`**

Replace:

```ts
import { listBottles } from "@/lib/db";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { isAdminLoggedIn } from "@/lib/auth";
```

with:

```ts
import { listBottles } from "@/lib/api-client";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { isAdminLoggedIn } from "@/lib/session";
```

The rest of the file is unchanged — `listBottles()` already returns a VIP-filtered array for a non-VIP/non-admin caller (Task 1), so `bottles.filter((b) => b.vip)` naturally comes back empty for them, and `StockTabs` receives an empty `vipBottles` array exactly as if there were no VIP stock at all.

- [ ] **Step 2: Update `src/app/stock/VipSecretSection.tsx`**

Read the full current file first (`cat src/app/stock/VipSecretSection.tsx`) to preserve the visual styling of the unlocked state. Remove:
- The `verifyVipPassword` import and every call to it.
- The `unlocked`, `modalOpen`, `password`, `error`, `keyBuffer` state and the `handleKeyDown` keyboard-sequence effect, the `useEffect` wiring it to `window`, and the `externalModalTrigger`/`onResetExternalTrigger` props (mobile triple-tap trigger) — these are the vault-unlock mechanics, no longer needed.
- The password-entry modal JSX block entirely.

Keep: the props `vipBottles: Bottle[]` and `viewMode?: "grid" | "list"` (drop `isAdmin`, `externalModalTrigger`, `onResetExternalTrigger` from the props interface — they were only used by the removed unlock mechanics), the `totalVipLiters` calculation, and the actual VIP bottle grid/list rendering (`BottleGridCard`/`BottleListRow` usage) — these render unconditionally now. Wrap the whole return value: if `vipBottles.length === 0`, return `null` (nothing to show — this is the natural replacement for "locked" state, since a non-VIP/non-admin caller's `vipBottles` array is always empty). Otherwise render the existing VIP grid/list markup directly, without any unlock gate.

- [ ] **Step 3: Update `StockTabs.tsx`'s usage of `VipSecretSection`**

```bash
grep -n "VipSecretSection\|externalModalTrigger\|onResetExternalTrigger\|isAdmin={" src/app/stock/StockTabs.tsx
```

Remove any prop being passed to `<VipSecretSection>` that no longer exists on its interface (`isAdmin`, `externalModalTrigger`, `onResetExternalTrigger` and whatever mobile triple-tap handler in `StockTabs.tsx` fed `externalModalTrigger` — search for and remove the triple-tap detection code in `StockTabs.tsx` if present, since its only purpose was triggering the now-deleted vault modal).

- [ ] **Step 4: Verify the app builds**

```bash
npx tsc --noEmit
```

Expected: no errors from `src/app/stock/*` files.

- [ ] **Step 5: Manual verification**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/stock | grep -o "Cabinet Secret VIP"
kill %1
```

Note: without a running API + logged-in session, `listBottles()` will fail (no NestJS backend reachable in this isolated check) — if this step errors because the API isn't running, that's expected at this point in the plan; Task 16 covers full end-to-end verification once Docker is wired up. If the API happens to be reachable (e.g. `npm run start:dev` running in `api/` from a previous task), confirm the grep returns no output for an anonymous request with no VIP bottles.

- [ ] **Step 6: Commit**

```bash
git add src/app/stock/page.tsx src/app/stock/VipSecretSection.tsx src/app/stock/StockTabs.tsx
git commit -m "feat: replace VIP vault password with account-based VIP visibility"
```

---

### Task 11: Next.js — `/cocktails` page + `CocktailGrid` type fix

**Files:**
- Modify: `src/app/cocktails/page.tsx`
- Modify: `src/app/cocktails/CocktailGrid.tsx`

**Interfaces:**
- Consumes: `evaluateCocktails` from `src/lib/api-client.ts` (Task 7), `RecipeAvailability` from `src/lib/cocktail-types.ts` (Task 7).

- [ ] **Step 1: Update `src/app/cocktails/page.tsx`**

Replace:

```ts
import { listBottles } from "@/lib/db";
import { evaluateRecipes } from "@/lib/cocktails";
```

with:

```ts
import { evaluateCocktails } from "@/lib/api-client";
```

Replace:

```ts
  const bottles = await listBottles();
  const results = evaluateRecipes(bottles);
```

with:

```ts
  const results = await evaluateCocktails();
```

- [ ] **Step 2: Update `src/app/cocktails/CocktailGrid.tsx`**

Replace:

```ts
import type { RecipeAvailability } from "@/lib/cocktails";
```

with:

```ts
import type { RecipeAvailability } from "@/lib/cocktail-types";
```

No other change needed in this file — the shape is identical.

- [ ] **Step 3: Verify the app builds**

```bash
npx tsc --noEmit
```

Expected: no errors from `src/app/cocktails/*`.

- [ ] **Step 4: Commit**

```bash
git add src/app/cocktails
git commit -m "feat: wire /cocktails onto api-client"
```

---

### Task 12: Next.js — `/soirees` list page (drop `vipNames`)

**Files:**
- Modify: `src/app/soirees/page.tsx`

**Interfaces:**
- Consumes: `listEvents` from `src/lib/api-client.ts` (Task 7), `createEvent` from `src/app/actions.ts` (Task 8, already dropped `vipNames` handling).

- [ ] **Step 1: Update the import**

Replace:

```ts
import { listEvents } from "@/lib/db";
```

with:

```ts
import { listEvents } from "@/lib/api-client";
```

- [ ] **Step 2: Remove the "Convives VIP" form field**

Remove this entire block from the create-event form:

```tsx
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Convives VIP (Séparés par virgules)</label>
              <input
                name="vipNames"
                placeholder="Ex: Noa, Sarah, Thomas"
                className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
              />
            </div>
```

- [ ] **Step 3: Remove the VIP badge from the event list**

Replace:

```tsx
                    <p className="text-xs text-muted mt-1 flex flex-wrap gap-2 items-center">
                      <span className="text-orange-dim capitalize font-mono text-[10px]">
                        {new Date(event.date).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      {event.vipNames.length > 0 && (
                        <>
                          <span className="text-muted/40">•</span>
                          <span className="text-gold font-medium bg-brick-dark/30 px-2 py-0.5 rounded border border-gold/15 text-[9px] uppercase tracking-wider">
                            🔒 {event.vipNames.length} VIP
                          </span>
                        </>
                      )}
                    </p>
```

with:

```tsx
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
```

- [ ] **Step 4: Verify the app builds**

```bash
npx tsc --noEmit
```

Expected: no errors from `src/app/soirees/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/app/soirees/page.tsx
git commit -m "feat: drop per-event VIP guest list from soirées creation/list (VIP is now account-wide)"
```

---

### Task 13: Next.js — `/soirees/[slug]` page + `GuestPanel` (real login) + `/bilan` page

**Files:**
- Modify: `src/app/soirees/[slug]/page.tsx`
- Modify: `src/app/soirees/[slug]/GuestPanel.tsx`
- Modify: `src/app/soirees/[slug]/bilan/page.tsx`

**Interfaces:**
- Consumes: `getEvent`, `listContributions`, `listBottles`, `listStockAdjustments`, `evaluateCocktails` from `src/lib/api-client.ts` (Task 7); `getSession`, `SessionUser` from `src/lib/session.ts` (Task 5); `login` from `src/app/login/actions.ts` (Task 6, reused via a hidden `redirectTo` field).

- [ ] **Step 1: Update `src/app/soirees/[slug]/page.tsx`**

Replace the full content:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getEvent, listContributions, listBottles, listStockAdjustments, evaluateCocktails } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import GuestPanel from "./GuestPanel";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const [contributions, bottles, adjustments, availability, session] = await Promise.all([
    listContributions(slug),
    listBottles(),
    listStockAdjustments(slug),
    evaluateCocktails(),
    getSession(),
  ]);

  const stock = bottles
    .filter((b) => !b.vip && b.type !== "mixer" && b.quantity > 0)
    .map((b) => ({ name: b.name, type: b.type, quantity: b.quantity }));

  const vipStock = bottles
    .filter((b) => b.vip && b.quantity > 0)
    .map((b) => ({ name: b.name, type: b.type, quantity: b.quantity }));

  const readyCocktails = availability.filter((a) => a.makeable && !a.usesVip);
  const vipCocktails = availability.filter((a) => a.makeable && a.usesVip);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-orange/15 pb-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">
            Soirée en cours
          </span>
          <h1 className="font-display text-4xl text-cream mt-1">{event.name}</h1>
          <p className="text-muted text-xs mt-2 capitalize font-mono text-orange-dim">
            {new Date(event.date).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Link
          href={`/soirees/${slug}/bilan`}
          className="shrink-0 text-xs px-4 py-2.5 rounded-xl border border-orange/30 bg-orange/10 text-orange hover:bg-orange hover:text-ink transition-all duration-300 font-bold uppercase tracking-wider text-center shadow-md shadow-orange/10"
        >
          📝 Faire / Modifier le bilan
        </Link>
      </div>

      {adjustments.length > 0 && (
        <div className="rounded-2xl border border-orange/30 bg-ink-2/90 p-5 shadow-xl box-orange-glow space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-orange/20 text-orange flex items-center justify-center text-base">
                📊
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-cream">
                  Bilan de la Soirée enregistré
                </h3>
                <p className="text-xs text-muted">
                  {adjustments.length} référence(s) ajustée(s) lors du bilan
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {adjustments.map((adj) => {
              const diff = adj.quantityAfter - adj.quantityBefore;
              return (
                <div
                  key={adj.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-ink border border-white/[0.06] text-xs"
                >
                  <span className="font-semibold text-cream truncate max-w-[170px]">
                    {adj.bottleName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-muted">
                      {adj.quantityBefore} → {adj.quantityAfter}
                    </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        diff < 0
                          ? "bg-red-500/15 text-red-400"
                          : "bg-emerald-500/15 text-emerald-400"
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : `${diff}`} btl
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <GuestPanel
        slug={slug}
        session={session}
        contributions={contributions}
        stock={stock}
        vipStock={vipStock}
        readyCocktails={readyCocktails}
        vipCocktails={vipCocktails}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update `src/app/soirees/[slug]/GuestPanel.tsx`**

Replace the full content:

```tsx
"use client";

import { addContribution, deleteContributionAction } from "@/app/actions";
import { login } from "@/app/login/actions";
import type { Contribution } from "@/lib/types";
import type { SessionUser } from "@/lib/session";
import type { RecipeAvailability } from "@/lib/cocktail-types";
import { useTransition } from "react";

interface StockLine {
  name: string;
  type: string;
  quantity: number;
}

export default function GuestPanel({
  slug,
  session,
  contributions,
  stock,
  vipStock,
  readyCocktails,
  vipCocktails,
}: {
  slug: string;
  session: SessionUser | null;
  contributions: Contribution[];
  stock: StockLine[];
  vipStock: StockLine[];
  readyCocktails: RecipeAvailability[];
  vipCocktails: RecipeAvailability[];
}) {
  const [, startTransition] = useTransition();

  if (!session) {
    return (
      <section className="rounded-xl border border-orange/10 bg-ink-2/40 p-6 max-w-md mx-auto box-orange-glow text-center space-y-4 my-8">
        <div className="text-3xl">🔑</div>
        <div>
          <h2 className="font-display text-2xl text-cream">Qui es-tu ?</h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Connecte-toi pour consulter le stock disponible, voir ce qu&apos;il reste à ramener, et débloquer les boissons secrètes.
          </p>
        </div>
        <form action={login} className="flex flex-col gap-2">
          <input type="hidden" name="redirectTo" value={`/soirees/${slug}`} />
          <input
            name="username"
            required
            placeholder="Identifiant"
            className="bg-ink border border-orange/15 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream text-center"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Mot de passe"
            className="bg-ink border border-orange/15 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream text-center"
          />
          <button
            type="submit"
            className="bg-orange text-white font-medium rounded-xl px-4 py-2 text-xs hover:bg-orange-hover box-orange-glow transition-all"
          >
            Se connecter
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between rounded-xl border border-orange/15 bg-ink-2/50 p-4 box-orange-glow">
        <p className="text-xs text-cream flex items-center gap-2">
          <span>👋</span>
          <span>
            Ravi de vous voir, <strong className="text-orange">{session.username}</strong>
          </span>
          {session.vip && (
            <span className="ml-2 text-gold font-bold bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold/20 text-[9px] uppercase tracking-wider animate-pulse">
              👑 Privilèges VIP Activés
            </span>
          )}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <section className="bg-ink-2/20 border border-orange/10 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-orange/5 pb-2">
              <h2 className="font-display text-lg text-cream">Qui apporte quoi</h2>
              <span className="text-[10px] uppercase font-mono text-orange bg-orange/10 px-2 py-0.5 rounded border border-orange/20">
                {contributions.length} Contributions
              </span>
            </div>

            {contributions.length === 0 ? (
              <p className="text-muted text-xs italic py-4 text-center">Aucune bouteille promise pour l&apos;instant. Ouvrez le bal !</p>
            ) : (
              <ul className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {contributions.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-orange/5 bg-ink-2/60 px-3 py-2 flex items-center justify-between text-xs text-cream hover:border-orange/20 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-orange-dim">{c.user.username}</span>
                      <span className="text-muted/65">apporte</span>
                      <span className="font-medium text-cream">{c.item}</span>
                      {c.quantity && (
                        <span className="text-[10px] font-mono bg-orange-dark/25 px-1.5 py-0.5 rounded text-orange border border-orange-dark/30">
                          {c.quantity}
                        </span>
                      )}
                    </span>
                    {c.user.id === session.sub && (
                      <button
                        onClick={() => startTransition(() => deleteContributionAction(slug, c.id))}
                        className="text-[10px] text-muted/50 hover:text-red-400 font-semibold uppercase tracking-wider transition-colors"
                      >
                        Retirer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form
              action={async (formData: FormData) => {
                await addContribution(slug, formData);
              }}
              className="mt-4 grid sm:grid-cols-[1fr_auto_auto] gap-2 pt-3 border-t border-orange/5"
            >
              <input
                name="item"
                required
                placeholder="Ex: Gin Hendrick's, Tonic, Citrons..."
                className="bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
              />
              <input
                name="quantity"
                placeholder="Ex: 1 bouteille"
                className="bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream w-24"
              />
              <button
                type="submit"
                className="bg-orange text-white font-medium rounded-xl px-4 py-2 text-xs hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider font-semibold"
              >
                Partager
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cream border-b border-orange/5 pb-2">Déjà disponible sur place</h2>
            {stock.length === 0 ? (
              <p className="text-muted text-xs italic">Aucune bouteille déclarée en stock.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2 text-xs max-h-[220px] overflow-y-auto pr-1">
                {stock.map((b, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-orange/5 bg-ink-2/30 px-3 py-2 flex justify-between items-center text-cream"
                  >
                    <span className="font-medium truncate mr-2">{b.name}</span>
                    <span className="text-[10px] font-mono bg-orange-dark/15 border border-orange-dark/30 px-2 py-0.5 rounded text-orange">
                      Qté: {b.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="font-display text-lg text-cream border-b border-orange/5 pb-2">Cocktails réalisables ce soir</h2>
            {readyCocktails.length === 0 ? (
              <p className="text-muted text-xs italic">Aucun cocktail n&apos;est réalisable avec les réserves actuelles. N&apos;hésitez pas à apporter des mixers !</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {readyCocktails.map(({ recipe }) => (
                  <div key={recipe.id} className="rounded-xl border border-orange/10 bg-ink-2/40 p-4 hover:border-orange/20 transition-all flex flex-col justify-between">
                    <div>
                      <p className="font-display text-base text-cream font-medium">{recipe.name}</p>
                      <p className="text-orange text-[10px] mt-0.5 uppercase tracking-wider font-mono">{recipe.glass}</p>
                    </div>
                    <p className="text-muted text-[10px] mt-2 line-clamp-2 italic">{recipe.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {session.vip && (
            <section className="rounded-xl border border-gold/25 bg-brick-dark/10 p-5 space-y-4 box-orange-glow">
              <div className="flex items-center gap-2 border-b border-gold/15 pb-2">
                <span className="text-lg">🔒</span>
                <div>
                  <h3 className="font-display text-lg text-gold">Cabinet Secret VIP</h3>
                  <p className="text-[10px] text-muted">Disponible pour les initiés.</p>
                </div>
              </div>

              {vipStock.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gold uppercase tracking-wider font-semibold">Alcools de la réserve</p>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    {vipStock.map((b, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-gold/10 bg-ink/30 px-3 py-2 flex justify-between items-center text-cream"
                      >
                        <span className="font-medium truncate mr-2">{b.name}</span>
                        <span className="text-[9px] font-mono bg-gold/10 border border-gold/20 px-2 py-0.5 rounded text-gold font-bold">
                          {b.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {vipCocktails.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[10px] text-gold uppercase tracking-wider font-semibold">Cocktails VIP débloqués</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {vipCocktails.map(({ recipe }) => (
                      <div key={recipe.id} className="rounded-xl border border-gold/15 bg-ink/20 p-3 text-xs flex flex-col justify-between">
                        <div>
                          <p className="font-display text-sm text-cream font-medium">{recipe.name}</p>
                          <p className="text-gold text-[9px] uppercase tracking-wider font-mono">{recipe.glass}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: the "Se déconnecter" button from the old header is removed — logging out mid-event-page isn't a flow this page needs to own (the global `AdminBadge`/nav already exposes logout for admins; a plain guest who wants to switch accounts can use `/login` directly). This is a deliberate scope trim, not an oversight — if the human wants a logout affordance here too, that's a follow-up, not part of this task.

- [ ] **Step 3: Update `src/app/soirees/[slug]/bilan/page.tsx`**

Replace:

```ts
import { getEvent, listBottles } from "@/lib/db";
```

with:

```ts
import { getEvent, listBottles } from "@/lib/api-client";
```

No other change needed in this file.

- [ ] **Step 4: Verify the app builds**

```bash
npx tsc --noEmit
```

Expected: no errors from any file under `src/app/soirees/`.

- [ ] **Step 5: Commit**

```bash
git add src/app/soirees/[slug]
git commit -m "feat: real account login for the guest event page, contribution ownership by user id"
```

---

### Task 14: Next.js — new `/comptes` admin page

**Files:**
- Create: `src/app/comptes/page.tsx`
- Create: `src/app/comptes/actions.ts`
- Create: `src/app/comptes/CreateUserForm.tsx`
- Create: `src/app/comptes/UserRow.tsx`

**Interfaces:**
- Consumes: `listUsers`, `createUser`, `updateUser`, `deleteUser` from `src/lib/api-client.ts` (Task 7), `isAdminLoggedIn` from `src/lib/session.ts` (Task 5), `AccountUser` from `src/lib/types.ts` (Task 5).

- [ ] **Step 1: Create `src/app/comptes/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as api from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";

async function requireAdmin() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }
}

function randomTempPassword(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim();
  if (!username) return;
  const vip = formData.get("vip") === "on";
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "USER";
  const password = randomTempPassword();

  await api.createUser({ username, password, role, vip });
  revalidatePath("/comptes");
  return { username, password };
}

export async function toggleRoleAction(id: string, role: "ADMIN" | "USER") {
  await requireAdmin();
  await api.updateUser(id, { role });
  revalidatePath("/comptes");
}

export async function toggleVipAction(id: string, vip: boolean) {
  await requireAdmin();
  await api.updateUser(id, { vip });
  revalidatePath("/comptes");
}

export async function resetPasswordAction(id: string): Promise<string> {
  await requireAdmin();
  const password = randomTempPassword();
  await api.updateUser(id, { password });
  revalidatePath("/comptes");
  return password;
}

export async function deleteUserAction(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await api.deleteUser(id);
    revalidatePath("/comptes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de la suppression" };
  }
}
```

- [ ] **Step 2: Create `src/app/comptes/CreateUserForm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { createUserAction } from "./actions";

export default function CreateUserForm() {
  const [isPending, startTransition] = useTransition();
  const [generatedPassword, setGeneratedPassword] = useState<{ username: string; password: string } | null>(null);

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-4">
      <div>
        <h2 className="font-display text-xl text-cream">Créer un compte</h2>
        <p className="text-muted text-[11px] mt-0.5">Un mot de passe temporaire est généré automatiquement.</p>
      </div>
      <form
        action={(formData) => {
          startTransition(async () => {
            const result = await createUserAction(formData);
            if (result) setGeneratedPassword(result);
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
          Réserve VIP
        </label>
        <select
          name="role"
          className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs text-cream"
        >
          <option value="USER">Utilisateur</option>
          <option value="ADMIN">Administrateur</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-orange text-white font-medium rounded-xl py-2.5 hover:bg-orange-hover transition-all text-xs uppercase tracking-wider font-semibold"
        >
          Créer le compte
        </button>
      </form>
      {generatedPassword && (
        <div className="text-xs bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-emerald-300">
          Compte <strong>{generatedPassword.username}</strong> créé. Mot de passe temporaire :{" "}
          <code className="font-mono bg-black/30 px-1.5 py-0.5 rounded">{generatedPassword.password}</code>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Create `src/app/comptes/UserRow.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import type { AccountUser } from "@/lib/types";
import { toggleRoleAction, toggleVipAction, resetPasswordAction, deleteUserAction } from "./actions";

export default function UserRow({ user }: { user: AccountUser }) {
  const [isPending, startTransition] = useTransition();
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-orange/10 bg-ink-2/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <p className="font-display text-cream">{user.username}</p>
        <p className="text-[10px] text-muted mt-0.5">
          {user.role === "ADMIN" ? "Administrateur" : "Utilisateur"}
          {user.vip && " · VIP"}
        </p>
        {resetResult && (
          <p className="text-[10px] text-emerald-300 mt-1">
            Nouveau mot de passe : <code className="font-mono bg-black/30 px-1 rounded">{resetResult}</code>
          </p>
        )}
        {deleteError && <p className="text-[10px] text-red-400 mt-1">{deleteError}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(() => toggleRoleAction(user.id, user.role === "ADMIN" ? "USER" : "ADMIN"))
          }
          className="px-2.5 py-1 rounded-lg border border-orange/20 text-muted hover:text-cream transition-colors"
        >
          {user.role === "ADMIN" ? "Rétrograder" : "Promouvoir admin"}
        </button>
        <button
          disabled={isPending}
          onClick={() => startTransition(() => toggleVipAction(user.id, !user.vip))}
          className="px-2.5 py-1 rounded-lg border border-gold/20 text-gold hover:bg-gold/10 transition-colors"
        >
          {user.vip ? "Retirer VIP" : "Passer VIP"}
        </button>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const password = await resetPasswordAction(user.id);
              setResetResult(password);
            })
          }
          className="px-2.5 py-1 rounded-lg border border-orange/20 text-muted hover:text-cream transition-colors"
        >
          Réinitialiser le mot de passe
        </button>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setDeleteError(null);
              const result = await deleteUserAction(user.id);
              if (result.error) setDeleteError(result.error);
            })
          }
          className="px-2.5 py-1 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/comptes/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { listUsers } from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import CreateUserForm from "./CreateUserForm";
import UserRow from "./UserRow";

export default async function ComptesPage() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }

  const users = await listUsers();

  return (
    <PageTransition className="space-y-8">
      <div>
        <span className="text-xs uppercase tracking-caps text-orange font-semibold">Administration</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-cream mt-1 tracking-tight">Comptes</h1>
        <p className="text-muted text-xs mt-2 max-w-lg leading-relaxed">
          Crée un compte pour chaque proche, gère son rôle et son accès à la réserve VIP.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1">
          <CreateUserForm />
        </div>
        <div className="md:col-span-2 space-y-3">
          {users.length === 0 ? (
            <p className="text-muted text-xs italic">Aucun compte pour l&apos;instant.</p>
          ) : (
            users.map((user) => <UserRow key={user.id} user={user} />)
          )}
        </div>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 5: Verify the app builds**

```bash
npx tsc --noEmit
```

Expected: no errors from `src/app/comptes/*`.

- [ ] **Step 6: Commit**

```bash
git add src/app/comptes
git commit -m "feat: add admin account management page (/comptes)"
```

---

### Task 15: Cleanup — delete replaced files, update env files

**Files:**
- Delete: `src/lib/db.ts`, `src/lib/cocktails.ts`, `src/lib/cocktails.test.ts`
- Modify: `.env.local` (local dev only, not committed — update by hand per Step 3)
- Create: `.env.example` (root, committed)
- Modify: `package.json` (remove `vitest` if `src/lib/cocktails.test.ts` was the only test file — verify before removing)

**Interfaces:**
- None — this is a pure cleanup task with no new interfaces. Verifies the whole `src/` tree no longer references any deleted module.

- [ ] **Step 1: Confirm nothing still imports the files about to be deleted**

```bash
grep -rn "@/lib/db\|@/lib/cocktails\"" src/
```

Expected: no output (every importer was fixed in Tasks 8-13). If anything shows up, stop and fix that file before proceeding — do not delete the source files out from under a live import.

- [ ] **Step 2: Delete the replaced files**

```bash
rm src/lib/db.ts src/lib/cocktails.ts src/lib/cocktails.test.ts
```

- [ ] **Step 3: Check whether any other test files remain**

```bash
find src -name "*.test.ts" -o -name "*.test.tsx"
```

If this returns no files, remove `vitest` from `package.json`'s `devDependencies` and delete the `"test": "vitest run"` line from `"scripts"` — Vitest with zero test files is dead weight. If any test files remain, leave `vitest` and the `test` script in place.

- [ ] **Step 4: Create `.env.example`**

Create `.env.example` at the repo root:

```
NEST_API_URL=http://localhost:3001
JWT_SECRET=dev-secret-change-me
```

- [ ] **Step 5: Update the local `.env.local`**

```bash
cat .env.local
```

Remove the `ADMIN_PASSWORD` and `VIP_PASSWORD` lines (if present) and add/confirm `NEST_API_URL=http://localhost:3001` and `JWT_SECRET=<same value the api/.env file uses>` — read `api/.env`'s `JWT_SECRET` value and copy it here verbatim, since both services must share the exact same secret to validate each other's tokens.

- [ ] **Step 6: Run the full verification**

```bash
npm run build
```

Expected: builds successfully with no references to missing modules. (This requires a reachable API for any page that fetches data at build time via `output: 'export'`-style prerendering — if this Next.js config does full static generation of data-fetching pages at build time, and the API isn't running, the build may fail on those routes; if so, note this in your report and defer full verification to Task 17, which runs against the live Docker stack. Do not treat an API-connectivity build failure here as a code defect — only investigate if the error is a missing-module/type error.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove db.ts/cocktails.ts/auth.ts and the file-based data store, add .env.example"
```

---

### Task 16: Docker deployment (3 services)

**Files:**
- Create: `api/Dockerfile`
- Create: `Dockerfile` (repo root, for Next.js)
- Modify: `docker-compose.yml` (repo root — currently only has a `postgres` dev service from Plan 1)
- Create: `.dockerignore` (repo root)
- Create: `api/.dockerignore`

**Interfaces:**
- None — this task only adds deployment artifacts, no application code interfaces.

- [ ] **Step 1: Create `api/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

- [ ] **Step 2: Create `api/.dockerignore`**

```
node_modules
dist
.env
*.md
scripts
```

- [ ] **Step 3: Create the root `Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "run", "start"]
```

- [ ] **Step 4: Create the root `.dockerignore`**

```
node_modules
.next
api
.env.local
*.md
data
```

- [ ] **Step 5: Rewrite `docker-compose.yml`**

Replace the full content of `docker-compose.yml` (repo root):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: bardenoa
      POSTGRES_PASSWORD: bardenoa
      POSTGRES_DB: bardenoa
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./api
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://bardenoa:bardenoa@postgres:5432/bardenoa
      JWT_SECRET: ${JWT_SECRET}
      WEB_ORIGIN: http://web:3000

  web:
    build: .
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NEST_API_URL: http://api:3001
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8080:3000"

volumes:
  postgres_data:
```

Note: this removes the dev-only `ports: ["5433:5432"]` mapping on `postgres` that Plan 1 added for local development (the reason it existed — a conflicting local Homebrew Postgres on port 5432 — only matters for host-machine access; inside Docker Compose, `api` reaches `postgres` via the internal service-name DNS `postgres:5432`, which never touches the host's port 5432 at all). If local dev workflow (running `api/` outside Docker against `docker compose up -d postgres`) is still needed after this change, keep a separate `docker-compose.dev.yml` override — this is out of scope for this task; note it as a possible follow-up in your report if the human raises it, but do not add it unprompted.

- [ ] **Step 6: Create the root `.env.example` addition for `JWT_SECRET`**

Confirm `.env.example` (Task 15) documents `JWT_SECRET` — since `docker-compose.yml` now reads `${JWT_SECRET}` from the shell/`.env` at the repo root when running `docker compose up`, add a root `.env` (gitignored, not `.env.local` — Compose reads `.env` specifically) with a real secret for local testing:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
```

- [ ] **Step 7: Build and start the full stack**

```bash
docker compose build
docker compose up -d
docker compose ps
```

Expected: all 3 containers show `Up`/`running` status. Check logs for the `api` container specifically:

```bash
docker compose logs api --tail 30
```

Expected: `Nest application successfully started`, no Prisma connection errors (the `prisma migrate deploy` step should report either "No pending migrations" or apply the existing `20260710165309_init` migration cleanly against the fresh `postgres` volume).

- [ ] **Step 8: Verify the site responds on port 8080**

```bash
curl -sI http://localhost:8080 | head -5
```

Expected: `HTTP/1.1 200 OK` (or a redirect to `/login` if the dashboard route somehow requires auth — it shouldn't, per this plan's Global Constraints; if it does redirect, that's a regression to investigate, not expected behavior).

- [ ] **Step 9: Tear down**

```bash
docker compose down
```

(Leave the stack down at the end of this task — Task 17 brings it back up for full verification with real data.)

- [ ] **Step 10: Commit**

```bash
git add Dockerfile .dockerignore api/Dockerfile api/.dockerignore docker-compose.yml .env.example
git commit -m "feat: add 3-service Docker Compose deployment (postgres, api, web on port 8080)"
```

---

### Task 17: End-to-end verification of the full deployed stack

**Files:**
- None (verification-only task; no new files, no commit unless a real bug is found and fixed).

**Interfaces:**
- Consumes: the entire stack built across Tasks 1-16.

- [ ] **Step 1: Start the full stack fresh**

```bash
docker compose up -d
sleep 3
docker compose ps
```

Expected: all 3 services `Up`.

- [ ] **Step 2: Bootstrap an admin account**

The database is empty on first boot. Bootstrap directly via the `api` container (same approach as Plan 1's Task 12, adapted for the containerized deploy):

```bash
docker compose exec api node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
bcrypt.hash('adminpass123', 10).then(async (hash) => {
  await prisma.user.create({ data: { username: 'admin', passwordHash: hash, role: 'ADMIN', vip: true } });
  await prisma.\$disconnect();
  console.log('admin created');
});
"
```

Expected: prints `admin created`.

- [ ] **Step 3: Verify the dashboard is publicly reachable without login**

```bash
curl -s http://localhost:8080/ | grep -o "Le Bar"
curl -s http://localhost:8080/cocktails | grep -o "Mixologie"
curl -s http://localhost:8080/stock | grep -o "Marché"
curl -s http://localhost:8080/soirees | grep -o "Soirées Privées"
```

Expected: each grep matches (page content renders without a session cookie).

- [ ] **Step 4: Log in as admin through the real HTTP login flow**

```bash
curl -i -c /tmp/cookies.txt -X POST http://localhost:8080/login \
  --data-urlencode "username=admin" \
  --data-urlencode "password=adminpass123" \
  -L
```

Note: this posts to the Next.js Server Action endpoint, not directly to the API — Next.js Server Actions are invoked via a special POST convention, not a plain form-urlencoded endpoint reachable by raw `curl`. If this doesn't work via `curl` directly, use `npm run dev`-style verification instead: open the site in a way you can drive via `mcp__claude-in-chrome` browser tools if available, or verify the login Server Action indirectly by confirming `POST http://localhost:8080/api-internal-check` isn't a real route — instead, verify login by calling the NestJS API directly (already proven end-to-end in Plan 1's Task 12) and confirm the SAME credentials work by checking `docker compose logs web` shows no errors when you manually exercise the login form in a browser. **If a browser tool is available in this environment, use it** to actually click through: navigate to `http://localhost:8080/login`, fill in `admin`/`adminpass123`, submit, confirm redirect to `/` and that the nav now shows a "Comptes" link and admin badge. Report exactly which method you used.

- [ ] **Step 5: Create a bottle, an event, and a second user as admin**

Using whichever method Step 4 established works (browser or a verified cookie-based curl session), as admin:
- Create a bottle: name "Rhum blanc", type "rhum", quantity 2, tag "rhum blanc", not VIP.
- Create an event: name "Apéro test", today's date.
- Create a user via `/comptes`: username "marie", not VIP, role USER. Note the generated temporary password shown on screen.

Expected: each action succeeds and the created resources appear in their respective list pages (`/stock`, `/soirees`, `/comptes`).

- [ ] **Step 6: Log in as the second user and contribute**

Log in as "marie" with her temporary password, navigate to the "Apéro test" event page, submit a contribution ("Glaçons", "2 sacs"). Confirm it appears in the "Qui apporte quoi" list attributed to "marie", and that a "Retirer" button is visible only for her own contribution.

- [ ] **Step 7: Verify VIP visibility**

As admin, edit "marie"'s account via `/comptes` to toggle VIP on. Log in as "marie" again (or refresh if the session naturally reflects it — note that per the spec's accepted limitation, a role/VIP change doesn't take effect until the existing JWT expires or a fresh login happens, so log out and log back in as marie to pick up the new `vip: true` claim). Confirm the "Cabinet Secret VIP" section now appears on the event page and on `/stock`, where it didn't before.

- [ ] **Step 8: Run a bilan as admin**

Navigate to `/soirees/apero-test/bilan`, reduce the Rhum blanc quantity from 2 to 1, submit. Confirm `/stock` reflects the new quantity, and the event page shows the "Bilan de la Soirée enregistré" recap block.

- [ ] **Step 9: Clean up test data (optional) and report**

Leave the stack running or tear it down (`docker compose down`) per your judgment — this is a verification task, not a data-preservation one, so either is fine as long as you report which you did.

- [ ] **Step 10: No commit for this task** unless a genuine bug was found and fixed along the way (in which case, follow the fix in its own commit with a clear message, and re-run the relevant verification step to confirm the fix before reporting DONE).
