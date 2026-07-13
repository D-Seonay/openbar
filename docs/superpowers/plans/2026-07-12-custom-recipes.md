# Recettes custom — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let VIP and Admin accounts create, edit and delete their own custom cocktail recipes, stored in Postgres, merged into the same cocktail grid as the 20+ hardcoded official recipes.

**Architecture:** Monorepo with a NestJS+Prisma API (`api/`) and a Next.js App Router frontend (`src/`) that never touches the DB directly — all calls go through `src/lib/api-client.ts`. A new `Recipe` Prisma model + `recipes` NestJS module (CRUD, same pattern as `bottles`) is merged at read time with the hardcoded `COCKTAILS` array inside `CocktailsService.evaluate()`. The frontend adds a create/edit modal and edit/delete affordances in the existing `CocktailStudio.tsx` master-detail view.

**Tech Stack:** NestJS 11, Prisma (Postgres), class-validator, Jest/ts-jest (`api/`), Next.js 16 App Router, React 19, Server Actions, framer-motion, Tailwind v4.

## Global Constraints

- Creation is restricted to VIP or Admin accounts (`canSeeVip()` in `api/src/auth/vip.util.ts`: `role === 'ADMIN' || vip === true`).
- Custom recipes appear mixed into the same list as the 20+ hardcoded official recipes (no separate section).
- Custom recipes use the existing tag-matching system for stock availability — no free-text ingredient tags.
- The 20+ official recipes stay hardcoded in `api/src/cocktails/cocktails.data.ts`; only custom recipes go to Postgres. The displayed list is a read-time merge.
- Edit/delete is restricted to the recipe's creator or an Admin.
- A custom recipe can be flagged VIP-only (visible to VIP/Admin only) at creation time, independent of the existing `usesVip` computed flag.
- Create/edit form fields are all required: name, tags, ingredientsList, instructions, glass, prepTime, difficulty, description.
- `RecipeDifficulty` Prisma enum values are `Facile`/`Moyen`/`Expert` (not `ALL_CAPS`), matching the existing `CocktailRecipe.difficulty` TS union exactly, to avoid a translation layer — confirmed with the user in brainstorming.

Full context: `docs/superpowers/specs/2026-07-12-custom-recipes-design.md`

---

## Task 1: Prisma schema — `Recipe` model

**Files:**
- Modify: `api/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `Recipe` (fields: `id`, `name`, `glass?`, `tags: String[]`, `ingredientsList: String[]`, `instructions: String[]`, `prepTime`, `difficulty: RecipeDifficulty`, `description`, `vip: Boolean`, `createdById`, `createdBy: User`, `createdAt`), enum `RecipeDifficulty` (`Facile`, `Moyen`, `Expert`), and `User.recipes: Recipe[]`. Generated via `@prisma/client` as `Recipe`, `RecipeDifficulty`.

- [ ] **Step 1: Add the `RecipeDifficulty` enum and `Recipe` model to the schema**

In `api/prisma/schema.prisma`, add this enum right after the existing `BottleType` enum (after line 27):

```prisma
enum RecipeDifficulty {
  Facile
  Moyen
  Expert
}
```

Add this model at the end of the file (after the `StockAdjustment` model):

```prisma
model Recipe {
  id              String           @id @default(cuid())
  name            String
  glass           String?
  tags            String[]
  ingredientsList String[]
  instructions    String[]
  prepTime        String
  difficulty      RecipeDifficulty @default(Moyen)
  description     String
  vip             Boolean          @default(false)
  createdById     String
  createdBy       User             @relation(fields: [createdById], references: [id])
  createdAt       DateTime         @default(now())
}
```

- [ ] **Step 2: Add the back-relation on `User`**

In `api/prisma/schema.prisma`, modify the `User` model (currently ending with `contributions Contribution[]`):

```prisma
model User {
  id            String         @id @default(cuid())
  username      String         @unique
  passwordHash  String
  role          Role           @default(USER)
  vip           Boolean        @default(false)
  createdAt     DateTime       @default(now())
  contributions Contribution[]
  recipes       Recipe[]
}
```

- [ ] **Step 3: Validate the schema**

Run (from `api/`): `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Ensure the local Postgres container is running**

Run (from repo root): `docker compose up -d`
Expected: `db` service listed as `Running` or `Up`.

- [ ] **Step 5: Generate and apply the migration**

Run (from `api/`): `npx prisma migrate dev --name add_recipe_model`
Expected: output ending with `Your database is now in sync with your schema.` and a new folder under `api/prisma/migrations/<timestamp>_add_recipe_model/` containing `migration.sql`. This also regenerates the Prisma client, so `Recipe` and `RecipeDifficulty` become available from `@prisma/client`.

- [ ] **Step 6: Run the existing test suite to confirm nothing broke**

Run (from `api/`): `npm test`
Expected: all existing suites (`bottles.service.spec.ts`, `cocktails.service.spec.ts`, etc.) still PASS.

- [ ] **Step 7: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add Recipe model for custom cocktail recipes"
```

---

## Task 2: `recipes` module — DTOs, service, controller

**Files:**
- Create: `api/src/recipes/dto/create-recipe.dto.ts`
- Create: `api/src/recipes/dto/update-recipe.dto.ts`
- Create: `api/src/recipes/recipes.service.ts`
- Create: `api/src/recipes/recipes.service.spec.ts`
- Create: `api/src/recipes/recipes.controller.ts`
- Create: `api/src/recipes/recipes.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (`api/src/prisma/prisma.service.ts`, `@Global()` so no explicit import needed in the module), `JwtAuthGuard` (`api/src/auth/jwt-auth.guard.ts`), `JwtPayload` type + `canSeeVip()` (`api/src/auth/auth.service.ts`, `api/src/auth/vip.util.ts`), `Recipe`/`RecipeDifficulty` from `@prisma/client` (Task 1).
- Produces: `RecipesService` with `findVisible(includeVip: boolean)`, `findOne(id: string)`, `create(dto: CreateRecipeDto, userId: string)`, `update(id: string, dto: UpdateRecipeDto, user: JwtPayload)`, `remove(id: string, user: JwtPayload)` — all returning Prisma `Recipe` rows with `createdBy: { username: true }` included. `RecipesController` exposing `POST /recipes`, `PATCH /recipes/:id`, `DELETE /recipes/:id`. `RecipesModule` exporting `RecipesService`, registered in `AppModule`.

- [ ] **Step 1: Write the failing service test**

Create `api/src/recipes/recipes.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';

describe('RecipesService', () => {
  let service: RecipesService;
  let prisma: { recipe: Record<string, jest.Mock> };

  const owner: JwtPayload = { sub: 'user-1', username: 'alice', role: 'USER', vip: true };
  const otherUser: JwtPayload = { sub: 'user-2', username: 'bob', role: 'USER', vip: true };
  const admin: JwtPayload = { sub: 'admin-1', username: 'root', role: 'ADMIN', vip: false };

  beforeEach(async () => {
    prisma = {
      recipe: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [RecipesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RecipesService);
  });

  it('excludes VIP recipes from the query when includeVip is false', async () => {
    await service.findVisible(false);

    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { vip: false },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('does not filter by vip when includeVip is true', async () => {
    await service.findVisible(true);

    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: undefined,
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('throws NotFoundException when updating a recipe that does not exist', async () => {
    prisma.recipe.findUnique.mockResolvedValue(null);

    await expect(service.update('missing-id', { name: 'X' }, owner)).rejects.toThrow(NotFoundException);
  });

  it('allows the creator to update their own recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });
    prisma.recipe.update.mockResolvedValue({ id: 'recipe-1', name: 'Updated' });

    const result = await service.update('recipe-1', { name: 'Updated' }, owner);

    expect(result).toEqual({ id: 'recipe-1', name: 'Updated' });
    expect(prisma.recipe.update).toHaveBeenCalledWith({
      where: { id: 'recipe-1' },
      data: { name: 'Updated' },
      include: { createdBy: { select: { username: true } } },
    });
  });

  it('forbids a non-owner, non-admin from updating a recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });

    await expect(service.update('recipe-1', { name: 'Hacked' }, otherUser)).rejects.toThrow(ForbiddenException);
  });

  it('allows an admin to update any recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });
    prisma.recipe.update.mockResolvedValue({ id: 'recipe-1', name: 'Updated by admin' });

    const result = await service.update('recipe-1', { name: 'Updated by admin' }, admin);

    expect(result).toEqual({ id: 'recipe-1', name: 'Updated by admin' });
  });

  it('forbids a non-owner, non-admin from deleting a recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });

    await expect(service.remove('recipe-1', otherUser)).rejects.toThrow(ForbiddenException);
  });

  it('allows the creator to delete their own recipe', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'recipe-1', createdById: owner.sub });
    prisma.recipe.delete.mockResolvedValue({ id: 'recipe-1' });

    const result = await service.remove('recipe-1', owner);

    expect(result).toEqual({ success: true });
    expect(prisma.recipe.delete).toHaveBeenCalledWith({ where: { id: 'recipe-1' } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `api/`): `npx jest recipes/recipes.service.spec.ts`
Expected: FAIL — `Cannot find module './recipes.service'`.

- [ ] **Step 3: Create the DTOs**

Create `api/src/recipes/dto/create-recipe.dto.ts`:

```ts
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsString } from 'class-validator';
import { RecipeDifficulty } from '@prisma/client';

export class CreateRecipeDto {
  @IsString()
  name: string;

  @IsString()
  glass: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tags: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ingredientsList: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  instructions: string[];

  @IsString()
  prepTime: string;

  @IsEnum(RecipeDifficulty)
  difficulty: RecipeDifficulty;

  @IsString()
  description: string;

  @IsBoolean()
  vip: boolean;
}
```

Create `api/src/recipes/dto/update-recipe.dto.ts`:

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateRecipeDto } from './create-recipe.dto';

export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {}
```

- [ ] **Step 4: Implement `RecipesService`**

Create `api/src/recipes/recipes.service.ts`:

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  findVisible(includeVip: boolean) {
    return this.prisma.recipe.findMany({
      where: includeVip ? undefined : { vip: false },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: { createdBy: { select: { username: true } } },
    });
    if (!recipe) throw new NotFoundException('Recette introuvable');
    return recipe;
  }

  create(dto: CreateRecipeDto, userId: string) {
    return this.prisma.recipe.create({
      data: { ...dto, createdById: userId },
      include: { createdBy: { select: { username: true } } },
    });
  }

  async update(id: string, dto: UpdateRecipeDto, user: JwtPayload) {
    const recipe = await this.findOne(id);
    this.assertOwnerOrAdmin(recipe, user);
    return this.prisma.recipe.update({
      where: { id },
      data: dto,
      include: { createdBy: { select: { username: true } } },
    });
  }

  async remove(id: string, user: JwtPayload) {
    const recipe = await this.findOne(id);
    this.assertOwnerOrAdmin(recipe, user);
    await this.prisma.recipe.delete({ where: { id } });
    return { success: true };
  }

  private assertOwnerOrAdmin(recipe: { createdById: string }, user: JwtPayload) {
    if (recipe.createdById !== user.sub && user.role !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres recettes');
    }
  }
}
```

Each method inlines `include: { createdBy: { select: { username: true } } }` directly, matching the `BottlesService` style of not over-abstracting a two-line include clause.

- [ ] **Step 5: Run the test to verify it passes**

Run (from `api/`): `npx jest recipes/recipes.service.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Implement `RecipesController`**

Create `api/src/recipes/recipes.controller.ts`:

```ts
import { Body, Controller, Delete, ForbiddenException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { canSeeVip } from '../auth/vip.util';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() dto: CreateRecipeDto) {
    const user = req.user as JwtPayload;
    if (!canSeeVip(user)) {
      throw new ForbiddenException('Réservé aux comptes VIP ou Admin');
    }
    return this.recipesService.create(dto, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateRecipeDto) {
    return this.recipesService.update(id, dto, req.user as JwtPayload);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.recipesService.remove(id, req.user as JwtPayload);
  }
}
```

- [ ] **Step 7: Create the module and register it**

Create `api/src/recipes/recipes.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';

@Module({
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
```

Modify `api/src/app.module.ts` — add the import and register it in the `imports` array:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BottlesModule } from './bottles/bottles.module';
import { CocktailsModule } from './cocktails/cocktails.module';
import { EventsModule } from './events/events.module';
import { ContributionsModule } from './contributions/contributions.module';
import { StockAdjustmentsModule } from './stock-adjustments/stock-adjustments.module';
import { RecipesModule } from './recipes/recipes.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    BottlesModule,
    CocktailsModule,
    EventsModule,
    ContributionsModule,
    StockAdjustmentsModule,
    RecipesModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Build to verify the controller and module compile**

Run (from `api/`): `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add api/src/recipes api/src/app.module.ts
git commit -m "feat(api): add recipes CRUD module with owner/admin permissions"
```

---

## Task 3: Merge custom recipes into `GET /cocktails`

**Files:**
- Modify: `api/src/cocktails/cocktails.data.ts`
- Modify: `api/src/cocktails/cocktails.service.ts`
- Modify: `api/src/cocktails/cocktails.module.ts`
- Modify: `api/src/cocktails/cocktails.service.spec.ts`

**Interfaces:**
- Consumes: `RecipesService.findVisible(includeVip)` (Task 2), `Recipe` shape returned (includes `createdBy: { username }`).
- Produces: `evaluateRecipes(bottles: StockLike[], recipes: CocktailRecipe[] = COCKTAILS)` (new second parameter, backward compatible), `CocktailRecipe` type gains `isCustom?: boolean`, `createdById?: string`, `createdByUsername?: string`, `vip?: boolean`. `CocktailsService.evaluate(includeVip)` return value now includes custom recipes merged in.

- [ ] **Step 1: Extend the `CocktailRecipe` interface**

In `api/src/cocktails/cocktails.data.ts`, modify the interface at the top of the file:

```ts
export interface CocktailRecipe {
  id: string;
  name: string;
  glass?: string;
  tags: string[]; // required ingredient tags (lowercase) for stock matching
  ingredientsList: string[]; // detailed human-readable ingredients with quantities
  instructions: string[]; // step-by-step instructions
  prepTime: string; // e.g., "5 min"
  difficulty: "Facile" | "Moyen" | "Expert";
  description: string;
  isCustom?: boolean;
  createdById?: string;
  createdByUsername?: string;
  vip?: boolean;
}
```

Leave the rest of the file (the `COCKTAILS` array) untouched.

- [ ] **Step 2: Write failing tests for the new `evaluateRecipes` parameter**

In `api/src/cocktails/cocktails.service.spec.ts`, add these two tests inside the existing `describe('evaluateRecipes', ...)` block, after the last test (`'excludes VIP bottles entirely...'`):

```ts
  it('evaluates a custom recipe list when provided instead of the default catalog', () => {
    const customRecipe = {
      id: 'custom-1',
      name: 'Custom Punch',
      tags: ['rhum blanc'],
      ingredientsList: ['6cl rhum blanc'],
      instructions: ['Mélanger'],
      prepTime: '2 min',
      difficulty: 'Facile' as const,
      description: 'Une recette maison',
    };
    const bottles = [bottle({ tags: ['rhum blanc'] })];
    const results = evaluateRecipes(bottles, [customRecipe]);

    expect(results).toHaveLength(1);
    expect(results[0].recipe.id).toBe('custom-1');
    expect(results[0].makeable).toBe(true);
  });

  it('merges custom recipes alongside the official catalog when both are passed', () => {
    const customRecipe = {
      id: 'custom-2',
      name: 'Custom Sour',
      tags: ['whisky'],
      ingredientsList: ['5cl whisky'],
      instructions: ['Shaker'],
      prepTime: '3 min',
      difficulty: 'Moyen' as const,
      description: 'Une variante maison',
    };
    const results = evaluateRecipes([], [...COCKTAILS, customRecipe]);

    expect(results).toHaveLength(COCKTAILS.length + 1);
    expect(results.some((r) => r.recipe.id === 'custom-2')).toBe(true);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `api/`): `npx jest cocktails/cocktails.service.spec.ts`
Expected: FAIL — `evaluateRecipes` ignores the second argument (both new tests fail, existing ones still pass).

- [ ] **Step 4: Update `evaluateRecipes` to accept a recipe list**

In `api/src/cocktails/cocktails.service.ts`, replace the `evaluateRecipes` function signature and body:

```ts
export function evaluateRecipes(
  bottles: StockLike[],
  recipes: CocktailRecipe[] = COCKTAILS,
): RecipeAvailability[] {
  const inStock = bottles.filter((b) => b.quantity > 0);

  function bestMatch(tag: string) {
    const candidates = inStock.filter((b) => b.tags.map(normalize).includes(normalize(tag)));
    if (candidates.length === 0) return null;
    return candidates.find((b) => !b.vip) ?? candidates[0];
  }

  return recipes.map((recipe) => {
    const missingTags: string[] = [];
    let usesVip = false;
    for (const tag of recipe.tags) {
      const match = bestMatch(tag);
      if (!match) {
        missingTags.push(tag);
      } else if (match.vip) {
        usesVip = true;
      }
    }
    return { recipe, makeable: missingTags.length === 0, usesVip, missingTags };
  });
}
```

(Only the function signature changed — `COCKTAILS.map` became `recipes.map`, and the default parameter value is `COCKTAILS`.)

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `api/`): `npx jest cocktails/cocktails.service.spec.ts`
Expected: PASS, all tests including the 2 new ones.

- [ ] **Step 6: Wire `CocktailsService` to merge custom recipes from the database**

Replace the `CocktailsService` class in `api/src/cocktails/cocktails.service.ts` (keep the `evaluateRecipes` function and `RecipeAvailability`/`StockLike`/`normalize` above it unchanged):

```ts
import { Injectable } from '@nestjs/common';
import { BottlesService } from '../bottles/bottles.service';
import { RecipesService } from '../recipes/recipes.service';
import { COCKTAILS, type CocktailRecipe } from './cocktails.data';

// ... (RecipeAvailability, StockLike, normalize, evaluateRecipes stay as in Step 4) ...

@Injectable()
export class CocktailsService {
  constructor(
    private readonly bottlesService: BottlesService,
    private readonly recipesService: RecipesService,
  ) {}

  async evaluate(includeVip: boolean): Promise<RecipeAvailability[]> {
    const [bottles, customRecipes] = await Promise.all([
      this.bottlesService.findAll(includeVip),
      this.recipesService.findVisible(includeVip),
    ]);

    const mapped: CocktailRecipe[] = customRecipes.map((r) => ({
      id: r.id,
      name: r.name,
      glass: r.glass ?? undefined,
      tags: r.tags,
      ingredientsList: r.ingredientsList,
      instructions: r.instructions,
      prepTime: r.prepTime,
      difficulty: r.difficulty,
      description: r.description,
      isCustom: true,
      createdById: r.createdById,
      createdByUsername: r.createdBy.username,
      vip: r.vip,
    }));

    return evaluateRecipes(bottles, [...COCKTAILS, ...mapped]);
  }
}
```

- [ ] **Step 7: Import `RecipesModule` in `CocktailsModule`**

Replace `api/src/cocktails/cocktails.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { BottlesModule } from '../bottles/bottles.module';
import { RecipesModule } from '../recipes/recipes.module';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';

@Module({
  imports: [BottlesModule, RecipesModule],
  controllers: [CocktailsController],
  providers: [CocktailsService],
})
export class CocktailsModule {}
```

- [ ] **Step 8: Build and run the full API test suite**

Run (from `api/`): `npm run build && npm test`
Expected: build exits 0; all test suites PASS.

- [ ] **Step 9: Commit**

```bash
git add api/src/cocktails
git commit -m "feat(api): merge custom recipes into the cocktail evaluation endpoint"
```

---

## Task 4: Frontend types and `api-client.ts` functions

**Files:**
- Modify: `src/lib/cocktail-types.ts`
- Modify: `src/lib/api-client.ts`

**Interfaces:**
- Consumes: nothing new (mirrors the backend `CocktailRecipe` shape from Task 3).
- Produces: `CocktailRecipe` (frontend) gains `isCustom?`, `createdById?`, `createdByUsername?`, `vip?`. New `RecipeInput` type. `createRecipe(input: RecipeInput): Promise<CocktailRecipe>`, `updateRecipe(id: string, input: Partial<RecipeInput>): Promise<CocktailRecipe>`, `deleteRecipe(id: string): Promise<{ success: boolean }>` exported from `src/lib/api-client.ts`.

- [ ] **Step 1: Extend the frontend `CocktailRecipe` type**

Replace `src/lib/cocktail-types.ts` entirely:

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
  isCustom?: boolean;
  createdById?: string;
  createdByUsername?: string;
  vip?: boolean;
}

export interface RecipeAvailability {
  recipe: CocktailRecipe;
  makeable: boolean;
  usesVip: boolean;
  missingTags: string[];
}
```

- [ ] **Step 2: Add `RecipeInput` type and CRUD functions to `api-client.ts`**

In `src/lib/api-client.ts`, modify the import line that currently reads:

```ts
import type { RecipeAvailability } from "./cocktail-types";
```

to:

```ts
import type { CocktailRecipe, RecipeAvailability } from "./cocktail-types";
```

Then, immediately after the existing `evaluateCocktails` function (the `// Cocktails` section, right before `// Users`), add:

```ts
export interface RecipeInput {
  name: string;
  glass: string;
  tags: string[];
  ingredientsList: string[];
  instructions: string[];
  prepTime: string;
  difficulty: "Facile" | "Moyen" | "Expert";
  description: string;
  vip: boolean;
}

export function createRecipe(input: RecipeInput): Promise<CocktailRecipe> {
  return request<CocktailRecipe>("/recipes", { method: "POST", body: JSON.stringify(input) });
}

export function updateRecipe(id: string, input: Partial<RecipeInput>): Promise<CocktailRecipe> {
  return request<CocktailRecipe>(`/recipes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteRecipe(id: string): Promise<{ success: boolean }> {
  return request(`/recipes/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 3: Type-check**

Run (from repo root): `npx tsc --noEmit -p .`
Expected: no errors related to `cocktail-types.ts` or `api-client.ts`. (Pre-existing unrelated errors, if any, are not in scope.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/cocktail-types.ts src/lib/api-client.ts
git commit -m "feat(web): add recipe CRUD types and api-client functions"
```

---

## Task 5: Move `ConfirmDeleteModal` to shared components

**Files:**
- Create: `src/components/ConfirmDeleteModal.tsx`
- Delete: `src/app/stock/ConfirmDeleteModal.tsx`
- Modify: `src/app/stock/BottleDetailModal.tsx:6`

**Interfaces:**
- Produces: `src/components/ConfirmDeleteModal.tsx` default-exporting the same component with the same props (`isOpen`, `title`, `description`, `onConfirm`, `onCancel`, `isPending?`) — used by both the stock page (Task-unrelated, existing usage) and the new recipe delete flow (Task 8).

This is a pure relocation (no behavior change) so it can reuse the shared modal for recipe deletion in Task 8 instead of duplicating it.

- [ ] **Step 1: Create the shared component**

Create `src/components/ConfirmDeleteModal.tsx` with the exact current content of `src/app/stock/ConfirmDeleteModal.tsx`:

```tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export default function ConfirmDeleteModal({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  isPending,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onCancel}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/90 backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-ink-2/95 border border-red-500/30 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-xl text-red-400 shrink-0">
              🗑️
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-cream">
                {title}
              </h3>
              <p className="text-xs text-muted mt-0.5">{description}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <button
              onClick={onCancel}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-cream transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25 transition-all cursor-pointer"
            >
              {isPending ? "Suppression..." : "Confirmer la suppression"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Delete the old file**

```bash
git rm src/app/stock/ConfirmDeleteModal.tsx
```

- [ ] **Step 3: Update the import in `BottleDetailModal.tsx`**

In `src/app/stock/BottleDetailModal.tsx`, change line 9 from:

```ts
import ConfirmDeleteModal from "./ConfirmDeleteModal";
```

to:

```ts
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
```

- [ ] **Step 4: Type-check**

Run (from repo root): `npx tsc --noEmit -p .`
Expected: no errors about missing `./ConfirmDeleteModal` module.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConfirmDeleteModal.tsx src/app/stock/BottleDetailModal.tsx
git commit -m "refactor(web): move ConfirmDeleteModal to shared components"
```

---

## Task 6: Server actions for recipe CRUD

**Files:**
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `createRecipe`, `updateRecipe`, `deleteRecipe` from `src/lib/api-client.ts` (Task 4), `getSession` from `src/lib/session.ts` (existing).
- Produces: `requireVipOrAdmin(): Promise<void>`, `createRecipe(formData: FormData): Promise<void>`, `updateRecipe(id: string, formData: FormData): Promise<void>`, `deleteRecipeAction(id: string): Promise<void>` exported from `src/app/actions.ts`. (Note: `createRecipe`/`updateRecipe` are the *action* names in `actions.ts` — distinct from the same-named functions imported as `api.createRecipe`/`api.updateRecipe` from `api-client.ts`, since `actions.ts` imports the client module as `import * as api from "@/lib/api-client"`, so there is no naming collision.)

- [ ] **Step 1: Add `getSession` to the session import**

In `src/app/actions.ts`, change the import:

```ts
import { isAdminLoggedIn } from "@/lib/session";
```

to:

```ts
import { isAdminLoggedIn, getSession } from "@/lib/session";
```

- [ ] **Step 2: Add the `requireVipOrAdmin` guard**

In `src/app/actions.ts`, right after the existing `requireAdmin` function:

```ts
async function requireAdmin() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }
}

async function requireVipOrAdmin() {
  const session = await getSession();
  if (!session || !(session.vip || session.role === "ADMIN")) {
    redirect("/login");
  }
}
```

- [ ] **Step 3: Add the recipe actions**

Add this block anywhere after `parseTags` and before the `// Users` section of `src/app/actions.ts` (placing it right after the existing bottle actions, near `updateBottleQuantity`, keeps related cocktail-page actions together):

```ts
function parseJsonStringArray(raw: FormDataEntryValue | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
  } catch {
    return [];
  }
}

function parseRecipeFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const glass = String(formData.get("glass") ?? "").trim();
  const prepTime = String(formData.get("prepTime") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "Moyen") as "Facile" | "Moyen" | "Expert";
  const description = String(formData.get("description") ?? "").trim();
  const vip = formData.get("vip") === "on";
  const tags = formData.getAll("tags").map((t) => String(t));
  const ingredientsList = parseJsonStringArray(formData.get("ingredientsList"));
  const instructions = parseJsonStringArray(formData.get("instructions"));

  return { name, glass, prepTime, difficulty, description, vip, tags, ingredientsList, instructions };
}

export async function createRecipe(formData: FormData) {
  await requireVipOrAdmin();
  const input = parseRecipeFormData(formData);
  if (!input.name || input.tags.length === 0 || input.ingredientsList.length === 0 || input.instructions.length === 0) {
    return;
  }
  await api.createRecipe(input);
  revalidatePath("/cocktails");
}

export async function updateRecipe(id: string, formData: FormData) {
  await requireVipOrAdmin();
  const input = parseRecipeFormData(formData);
  if (!input.name || input.tags.length === 0 || input.ingredientsList.length === 0 || input.instructions.length === 0) {
    return;
  }
  await api.updateRecipe(id, input);
  revalidatePath("/cocktails");
}

export async function deleteRecipeAction(id: string) {
  await requireVipOrAdmin();
  await api.deleteRecipe(id);
  revalidatePath("/cocktails");
}
```

- [ ] **Step 4: Type-check**

Run (from repo root): `npx tsc --noEmit -p .`
Expected: no errors in `src/app/actions.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions.ts
git commit -m "feat(web): add server actions for custom recipe create/update/delete"
```

---

## Task 7: `CreateRecipeModal` component

**Files:**
- Create: `src/app/cocktails/CreateRecipeModal.tsx`

**Interfaces:**
- Consumes: `createRecipe`, `updateRecipe` server actions (Task 6), `CocktailRecipe` type (Task 4).
- Produces: default export `CreateRecipeModal({ mode, allTags, initialRecipe, onClose }: { mode: "create" | "edit"; allTags: string[]; initialRecipe?: CocktailRecipe; onClose: () => void })`.

- [ ] **Step 1: Create the component**

Create `src/app/cocktails/CreateRecipeModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createRecipe, updateRecipe } from "@/app/actions";
import type { CocktailRecipe } from "@/lib/cocktail-types";

const DIFFICULTIES = ["Facile", "Moyen", "Expert"] as const;

interface CreateRecipeModalProps {
  mode: "create" | "edit";
  allTags: string[];
  initialRecipe?: CocktailRecipe;
  onClose: () => void;
}

export default function CreateRecipeModal({ mode, allTags, initialRecipe, onClose }: CreateRecipeModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(initialRecipe?.tags ?? []);
  const [ingredientsList, setIngredientsList] = useState<string[]>(initialRecipe?.ingredientsList ?? [""]);
  const [instructions, setInstructions] = useState<string[]>(initialRecipe?.instructions ?? [""]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const updateLine = (list: string[], setList: (v: string[]) => void, idx: number, value: string) => {
    const next = [...list];
    next[idx] = value;
    setList(next);
  };

  const addLine = (list: string[], setList: (v: string[]) => void) => setList([...list, ""]);

  const removeLine = (list: string[], setList: (v: string[]) => void, idx: number) =>
    setList(list.filter((_, i) => i !== idx));

  const action = mode === "edit" && initialRecipe ? updateRecipe.bind(null, initialRecipe.id) : createRecipe;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/90 backdrop-blur-xl overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-ink-2/95 border border-orange/20 rounded-2xl p-6 sm:p-7 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-5">
          <h3 className="font-display text-xl font-bold text-cream">
            {mode === "edit" ? "Modifier la recette" : "Nouvelle recette custom"}
          </h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-ink border border-white/[0.1] text-muted hover:text-cream text-lg flex items-center justify-center cursor-pointer"
          >
            ×
          </button>
        </div>

        <form action={action} onSubmit={onClose} className="grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
          <input type="hidden" name="ingredientsList" value={JSON.stringify(ingredientsList.filter(Boolean))} />
          <input type="hidden" name="instructions" value={JSON.stringify(instructions.filter(Boolean))} />

          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Nom du cocktail</label>
            <input
              name="name"
              defaultValue={initialRecipe?.name}
              placeholder="Ex: Le Punch de Noa"
              required
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Verre conseillé</label>
            <input
              name="glass"
              defaultValue={initialRecipe?.glass}
              placeholder="Ex: Verre à mojito"
              required
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Temps de préparation</label>
            <input
              name="prepTime"
              defaultValue={initialRecipe?.prepTime}
              placeholder="Ex: 5 min"
              required
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Difficulté</label>
            <select
              name="difficulty"
              defaultValue={initialRecipe?.difficulty ?? "Moyen"}
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d} className="bg-ink">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2.5 text-sm text-gold cursor-pointer select-none">
              <input
                type="checkbox"
                name="vip"
                defaultChecked={initialRecipe?.vip}
                className="w-5 h-5 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-gold cursor-pointer"
              />
              <span className="font-medium">Réserver à la section VIP</span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Description</label>
            <textarea
              name="description"
              defaultValue={initialRecipe?.description}
              placeholder="Une courte description de la recette"
              required
              rows={2}
              className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
            />
          </div>

          <div className="sm:col-span-2 space-y-2 border border-orange/15 bg-ink/40 p-4 rounded-xl">
            <label className="text-xs uppercase tracking-caps text-gold-dim block">
              Ingrédients de faisabilité (tags de cave)
            </label>
            {allTags.length === 0 ? (
              <p className="text-xs text-muted/65">Aucun tag de bouteille disponible dans la cave.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {allTags.map((tag) => (
                  <label key={tag} className="flex items-center gap-2 text-xs text-cream cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="tags"
                      value={tag}
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                      className="w-4 h-4 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-orange cursor-pointer"
                    />
                    <span className="capitalize">{tag}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 space-y-3 border border-orange/15 bg-ink/40 p-4 rounded-xl">
            <div className="flex justify-between items-center border-b border-orange/5 pb-2">
              <label className="text-xs uppercase tracking-caps text-gold-dim block">
                Ingrédients détaillés (avec quantités)
              </label>
              <button
                type="button"
                onClick={() => addLine(ingredientsList, setIngredientsList)}
                className="text-[10px] uppercase tracking-caps text-orange hover:text-orange-hover font-semibold transition-colors"
              >
                ＋ Ajouter une ligne
              </button>
            </div>
            {ingredientsList.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={line}
                  placeholder="Ex: 6cl rhum blanc"
                  onChange={(e) => updateLine(ingredientsList, setIngredientsList, idx, e.target.value)}
                  className="flex-1 bg-ink border border-orange/15 rounded-lg px-3 py-1.5 text-xs text-cream focus:outline-none focus:border-orange"
                />
                {ingredientsList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(ingredientsList, setIngredientsList, idx)}
                    className="text-xs text-muted hover:text-red-400 font-semibold px-2 py-1 transition-colors"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="sm:col-span-2 space-y-3 border border-orange/15 bg-ink/40 p-4 rounded-xl">
            <div className="flex justify-between items-center border-b border-orange/5 pb-2">
              <label className="text-xs uppercase tracking-caps text-gold-dim block">Étapes de préparation</label>
              <button
                type="button"
                onClick={() => addLine(instructions, setInstructions)}
                className="text-[10px] uppercase tracking-caps text-orange hover:text-orange-hover font-semibold transition-colors"
              >
                ＋ Ajouter une étape
              </button>
            </div>
            {instructions.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={line}
                  placeholder="Ex: Piler la menthe avec le sucre"
                  onChange={(e) => updateLine(instructions, setInstructions, idx, e.target.value)}
                  className="flex-1 bg-ink border border-orange/15 rounded-lg px-3 py-1.5 text-xs text-cream focus:outline-none focus:border-orange"
                />
                {instructions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(instructions, setInstructions, idx)}
                    className="text-xs text-muted hover:text-red-400 font-semibold px-2 py-1 transition-colors"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="sm:col-span-2 bg-orange text-ink font-semibold rounded-lg py-2.5 hover:bg-cream transition-colors mt-2 uppercase tracking-caps text-xs duration-350 cursor-pointer"
          >
            {mode === "edit" ? "Enregistrer les modifications" : "Créer la recette"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run (from repo root): `npx tsc --noEmit -p .`
Expected: no errors in `CreateRecipeModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/cocktails/CreateRecipeModal.tsx
git commit -m "feat(web): add CreateRecipeModal for creating and editing custom recipes"
```

---

## Task 8: Wire `CreateRecipeModal` and edit/delete into `CocktailStudio`

**Files:**
- Modify: `src/app/cocktails/CocktailStudio.tsx`

**Interfaces:**
- Consumes: `CreateRecipeModal` (Task 7), `ConfirmDeleteModal` from `@/components/ConfirmDeleteModal` (Task 5), `deleteRecipeAction` from `@/app/actions` (Task 6), `RecipeAvailability`/`CocktailRecipe` types (Task 4).
- Produces: `CocktailStudio` now accepts `{ initialResults: RecipeAvailability[]; isVip?: boolean; currentUserId?: string; isAdmin?: boolean; allTags: string[] }` (new props: `currentUserId`, `isAdmin`, `allTags`; `allTags` is required since Task 9 always passes it).

- [ ] **Step 1: Replace the full file**

Replace `src/app/cocktails/CocktailStudio.tsx` entirely:

```tsx
"use client";

import { useState, useMemo, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RecipeAvailability, CocktailRecipe } from "@/lib/cocktail-types";
import { deleteRecipeAction } from "@/app/actions";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import CreateRecipeModal from "./CreateRecipeModal";

interface CocktailStudioProps {
  initialResults: RecipeAvailability[];
  isVip?: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  allTags: string[];
}

type FormModalState = { mode: "create" } | { mode: "edit"; recipe: CocktailRecipe } | null;

export default function CocktailStudio({
  initialResults,
  isVip = false,
  currentUserId,
  isAdmin = false,
  allTags,
}: CocktailStudioProps) {
  const [activeTab, setActiveTab] = useState<"ready" | "vip" | "locked">("ready");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<FormModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();

  const accessibleResults = useMemo(() => {
    return isVip ? initialResults : initialResults.filter((r) => !r.usesVip);
  }, [initialResults, isVip]);

  const filteredResults = useMemo(() => {
    return accessibleResults.filter((r) => {
      const matchesSearch =
        r.recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.recipe.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeTab === "ready") {
        return r.makeable && !r.usesVip;
      } else if (activeTab === "vip" && isVip) {
        return r.makeable && r.usesVip;
      } else {
        return !r.makeable;
      }
    });
  }, [accessibleResults, activeTab, searchQuery, isVip]);

  const selectedItem = useMemo(() => {
    if (!selectedRecipeId) return null;
    return accessibleResults.find((r) => r.recipe.id === selectedRecipeId) ?? null;
  }, [selectedRecipeId, accessibleResults]);

  const counts = useMemo(() => {
    return {
      ready: accessibleResults.filter((r) => r.makeable && !r.usesVip).length,
      vip: isVip ? accessibleResults.filter((r) => r.makeable && r.usesVip).length : 0,
      locked: accessibleResults.filter((r) => !r.makeable).length,
    };
  }, [accessibleResults, isVip]);

  const canEditRecipe = (recipe: CocktailRecipe) =>
    Boolean(recipe.isCustom && (isAdmin || (currentUserId && recipe.createdById === currentUserId)));

  return (
    <div className="space-y-6 relative">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2.5 rounded-2xl bg-ink-2/90 border border-white/[0.08] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("ready")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "ready"
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-ink font-extrabold shadow-md"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            Prêts au Bar <span className="font-bold">({counts.ready})</span>
          </button>

          {isVip && (
            <button
              onClick={() => setActiveTab("vip")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "vip"
                  ? "bg-gradient-to-r from-gold to-amber-300 text-ink font-extrabold shadow-md gold-glow"
                  : "text-gold-dim hover:text-gold hover:bg-gold/10 border border-gold/20"
              }`}
            >
              🔒 Avec Cave VIP <span className="font-bold">({counts.vip})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("locked")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "locked"
                ? "bg-orange text-ink font-extrabold shadow-md box-orange-glow"
                : "text-muted hover:text-cream hover:bg-white/[0.04]"
            }`}
          >
            À Compléter <span className="font-bold">({counts.locked})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Chercher cocktail, ingrédient..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-ink-2 border border-white/[0.1] text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:border-orange/60"
            />
          </div>

          {isVip && (
            <button
              onClick={() => setFormModal({ mode: "create" })}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider bg-orange text-ink hover:bg-orange-hover transition-colors cursor-pointer"
            >
              ＋ Recette
            </button>
          )}
        </div>
      </div>

      {/* Master Mixology Recipe Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-ink-2/60 overflow-hidden shadow-xl">
        {filteredResults.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">
            Aucune recette ne correspond à votre filtre.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredResults.map((item) => {
              const isSelected = selectedRecipeId === item.recipe.id;
              return (
                <div
                  key={item.recipe.id}
                  onClick={() => setSelectedRecipeId(item.recipe.id)}
                  className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4.5 transition-all duration-200 cursor-pointer ${
                    isSelected ? "bg-orange/15 border-l-4 border-l-orange" : "hover:bg-ink-2"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        item.makeable
                          ? item.usesVip && isVip
                            ? "bg-gold"
                            : "bg-emerald-400"
                          : "bg-muted/40"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-display font-bold text-base text-cream group-hover:text-orange transition-colors">
                          {item.recipe.name}
                        </span>
                        {item.recipe.isCustom && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-orange/20 text-orange border border-orange/30">
                            Custom
                          </span>
                        )}
                        {item.usesVip && isVip && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gold text-ink shadow-sm">
                            VIP
                          </span>
                        )}
                        {!item.makeable && (
                          <span className="text-xs text-orange font-semibold">
                            (Manque {item.missingTags.length} ingrédient{item.missingTags.length > 1 ? "s" : ""})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5 truncate max-w-sm sm:max-w-xl">
                        {item.recipe.glass ? `${item.recipe.glass} · ` : ""}
                        {item.recipe.tags.join(" · ")}
                        {item.recipe.isCustom && item.recipe.createdByUsername
                          ? ` · par ${item.recipe.createdByUsername}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-2 sm:mt-0 text-xs">
                    <span
                      className={`font-bold uppercase tracking-wider ${
                        item.makeable ? "text-emerald-400" : "text-muted"
                      }`}
                    >
                      {item.makeable ? "Prêt à servir" : "À compléter"}
                    </span>
                    <span className="text-muted group-hover:text-orange transition-colors text-sm">
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-Over Warm Orange / Cream Recipe Spec Sheet Inspector */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setSelectedRecipeId(null)}
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-ink-2 border-l border-white/[0.1] z-50 p-6 sm:p-8 overflow-y-auto flex flex-col justify-between shadow-2xl"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-caps text-gold font-bold block">
                      Fiche de Mixologie
                    </span>
                    <h2 className="font-display text-2xl font-bold text-cream mt-1">
                      {selectedItem.recipe.name}
                    </h2>
                    {selectedItem.recipe.isCustom && (
                      <span className="text-[10px] text-muted mt-1 block">
                        Recette custom
                        {selectedItem.recipe.createdByUsername ? ` · par ${selectedItem.recipe.createdByUsername}` : ""}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRecipeId(null)}
                    className="w-9 h-9 rounded-xl bg-ink border border-white/[0.1] text-muted hover:text-cream text-lg flex items-center justify-center cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Glassware & Service Status */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-ink border border-white/[0.08]">
                    <span className="text-[10px] uppercase tracking-caps text-muted block">Verre conseillé</span>
                    <span className="text-cream font-bold capitalize mt-1 block text-sm">
                      {selectedItem.recipe.glass || "Verre standard"}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-ink border border-white/[0.08]">
                    <span className="text-[10px] uppercase tracking-caps text-muted block">Statut</span>
                    <span
                      className={`font-bold mt-1 block text-sm ${
                        selectedItem.makeable ? "text-emerald-400" : "text-orange"
                      }`}
                    >
                      {selectedItem.makeable ? "Réalisable ce soir" : "Ingrédient manquant"}
                    </span>
                  </div>
                </div>

                {/* Ingredients Audit */}
                <div className="space-y-3">
                  <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                    Ingrédients de la Recette
                  </span>
                  <div className="space-y-2 text-xs">
                    {selectedItem.recipe.tags.map((tag) => {
                      const isMissing = selectedItem.missingTags.includes(tag);
                      return (
                        <div
                          key={tag}
                          className={`flex items-center justify-between p-3.5 rounded-xl border ${
                            isMissing
                              ? "bg-red-950/20 border-red-500/30 text-red-300"
                              : "bg-ink border-white/[0.08] text-cream"
                          }`}
                        >
                          <span className="font-semibold capitalize text-sm">{tag}</span>
                          <span
                            className={`text-xs font-bold ${
                              isMissing ? "text-red-400" : "text-emerald-400"
                            }`}
                          >
                            {isMissing ? "Manquant en cave" : "✓ En cave"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed ingredients list */}
                {selectedItem.recipe.ingredientsList.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                      Ingrédients Détaillés
                    </span>
                    <ul className="space-y-1.5 text-xs text-cream list-disc list-inside">
                      {selectedItem.recipe.ingredientsList.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preparation Guide */}
                <div className="p-5 rounded-xl bg-ink border border-white/[0.08] space-y-2.5">
                  <span className="text-xs uppercase tracking-caps text-gold font-bold block">
                    Guide de Mixologie & Préparation
                  </span>
                  <p className="text-cream text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                    {selectedItem.recipe.instructions ||
                      "Mesurez les ingrédients avec précision, rafraîchissez au shaker ou au verre à mélange selon le spiritueux, puis servez dans un verre préalablement glacé."}
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.08] flex items-center justify-between text-xs">
                <span className="text-muted">Le Bar de Noa · Carte Cocktails</span>
                <div className="flex items-center gap-2">
                  {canEditRecipe(selectedItem.recipe) && (
                    <>
                      <button
                        onClick={() => {
                          setFormModal({ mode: "edit", recipe: selectedItem.recipe });
                          setSelectedRecipeId(null);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-ink border border-orange/30 text-orange font-bold uppercase tracking-wider hover:bg-orange/10 transition-colors cursor-pointer"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: selectedItem.recipe.id, name: selectedItem.recipe.name })}
                        className="px-4 py-2.5 rounded-xl bg-ink border border-red-500/30 text-red-400 font-bold uppercase tracking-wider hover:bg-red-950/20 transition-colors cursor-pointer"
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedRecipeId(null)}
                    className="px-5 py-2.5 rounded-xl bg-orange text-ink font-bold uppercase tracking-wider hover:bg-orange-hover transition-colors cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {formModal && (
        <CreateRecipeModal
          mode={formModal.mode}
          allTags={allTags}
          initialRecipe={formModal.mode === "edit" ? formModal.recipe : undefined}
          onClose={() => setFormModal(null)}
        />
      )}

      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        title="Supprimer la recette ?"
        description={`Êtes-vous sûr de vouloir supprimer définitivement "${deleteTarget?.name}" ?`}
        isPending={isDeletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          startDeleteTransition(() => {
            deleteRecipeAction(id);
          });
          setSelectedRecipeId(null);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run (from repo root): `npx tsc --noEmit -p .`
Expected: errors in `src/app/cocktails/page.tsx` about missing `allTags` prop are EXPECTED at this point (fixed in Task 9) — there should be no other errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/cocktails/CocktailStudio.tsx
git commit -m "feat(web): wire recipe creation, editing and deletion into CocktailStudio"
```

---

## Task 9: Wire `page.tsx` — fetch bottle tags, pass session identity

**Files:**
- Modify: `src/app/cocktails/page.tsx`

**Interfaces:**
- Consumes: `listBottles()` (existing, `src/lib/api-client.ts`), `CocktailStudio` new props (Task 8).
- Produces: `CocktailsPage` passes `allTags`, `currentUserId`, `isAdmin` to `CocktailStudio`.

- [ ] **Step 1: Replace the full file**

Replace `src/app/cocktails/page.tsx` entirely:

```tsx
import { evaluateCocktails, listBottles } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import CocktailStudio from "./CocktailStudio";
import PageTransition from "@/components/PageTransition";

export default async function CocktailsPage() {
  const [results, session, bottles] = await Promise.all([
    evaluateCocktails(),
    getSession(),
    listBottles(),
  ]);

  const isVip = Boolean(session?.vip || session?.role === "ADMIN");
  const isAdmin = session?.role === "ADMIN";
  const allTags = Array.from(new Set(bottles.flatMap((b) => b.tags))).sort();

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Mixologie & Recettes</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            La Carte des Cocktails
          </h1>
        </div>
      </div>

      <CocktailStudio
        initialResults={results}
        isVip={isVip}
        currentUserId={session?.sub}
        isAdmin={isAdmin}
        allTags={allTags}
      />
    </PageTransition>
  );
}
```

- [ ] **Step 2: Type-check the whole project**

Run (from repo root): `npx tsc --noEmit -p .`
Expected: exits 0, no errors.

- [ ] **Step 3: Lint**

Run (from repo root): `npm run lint`
Expected: no new errors introduced by this change.

- [ ] **Step 4: Commit**

```bash
git add src/app/cocktails/page.tsx
git commit -m "feat(web): pass bottle tags and session identity into the cocktails page"
```

---

## Task 10: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start the stack**

Run (from repo root, separate terminals or background processes):
```bash
docker compose up -d
(cd api && npm run start:dev)
npm run dev
```
Expected: API on `http://localhost:3001`, frontend on `http://localhost:3000`.

- [ ] **Step 2: Log in as a VIP (non-admin) user and create a recipe**

Log in with a VIP test account (create one via the accounts admin page if none exists, or use an existing seeded VIP account). Go to `/cocktails`, click "＋ Recette", fill in the form (name, at least one tag checkbox, one detailed ingredient line, one instruction step, glass, prep time, difficulty, description), leave "Réserver à la section VIP" unchecked, submit.
Expected: recipe appears in the grid with a "Custom" badge; clicking it opens the detail panel showing the "Ingrédients Détaillés" section with the entered lines.

- [ ] **Step 3: Log in as a standard (non-VIP, non-admin) user**

Expected: no "＋ Recette" button visible on `/cocktails`. If a VIP-flagged custom recipe was created in Step 4 below, it must not appear anywhere in this user's list.

- [ ] **Step 4: Create a VIP-flagged custom recipe as the VIP user, then re-check as standard user**

As the VIP user, create a second recipe with "Réserver à la section VIP" checked.
Expected: as the standard user (re-run Step 3), this second recipe is absent from the grid entirely (not even in "À Compléter").

- [ ] **Step 5: Edit and delete as the creator**

As the VIP user who created the recipe in Step 2, open its detail panel.
Expected: "Modifier" and "Supprimer" buttons are visible. Click "Modifier", change the name, submit — the grid reflects the new name. Click into the recipe again, click "Supprimer", confirm — the recipe disappears from the grid.

- [ ] **Step 6: Confirm a non-owner cannot edit/delete**

Log in as a second VIP or Admin account (different from the creator) and open the recipe created by the first VIP user (recreate one if it was deleted in Step 5).
Expected: if this second account is Admin, "Modifier"/"Supprimer" ARE visible (Admin can edit any recipe). If this second account is VIP but not the creator and not Admin, "Modifier"/"Supprimer" are NOT visible on that recipe's detail panel.

- [ ] **Step 7: Confirm official recipes are unaffected**

Open any of the original 20+ recipes (e.g. "Mojito").
Expected: displays normally, no "Custom" badge, no Modifier/Supprimer buttons (not `isCustom`), "Ingrédients Détaillés" section now shows its `ingredientsList` (previously never rendered — confirm this is a visual improvement, not a regression).

---

## Self-Review Notes

- **Spec coverage:** every requirement in `docs/superpowers/specs/2026-07-12-custom-recipes-design.md` maps to a task — data model (Task 1), API + permissions + merge (Tasks 2–3), frontend types/actions (Tasks 4, 6), UI (Tasks 7–9), tests (Tasks 1–3 inline, Task 10 manual).
- **Placeholder scan:** no TBD/TODO; all steps show complete code.
- **Type consistency:** `RecipeInput` (Task 4) matches the `parseRecipeFormData` return shape (Task 6) and the DTO fields (Task 2) field-for-field. `CocktailRecipe.vip`/`isCustom`/`createdById`/`createdByUsername` (Task 4) match the mapped object built in `CocktailsService.evaluate` (Task 3). `CreateRecipeModal` props (Task 7) match how `CocktailStudio` invokes it (Task 8).
- **Known pre-existing quirk, not introduced by this plan:** the "Guide de Mixologie & Préparation" block in `CocktailStudio.tsx` renders `selectedItem.recipe.instructions` directly (an array) instead of joining it — this pre-dates this feature (present in the original file) and affects official and custom recipes identically. Out of scope to fix here; flagged for a future cleanup.
