# Member Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four new self-service profile fields (birthday, favorite drink, allergies, profile photo) that any user can set for themselves and any member of their bar can see — implementing GitHub issue #19.

**Architecture:** Four new nullable `User` columns, a self-service `GET/PATCH /auth/profile` pair on the existing `AuthController` (not `UsersController`, which is admin-only at the class level — see Task 3's note), a generalized `ImagePicker` reused for the avatar upload, a new `/profil` self-edit page, and a new `/annuaire` read-only roster page any bar member can visit (unlike the existing owner-only `/membres`).

**Tech Stack:** NestJS + Prisma 6 + PostgreSQL (`api/`), Next.js 16 App Router (`src/`). No frontend test framework in this project — verified via `tsc --noEmit` and manual/live checks.

## Global Constraints

- Field names, exactly: `birthday` (`DateTime?`), `favoriteDrink` (`String?`), `allergies` (`String?`), `avatarUrl` (`String?`) — all nullable on `User`.
- Self-service editing (`GET/PATCH /auth/profile`) must NOT live on `UsersController` — its class-level `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')` blocks every non-admin caller regardless of method-level decorators, so these two routes belong on `AuthController` instead (which already hosts the analogous `change-password` self-service pattern, guarded only by `JwtAuthGuard`).
- Roster visibility (`/annuaire`) is for any bar member, not just owners — reuses `listBarMembers()`, whose backend guard (`BarsService.findMembers`) already only checks bar membership, not ownership.
- Full-form-replace semantics on `PATCH /auth/profile`: every submission sets all four fields based on the current form state (an empty value clears that field to `null`), matching the spec's stated behavior.
- Birthday is displayed as day + month only (e.g. "15 août"), never the year, on the roster page.
- Full spec: `docs/superpowers/specs/2026-07-28-member-profiles-design.md`.

---

### Task 1: Add profile fields to the `User` model

**Files:**
- Modify: `api/prisma/schema.prisma` (the `User` model)
- Create: a new Prisma migration under `api/prisma/migrations/`

**Interfaces:**
- Produces: `User.birthday: Date | null`, `User.favoriteDrink: string | null`, `User.allergies: string | null`, `User.avatarUrl: string | null` on every Prisma `User` query result.

- [ ] **Step 1: Add the fields to the schema**

In `api/prisma/schema.prisma`, change the `User` model from:

```prisma
model User {
  id                 String         @id @default(cuid())
  username           String         @unique
  passwordHash       String
  role               Role           @default(USER)
  vip                Boolean        @default(false)
  mustChangePassword Boolean        @default(false)
  createdAt          DateTime       @default(now())
  contributions      Contribution[]
  recipes            Recipe[]
  barMemberships     BarMembership[]
  barJoinRequests    BarJoinRequest[]
}
```

to:

```prisma
model User {
  id                 String         @id @default(cuid())
  username           String         @unique
  passwordHash       String
  role               Role           @default(USER)
  vip                Boolean        @default(false)
  mustChangePassword Boolean        @default(false)
  birthday           DateTime?
  favoriteDrink      String?
  allergies          String?
  avatarUrl          String?
  createdAt          DateTime       @default(now())
  contributions      Contribution[]
  recipes            Recipe[]
  barMemberships     BarMembership[]
  barJoinRequests    BarJoinRequest[]
}
```

- [ ] **Step 2: Generate and apply the migration**

```bash
cd api && npx prisma migrate dev --name add_member_profile_fields
```

Expected: a new folder under `api/prisma/migrations/` with a `migration.sql`
adding the four columns, and "Your database is now in sync with your schema."

If the local Postgres container isn't running, start it first
(`docker start bardenoa-postgres-1` — the project's dev container) and retry.
If `prisma migrate dev` still can't reach it, hand-author the migration
folder following the exact naming/SQL convention of the existing migrations
under `api/prisma/migrations/`, and run `npx prisma generate` on its own so
the TypeScript client picks up the new fields — this is what happened for
the `mustChangePassword` migration earlier in this project's history when
the dev DB was unreachable at plan-execution time.

- [ ] **Step 3: Verify**

```bash
cd api && npx tsc --noEmit -p .
```

Expected: no new errors (the four fields aren't referenced by any
application code yet — that's later tasks).

- [ ] **Step 4: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/
git commit -m "feat(api): add profile fields to User (birthday, favoriteDrink, allergies, avatarUrl)"
```

---

### Task 2: `UsersService` read/write for the new fields

**Files:**
- Modify: `api/src/users/users.service.ts` (all of it)
- Test: `api/src/users/users.service.spec.ts`

**Interfaces:**
- Consumes: the four fields from Task 1.
- Produces: `UsersService.findPublicById(id: string): Promise<PublicUser | null>` (full `PUBLIC_SELECT` shape, safe to expose over HTTP — unlike the existing `findById`, which returns the raw record including `passwordHash` for password-verification use). `UsersService.updateProfile(id: string, input: { birthday?: string; favoriteDrink?: string; allergies?: string; avatarUrl?: string }): Promise<PublicUser>` — full-form-replace: `birthday` parsed to a `Date` if truthy else `null`; the three string fields set to the given value if truthy else `null`.

- [ ] **Step 1: Update `PUBLIC_SELECT` and add the two new methods**

Replace `api/src/users/users.service.ts` in full with:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

const PUBLIC_SELECT = {
  id: true,
  username: true,
  role: true,
  vip: true,
  createdAt: true,
  mustChangePassword: true,
  birthday: true,
  favoriteDrink: true,
  allergies: true,
  avatarUrl: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    username: string;
    password: string;
    role?: Role;
    vip?: boolean;
    mustChangePassword?: boolean;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictException("Ce nom d'utilisateur existe déjà");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        role: input.role ?? 'USER',
        vip: input.vip ?? false,
        mustChangePassword: input.mustChangePassword ?? false,
      },
      select: PUBLIC_SELECT,
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findPublicById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: PUBLIC_SELECT });
  }

  findAll() {
    return this.prisma.user.findMany({ select: PUBLIC_SELECT, orderBy: { username: 'asc' } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  search(query: string) {
    if (!query.trim()) return Promise.resolve([]);
    return this.prisma.user.findMany({
      where: { username: { contains: query, mode: 'insensitive' } },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
      take: 10,
    });
  }

  async update(
    id: string,
    input: { role?: Role; vip?: boolean; password?: string; mustChangePassword?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const { password, mustChangePassword, ...rest } = input;
    const data: {
      role?: Role;
      vip?: boolean;
      passwordHash?: string;
      mustChangePassword?: boolean;
    } = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      data.mustChangePassword = mustChangePassword ?? true;
    }

    return this.prisma.user.update({ where: { id }, data, select: PUBLIC_SELECT });
  }

  async updateProfile(
    id: string,
    input: { birthday?: string; favoriteDrink?: string; allergies?: string; avatarUrl?: string },
  ) {
    return this.prisma.user.update({
      where: { id },
      data: {
        birthday: input.birthday ? new Date(input.birthday) : null,
        favoriteDrink: input.favoriteDrink || null,
        allergies: input.allergies || null,
        avatarUrl: input.avatarUrl || null,
      },
      select: PUBLIC_SELECT,
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          "Impossible de supprimer cet utilisateur : il a des contributions associées",
        );
      }
      throw error;
    }
    return { success: true };
  }
}
```

(Only `PUBLIC_SELECT`, the new `findPublicById`, and the new `updateProfile`
are additions — `create`, `findById`, `findAll`, `findByUsername`, `search`,
`update`, and `remove` are reproduced unchanged so the file stays complete
and copy-pasteable.)

- [ ] **Step 2: Write the failing tests**

Add to `api/src/users/users.service.spec.ts`, after the last existing test
(`it('returns a user by id', ...)`), just before the file's final `});`:

```ts
  it('returns the full public profile by id', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      username: 'noa',
      birthday: null,
      favoriteDrink: null,
      allergies: null,
      avatarUrl: null,
    });

    const result = await service.findPublicById('1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '1' },
      select: {
        id: true,
        username: true,
        role: true,
        vip: true,
        createdAt: true,
        mustChangePassword: true,
        birthday: true,
        favoriteDrink: true,
        allergies: true,
        avatarUrl: true,
      },
    });
    expect(result?.username).toBe('noa');
  });

  it('sets profile fields to null when cleared, and parses birthday to a Date when provided', async () => {
    prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ id: '1', ...data }));

    await service.updateProfile('1', {
      birthday: '1995-08-15',
      favoriteDrink: 'Mojito',
      allergies: '',
      avatarUrl: '',
    });

    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.data.birthday).toEqual(new Date('1995-08-15'));
    expect(updateArgs.data.favoriteDrink).toBe('Mojito');
    expect(updateArgs.data.allergies).toBeNull();
    expect(updateArgs.data.avatarUrl).toBeNull();
  });

  it('clears birthday to null when not provided', async () => {
    prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ id: '1', ...data }));

    await service.updateProfile('1', {});

    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.data.birthday).toBeNull();
  });
```

- [ ] **Step 3: Run the tests and verify they pass**

```bash
cd api && npx jest users.service.spec.ts
```

Expected: all tests pass, including the 3 new ones.

- [ ] **Step 4: Type-check and commit**

```bash
cd api && npx tsc --noEmit -p .
git add api/src/users/users.service.ts api/src/users/users.service.spec.ts
git commit -m "feat(api): add UsersService.findPublicById and updateProfile"
```

---

### Task 3: Self-service `GET/PATCH /auth/profile`

**Files:**
- Create: `api/src/auth/dto/update-profile.dto.ts`
- Modify: `api/src/auth/auth.service.ts` (add two methods)
- Modify: `api/src/auth/auth.controller.ts` (add two routes)
- Test: `api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `UsersService.findPublicById`/`updateProfile` (Task 2).
- Produces: `AuthService.getProfile(userId: string)`, `AuthService.updateProfile(userId: string, input: {...}): Promise<PublicUser>` (both throw `UnauthorizedException` if the user no longer exists — mirrors the existing `changePassword`'s null-check). `GET /auth/profile` and `PATCH /auth/profile`, both guarded by `JwtAuthGuard` only (no `RolesGuard`/`@Roles` — any authenticated user, editing only their own account).

**Why not `UsersController`**: it carries a class-level
`@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')` — every route on it is
admin-only regardless of what a specific method declares, so a non-admin
self-service route cannot live there. `AuthController` already hosts the
identical "current user acting on themselves" pattern via `change-password`
(`@UseGuards(JwtAuthGuard)` only, reading `req.user.sub` as the target),
which is the model these two new routes follow exactly.

- [ ] **Step 1: Create the DTO**

Create `api/src/auth/dto/update-profile.dto.ts`:

```ts
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  favoriteDrink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  allergies?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
```

(`@IsDateString()` rejects an empty string, which is why Task 6's frontend
action must omit the `birthday` key entirely from the request body when the
date input is empty, rather than sending `""` — see Task 6, Step 2.)

- [ ] **Step 2: Add the two `AuthService` methods**

In `api/src/auth/auth.service.ts`, add these two methods to the `AuthService`
class, right after `changePassword`:

```ts
  async getProfile(userId: string) {
    const user = await this.usersService.findPublicById(userId);
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    return user;
  }

  async updateProfile(
    userId: string,
    input: { birthday?: string; favoriteDrink?: string; allergies?: string; avatarUrl?: string },
  ) {
    const user = await this.usersService.findPublicById(userId);
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    return this.usersService.updateProfile(userId, input);
  }
```

- [ ] **Step 3: Add the two controller routes**

In `api/src/auth/auth.controller.ts`, change the import line from:

```ts
import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
```

to:

```ts
import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
```

Add this import alongside the existing DTO imports:

```ts
import { UpdateProfileDto } from './dto/update-profile.dto';
```

Then add these two methods at the end of the `AuthController` class, right
after `changePassword` (before the class's closing `}`):

```ts
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    const currentUser = req.user as JwtPayload;
    return this.authService.getProfile(currentUser.sub);
  }

  @Patch('profile')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const currentUser = req.user as JwtPayload;
    return this.authService.updateProfile(currentUser.sub, dto);
  }
```

- [ ] **Step 4: Write the failing tests**

Add this new `describe` block to `api/src/auth/auth.service.spec.ts`, at the
end of the file, just before the final closing `});`:

```ts
  describe('getProfile / updateProfile', () => {
    it('returns the full public profile', async () => {
      usersService.findPublicById = jest.fn().mockResolvedValue({
        id: '1',
        username: 'noa',
        birthday: null,
        favoriteDrink: null,
        allergies: null,
        avatarUrl: null,
      });

      const result = await service.getProfile('1');

      expect(result.username).toBe('noa');
    });

    it('rejects getProfile with UnauthorizedException when the user does not exist', async () => {
      usersService.findPublicById = jest.fn().mockResolvedValue(null);

      await expect(service.getProfile('ghost')).rejects.toThrow(UnauthorizedException);
    });

    it('updates the profile fields when the user exists', async () => {
      usersService.findPublicById = jest.fn().mockResolvedValue({ id: '1', username: 'noa' });
      usersService.updateProfile = jest.fn().mockResolvedValue({
        id: '1',
        username: 'noa',
        favoriteDrink: 'Mojito',
      });

      const result = await service.updateProfile('1', { favoriteDrink: 'Mojito' });

      expect(usersService.updateProfile).toHaveBeenCalledWith('1', { favoriteDrink: 'Mojito' });
      expect(result.favoriteDrink).toBe('Mojito');
    });

    it('rejects updateProfile with UnauthorizedException when the user does not exist', async () => {
      usersService.findPublicById = jest.fn().mockResolvedValue(null);

      await expect(service.updateProfile('ghost', {})).rejects.toThrow(UnauthorizedException);
    });
  });
```

(These tests attach `findPublicById`/`updateProfile` directly onto the
`usersService` mock object per-test, since the file's shared `beforeEach`
mock — used by every other test in the suite — doesn't declare them. This
mirrors how the file already handles per-suite mock needs without touching
the shared setup other suites depend on.)

- [ ] **Step 5: Run the tests and verify they pass**

```bash
cd api && npx jest auth.service.spec.ts
```

Expected: all tests pass, including the 4 new ones.

- [ ] **Step 6: Type-check and commit**

```bash
cd api && npx tsc --noEmit -p .
git add api/src/auth/dto/update-profile.dto.ts api/src/auth/auth.service.ts api/src/auth/auth.controller.ts api/src/auth/auth.service.spec.ts
git commit -m "feat(api): add self-service GET/PATCH /auth/profile"
```

---

### Task 4: Expose profile fields on the bar member roster

**Files:**
- Modify: `api/src/bars/bars.service.ts:11` (the `MEMBER_INCLUDE` constant)
- Modify: `api/src/bars/bars.service.spec.ts` (2 existing assertions)
- Modify: `src/lib/types.ts` (the `BarMember` interface)

**Interfaces:**
- Consumes: the four fields from Task 1.
- Produces: `BarMember.user` now includes `birthday`, `favoriteDrink`,
  `allergies`, `avatarUrl` (all `string | null`) alongside the existing
  `username` — Task 7's `/annuaire` page reads these directly off
  `listBarMembers()`'s existing return type.

**Scope note**: `bars.service.ts` has several *other* places that also
select `user.username` (`findAll`, `findOne`, `findDirectory`,
`findPendingRequests`) — those are for unrelated owner-name/requester-name
display and must NOT be touched. Only the shared `MEMBER_INCLUDE` constant
(used by exactly three methods: `findMembers`, `inviteMember`,
`updateMemberVip`) is in scope, since only `findMembers`'s consumer (the new
`/annuaire` roster) needs the new fields.

- [ ] **Step 1: Extend `MEMBER_INCLUDE`**

In `api/src/bars/bars.service.ts`, change:

```ts
const MEMBER_INCLUDE = { user: { select: { username: true } } } as const;
```

to:

```ts
const MEMBER_INCLUDE = {
  user: {
    select: {
      username: true,
      birthday: true,
      favoriteDrink: true,
      allergies: true,
      avatarUrl: true,
    },
  },
} as const;
```

- [ ] **Step 2: Update the two existing tests that hardcode the old shape**

`findMembers`'s own tests don't assert the exact `include` shape (they mock
`prisma.barMembership.findMany`'s return value directly), so they're
unaffected. Two other tests in `api/src/bars/bars.service.spec.ts` do assert
it and need updating.

In the `describe('inviteMember', ...)` block, find:

```ts
      expect(prisma.barMembership.create).toHaveBeenCalledWith({
        data: { barId: BAR_ID, userId: OTHER_ID, role: 'MEMBER', vip: true },
        include: { user: { select: { username: true } } },
      });
```

Change the `include` line to:

```ts
        include: {
          user: {
            select: {
              username: true,
              birthday: true,
              favoriteDrink: true,
              allergies: true,
              avatarUrl: true,
            },
          },
        },
```

In the `describe('updateMemberVip', ...)` block (a different `describe`
block further down the file — do not confuse it with `inviteMember`'s), find
the matching:

```ts
      expect(prisma.barMembership.update).toHaveBeenCalledWith({
        where: { id: 'm2' },
        data: { vip: true },
        include: { user: { select: { username: true } } },
      });
```

and apply the same `include` change as above.

- [ ] **Step 3: Update the frontend type**

In `src/lib/types.ts`, change the `BarMember` interface from:

```ts
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

to:

```ts
export interface BarMember {
  id: string;
  barId: string;
  userId: string;
  role: "OWNER" | "MEMBER";
  vip: boolean;
  createdAt: string;
  user: {
    username: string;
    birthday: string | null;
    favoriteDrink: string | null;
    allergies: string | null;
    avatarUrl: string | null;
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
cd api && npx jest bars.service.spec.ts
```

Expected: all tests pass, including the 2 updated ones.

- [ ] **Step 5: Type-check both projects and commit**

```bash
cd api && npx tsc --noEmit -p .
cd .. && npx tsc --noEmit -p .
git add api/src/bars/bars.service.ts api/src/bars/bars.service.spec.ts src/lib/types.ts
git commit -m "feat(api): expose profile fields on the bar member roster"
```

---

### Task 5: Generalize `ImagePicker` + self-service avatar upload

**Files:**
- Modify: `src/components/ImagePicker.tsx` (all of it)
- Modify: `src/app/stock/AddBottleForm.tsx:1-6` (imports) and `:105` (the `ImagePicker` call)
- Modify: `src/app/stock/BottleDetailModal.tsx:1-10` (imports) and `:221-225` (the `ImagePicker` call)
- Modify: `src/app/actions.ts` (add `uploadProfileImage`)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `<ImagePicker value={string} onChange={(url: string) => void} onUpload={(formData: FormData) => Promise<string | null>} label?={string} />` — Task 6's `ProfileForm` passes `uploadProfileImage` as `onUpload`. `uploadProfileImage(formData: FormData): Promise<string | null>` — same file-writing logic as the existing `uploadBottleImage`, gated to any logged-in user (not admin-only).

- [ ] **Step 1: Generalize `ImagePicker`**

In `src/components/ImagePicker.tsx`, change the import and prop signature
from:

```tsx
import { useState, useTransition, useRef } from "react";
import { uploadBottleImage } from "@/app/actions";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ImagePicker({
  value,
  onChange,
  label = "Photo de la bouteille",
}: ImagePickerProps) {
```

to:

```tsx
import { useState, useTransition, useRef } from "react";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  onUpload: (formData: FormData) => Promise<string | null>;
  label?: string;
}

export default function ImagePicker({
  value,
  onChange,
  onUpload,
  label = "Photo de la bouteille",
}: ImagePickerProps) {
```

Then, inside `handleFileChange`, change every call to `uploadBottleImage(formData)`
to `onUpload(formData)` (there is exactly one call site, inside the
`startUpload(async () => { ... })` block):

```tsx
        const uploadedUrl = await onUpload(formData);
```

Nothing else in the file changes — the rest of `handleFileChange`, the mode
toggle, and the JSX all stay exactly as they are today.

- [ ] **Step 2: Update `AddBottleForm`'s call site**

In `src/app/stock/AddBottleForm.tsx`, change the import line from:

```tsx
import { createBottle } from "@/app/actions";
```

to:

```tsx
import { createBottle, uploadBottleImage } from "@/app/actions";
```

Then change:

```tsx
        <ImagePicker value={imageUrl} onChange={setImageUrl} label="Photo du produit (Fichier local ou URL)" />
```

to:

```tsx
        <ImagePicker value={imageUrl} onChange={setImageUrl} onUpload={uploadBottleImage} label="Photo du produit (Fichier local ou URL)" />
```

- [ ] **Step 3: Update `BottleDetailModal`'s call site**

In `src/app/stock/BottleDetailModal.tsx`, change the import line from:

```tsx
import { updateBottleVolumes, updateBottleThreshold, deleteBottleAction } from "@/app/actions";
```

to:

```tsx
import { updateBottleVolumes, updateBottleThreshold, deleteBottleAction, uploadBottleImage } from "@/app/actions";
```

Then change:

```tsx
          <ImagePicker
            value={imageUrl}
            onChange={handleImageChange}
            label="Modifier la photo (Fichier local ou URL)"
          />
```

to:

```tsx
          <ImagePicker
            value={imageUrl}
            onChange={handleImageChange}
            onUpload={uploadBottleImage}
            label="Modifier la photo (Fichier local ou URL)"
          />
```

- [ ] **Step 4: Add `uploadProfileImage`**

In `src/app/actions.ts`, add this function right after `uploadBottleImage`:

```ts
export async function uploadProfileImage(formData: FormData): Promise<string | null> {
  await requireLoggedIn();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return null;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "png";
  const filename = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(uploadsDir, filename);

  await fs.writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit -p .
```

Expected: no errors. (`ImagePicker` now requires `onUpload` — both existing
callers were updated in Steps 2-3, so nothing is left passing the old,
narrower prop set.)

- [ ] **Step 6: Commit**

```bash
git add src/components/ImagePicker.tsx src/app/stock/AddBottleForm.tsx src/app/stock/BottleDetailModal.tsx src/app/actions.ts
git commit -m "feat(web): generalize ImagePicker and add self-service avatar upload"
```

---

### Task 6: Self-service profile page — `/profil`

**Files:**
- Modify: `src/lib/api-client.ts` (add `getMyProfile`/`updateMyProfile`)
- Modify: `src/lib/types.ts` (add the `MyProfile` interface)
- Create: `src/app/profil/actions.ts`
- Create: `src/app/profil/ProfileForm.tsx`
- Create: `src/app/profil/page.tsx`
- Modify: `src/components/AccountMenu.tsx` (add the "Mon profil" link)

**Interfaces:**
- Consumes: `GET/PATCH /auth/profile` (Task 3), `<ImagePicker onUpload={...} />` and `uploadProfileImage` (Task 5).
- Produces: the `/profil` route, reachable from `AccountMenu`.

- [ ] **Step 1: Add the `MyProfile` type**

In `src/lib/types.ts`, add this new interface (anywhere alongside the other
top-level interfaces, e.g. right after `BarMember`):

```ts
export interface MyProfile {
  id: string;
  username: string;
  birthday: string | null;
  favoriteDrink: string | null;
  allergies: string | null;
  avatarUrl: string | null;
}
```

- [ ] **Step 2: Add the api-client functions**

In `src/lib/api-client.ts`, add these two functions in the "Users" section
(right after the existing `deleteUser` function):

```ts
export function getMyProfile(): Promise<MyProfile> {
  return request<MyProfile>("/auth/profile");
}

export function updateMyProfile(input: {
  birthday?: string;
  favoriteDrink?: string;
  allergies?: string;
  avatarUrl?: string;
}): Promise<MyProfile> {
  return request<MyProfile>("/auth/profile", { method: "PATCH", body: JSON.stringify(input) });
}
```

Add `MyProfile` to the existing `import type { ... } from "./types"` block
at the top of the file.

- [ ] **Step 3: Create the server action**

Create `src/app/profil/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyProfile, updateMyProfile } from "@/lib/api-client";
import { getSession } from "@/lib/session";

export async function updateProfileAction(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const session = await getSession();
  if (!session) redirect("/login");

  const birthday = String(formData.get("birthday") ?? "").trim();
  const favoriteDrink = String(formData.get("favoriteDrink") ?? "").trim();
  const allergies = String(formData.get("allergies") ?? "").trim();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();

  const input: {
    birthday?: string;
    favoriteDrink: string;
    allergies: string;
    avatarUrl: string;
  } = { favoriteDrink, allergies, avatarUrl };
  if (birthday) input.birthday = birthday;

  try {
    await updateMyProfile(input);
  } catch {
    return { error: "Impossible d'enregistrer le profil." };
  }

  revalidatePath("/profil");
  revalidatePath("/annuaire");
}
```

(`birthday` is only included in the request body when non-empty — the
backend's `@IsDateString()` validation on `UpdateProfileDto.birthday`
rejects an empty string, so clearing the date must omit the key entirely
rather than send `""`. The three string fields don't have this restriction,
so they're always included — an empty string there correctly clears that
field server-side, per `UsersService.updateProfile`'s `|| null` fallback.)

Also export a function the page uses to fetch current data:

```ts
export async function getMyProfileForForm() {
  const session = await getSession();
  if (!session) redirect("/login");
  return getMyProfile();
}
```

- [ ] **Step 4: Create the form component**

Create `src/app/profil/ProfileForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import type { MyProfile } from "@/lib/types";
import { uploadProfileImage } from "@/app/actions";
import ImagePicker from "@/components/ImagePicker";
import { updateProfileAction } from "./actions";

export default function ProfileForm({ profile }: { profile: MyProfile }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="avatarUrl" value={avatarUrl} />
      <ImagePicker
        value={avatarUrl}
        onChange={setAvatarUrl}
        onUpload={uploadProfileImage}
        label="Photo de profil"
      />

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">
          Anniversaire
        </label>
        <input
          name="birthday"
          type="date"
          defaultValue={profile.birthday ? profile.birthday.slice(0, 10) : ""}
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">
          Boisson préférée
        </label>
        <input
          name="favoriteDrink"
          defaultValue={profile.favoriteDrink ?? ""}
          placeholder="Ex: Mojito"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">
          Allergies / restrictions
        </label>
        <input
          name="allergies"
          defaultValue={profile.allergies ?? ""}
          placeholder="Ex: Fruits à coque, sans alcool..."
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-orange text-ink font-semibold rounded-lg py-2.5 hover:bg-cream transition-colors uppercase tracking-caps text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Enregistrement..." : "Enregistrer mon profil"}
      </button>

      {saved && (
        <div className="text-xs bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-emerald-300 text-center font-semibold uppercase tracking-caps">
          ✓ Profil enregistré !
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 5: Create the page**

Create `src/app/profil/page.tsx`:

```tsx
import PageTransition from "@/components/PageTransition";
import ProfileForm from "./ProfileForm";
import { getMyProfileForForm } from "./actions";

export default async function ProfilPage() {
  const profile = await getMyProfileForForm();

  return (
    <PageTransition className="space-y-8 max-w-lg">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Mon Compte</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Mon Profil
        </h1>
        <p className="text-muted text-xs mt-2">
          Ces informations sont visibles par les membres de tes bars, dans l&apos;annuaire.
        </p>
      </div>

      <ProfileForm profile={profile} />
    </PageTransition>
  );
}
```

- [ ] **Step 6: Add the "Mon profil" link to `AccountMenu`**

In `src/components/AccountMenu.tsx`, add a new `<Link>` right after the
"Compte"/"Privilèges Administrateur" header block (the `<div className="px-2 py-1.5 border-b ...">` block) and before the existing admin-only
`{isAdmin && (...)}` block:

```tsx
              <Link
                href="/profil"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-cream hover:bg-white/[0.06] transition-colors w-full"
              >
                <span>Mon profil</span>
                <span className="text-orange">→</span>
              </Link>
```

This is visible to every logged-in user (not wrapped in `{isAdmin && ...}`),
placed above the existing admin-only "Gestion des comptes" link.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit -p .
```

Expected: no errors.

- [ ] **Step 8: Manual verification**

With the dev stack running (web, API, Postgres):

1. Log in as any user, open the account menu, confirm "Mon profil" appears
   (for both admin and non-admin accounts) and navigates to `/profil`.
2. Fill in a birthday, favorite drink, and allergies, save, confirm the "✓
   Profil enregistré !" message and that reloading the page shows the saved
   values pre-filled.
3. Clear the birthday field and save — confirm it's actually cleared on
   reload (not left as the previous value).
4. Upload a local image as the profile photo, confirm it uploads and
   previews correctly (same interaction as the existing bottle-image
   upload, just a different upload endpoint under the hood).

If no dev stack is reachable, note that explicitly instead of skipping this
step silently.

- [ ] **Step 9: Commit**

```bash
git add src/lib/api-client.ts src/lib/types.ts src/app/profil/ src/components/AccountMenu.tsx
git commit -m "feat(web): add self-service profile page"
```

---

### Task 7: Bar member roster — `/annuaire`

**Files:**
- Create: `src/app/annuaire/page.tsx`
- Modify: `src/components/Navigation.tsx` (add the nav entry)

**Interfaces:**
- Consumes: `listBarMembers(barId: string): Promise<BarMember[]>` (existing, now returning the expanded `user` shape from Task 4), `resolveActiveBar` (existing, already used by `/soirees`).
- Produces: the `/annuaire` route.

- [ ] **Step 1: Create the roster page**

Create `src/app/annuaire/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { listMyBars, listBarMembers } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";

function formatBirthday(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export default async function AnnuairePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const members = await listBarMembers(activeBar.id);

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>{activeBar.name}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Annuaire des membres
        </h1>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="rounded-2xl bg-ink-2/60 border border-white/[0.08] p-5 shadow-xl space-y-3"
          >
            <div className="flex items-center gap-3">
              {member.user.avatarUrl ? (
                <img
                  src={member.user.avatarUrl}
                  alt={member.user.username}
                  className="w-12 h-12 rounded-xl object-cover border border-white/[0.08]"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-ink border border-white/[0.08] flex items-center justify-center font-display text-base font-bold text-gold">
                  {member.user.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-sm text-cream">{member.user.username}</p>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white/[0.05] text-muted">
                  {member.role === "OWNER" ? "Propriétaire" : "Membre"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-muted">
              {member.user.birthday && (
                <p>🎂 {formatBirthday(member.user.birthday)}</p>
              )}
              {member.user.favoriteDrink && (
                <p>🍹 {member.user.favoriteDrink}</p>
              )}
              {member.user.allergies && (
                <p>⚠️ {member.user.allergies}</p>
              )}
              {!member.user.birthday && !member.user.favoriteDrink && !member.user.allergies && (
                <p className="italic text-muted/60">Profil non renseigné.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Add the nav entry**

In `src/components/Navigation.tsx`, add `/annuaire` to the base `NAV` array
(visible to any logged-in user, alongside Stock/Cocktails/Soirées):

```ts
const NAV = [
  { href: "/stock", label: "Cave & Stock" },
  { href: "/cocktails", label: "Cocktails" },
  { href: "/soirees", label: "Soirées" },
  { href: "/annuaire", label: "Annuaire" },
];
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p .
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

With the dev stack running:

1. As a user who's a member of a bar (owner or regular member — not just
   the owner), visit `/annuaire` and confirm the roster renders, including
   entries for members who haven't filled in a profile ("Profil non
   renseigné.").
2. Fill in your own profile via `/profil` (birthday, drink, allergies,
   photo), then revisit `/annuaire` and confirm your card now shows all of
   it — birthday as day + month only (e.g. "15 août", not "15 août 1995").
3. If you have a second test account that's a regular (non-owner) member of
   the same bar, confirm it can also reach `/annuaire` and see the same
   roster — this is the point of not reusing the owner-only `/membres`.

If no dev stack is reachable, note that explicitly instead of skipping this
step silently.

- [ ] **Step 5: Commit**

```bash
git add src/app/annuaire/ src/components/Navigation.tsx
git commit -m "feat(web): add member roster page (/annuaire)"
```
