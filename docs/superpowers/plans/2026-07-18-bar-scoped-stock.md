# Bar-scoped stock (phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rattacher `Bottle`, `Event` et `Recipe` à un `Bar` précis, faire de leur gestion un privilège du propriétaire du bar (plus seulement de l'ADMIN plateforme), et rendre leur contenu privé aux membres du bar — sans casser le flux existant des invités de soirée (`Contribution`), qui reste explicitement inchangé.

**Architecture:** Migration Prisma en 3 étapes (nullable → backfill → NOT NULL) sur `Bottle`/`Event`/`Recipe`. Un nouveau `BarAccessService` partagé centralise la logique "cet utilisateur a-t-il accès à ce bar, y voit-il le VIP, peut-il le gérer" et est réutilisé par les modules `bottles`, `events`, `recipes`, `cocktails`, `stock-adjustments`. `barId` est passé explicitement (query param en lecture sur les routes racine, champ du body en écriture) ; les routes imbriquées sous `/events/:slug/...` déduisent le bar de l'`Event` trouvé. Côté frontend, chaque page bar-scopée résout le bar actif (déjà en place depuis la phase 1) et le transmet aux fonctions `api-client.ts` concernées.

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL (API), Next.js 16 App Router + Server Actions (frontend), Jest (API unit tests only).

## Global Constraints

- Suivre le pattern de module existant : `module.ts` / `controller.ts` / `service.ts` / `dto/*.ts`, controller fin (délègue au service), DTO seule couche de validation (`ValidationPipe({ whitelist: true, transform: true })` déjà globale dans `api/src/main.ts`).
- Aucune nouvelle dépendance npm. `@nestjs/mapped-types` (déjà présent) fournit `OmitType`/`PartialType` utilisés pour protéger `barId` en écriture sur les DTO de mise à jour.
- Messages d'exception en français, cohérents avec le reste du code.
- **`Contribution` (ce que les invités apportent à une soirée) est explicitement HORS SCOPE de ce plan** — décision utilisateur confirmée lors du brainstorming : reste accessible à tout compte connecté (création) et en lecture publique (comme aujourd'hui), indépendamment de l'appartenance au bar. Aucun fichier de `api/src/contributions/` n'est modifié par ce plan.
- Toutes les autres routes bar-scopées (`bottles`, `events`, `recipes`, `cocktails`, `stock-adjustments`) passent d'un accès anonyme/`@Roles('ADMIN')` global à `JwtAuthGuard` obligatoire + vérification d'appartenance au bar via `BarAccessService`.
- Gestion (écriture) du stock/des soirées : réservée au propriétaire du bar concerné, ou à un `ADMIN` plateforme (remplace `@Roles('ADMIN')` global).
- Visibilité VIP d'une ressource d'un bar : dépend de `BarMembership.vip` **pour ce bar précis** (via `BarAccessService`), plus un `ADMIN` plateforme qui voit toujours tout.
- `barId` obligatoire en query string sur `GET /bottles`, `GET /events`, `GET /cocktails` ; en champ du body sur `POST /bottles`, `POST /events`, `POST /recipes`. Les routes `GET/PATCH/DELETE /bottles/:id`, `GET/DELETE /events/:slug` déduisent le bar de la ressource trouvée — **pas** de `barId` séparé sur ces routes.
- L'unicité du `slug` d'un `Event` reste **globale** (pas de contrainte composite `[barId, slug]`) — choix délibéré, plus simple, sans impact fonctionnel (le suffixe numérique existant gère déjà les collisions).
- Le frontend n'a pas de framework de test — vérifier avec `npx tsc --noEmit -p .`.
- Ce plan ne touche pas `User.vip` (flag global), sa suppression du schéma est hors scope.
- `next.config.ts` a `basePath: "/bar"` — tout chemin écrit en code (`redirect()`, `<Link href>`, noms de dossiers sous `src/app/`) doit être un chemin **logique** sans `/bar` ; seules les URL réellement tapées dans le navigateur ont besoin du préfixe.

---

### Task 1: Prisma schema — `barId` sur Bottle/Event/Recipe (nullable → backfill → NOT NULL)

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/scripts/backfill-bar-data.ts`
- Modify: `api/package.json`

**Interfaces:**
- Produces: `Bottle.barId`, `Event.barId`, `Recipe.barId` (tous `String`, FK vers `Bar`, `onDelete: Cascade`), `Bar.bottles Bottle[]`, `Bar.events Event[]`, `Bar.recipes Recipe[]`.

- [ ] **Step 1: Ajouter `barId` nullable au schéma**

Dans `api/prisma/schema.prisma`, ajouter sur `Bottle` (après `imageUrl`) :

```prisma
  barId             String?
  bar               Bar?              @relation(fields: [barId], references: [id], onDelete: Cascade)
```

Sur `Event` (après `createdAt`) :

```prisma
  barId            String?
  bar              Bar?              @relation(fields: [barId], references: [id], onDelete: Cascade)
```

Sur `Recipe` (après `createdAt`) :

```prisma
  barId           String?
  bar             Bar?             @relation(fields: [barId], references: [id], onDelete: Cascade)
```

Sur `Bar`, ajouter les back-relations :

```prisma
model Bar {
  id          String          @id @default(cuid())
  name        String
  createdAt   DateTime        @default(now())
  memberships BarMembership[]
  bottles     Bottle[]
  events      Event[]
  recipes     Recipe[]
}
```

- [ ] **Step 2: Valider et migrer (étape nullable)**

Run: `cd api && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

Run: `cd api && npx prisma migrate dev --name add_bar_id_nullable`
Expected: `Your database is now in sync with your schema.`

- [ ] **Step 3: Écrire le script de backfill**

```ts
// api/scripts/backfill-bar-data.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  });

  if (!admin) {
    throw new Error(
      'Aucun compte ADMIN trouvé — impossible de déterminer à quel bar rattacher les données existantes.',
    );
  }

  let bar = await prisma.bar.findFirst({
    where: { memberships: { some: { userId: admin.id, role: 'OWNER' } } },
  });

  if (!bar) {
    bar = await prisma.bar.create({
      data: {
        name: 'Le Bar de Noa',
        memberships: { create: { userId: admin.id, role: 'OWNER', vip: true } },
      },
    });
    console.log(`Bar créé : "${bar.name}" (${bar.id}), propriétaire ${admin.username}`);
  } else {
    console.log(`Bar existant réutilisé : "${bar.name}" (${bar.id}), propriétaire ${admin.username}`);
  }

  const bottles = await prisma.bottle.updateMany({
    where: { barId: null },
    data: { barId: bar.id },
  });
  const events = await prisma.event.updateMany({
    where: { barId: null },
    data: { barId: bar.id },
  });
  const recipes = await prisma.recipe.updateMany({
    where: { barId: null },
    data: { barId: bar.id },
  });

  console.log(`Bouteilles rattachées : ${bottles.count}`);
  console.log(`Soirées rattachées : ${events.count}`);
  console.log(`Recettes custom rattachées : ${recipes.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

This script has no automated test — it follows the exact same convention as the
existing `api/scripts/migrate-from-json.ts`, which also has no dedicated spec
file. It's a one-time data operation, not application logic.

- [ ] **Step 4: Enregistrer le script dans `package.json`**

Dans `api/package.json`, ajouter dans `scripts` (après `"migrate:json"`) :

```json
    "backfill:bar-data": "ts-node scripts/backfill-bar-data.ts"
```

- [ ] **Step 5: Exécuter le backfill**

Run: `cd api && npm run backfill:bar-data`
Expected: logs confirmant le bar créé/réutilisé et le nombre de lignes rattachées sur chaque table (0 si la base est vide, ce qui est un résultat normal en développement).

- [ ] **Step 6: Repasser `barId` en NOT NULL**

Dans `api/prisma/schema.prisma`, changer les trois champs ajoutés au Step 1 :

```prisma
  barId             String
  bar               Bar               @relation(fields: [barId], references: [id], onDelete: Cascade)
```

(retirer les `?` sur `Bottle.barId`/`Bottle.bar`, `Event.barId`/`Event.bar`, `Recipe.barId`/`Recipe.bar`)

Run: `cd api && npx prisma migrate dev --name add_bar_id_required`
Expected: `Your database is now in sync with your schema.` (échoue si des lignes ont encore `barId IS NULL` — dans ce cas, relancer le Step 5).

- [ ] **Step 7: Lancer la suite de tests complète**

Run: `cd api && npm test`
Expected: tous les tests existants passent toujours (aucune régression — cette étape n'a touché ni service ni controller).

- [ ] **Step 8: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations api/scripts/backfill-bar-data.ts api/package.json
git commit -m "feat(api): add barId to Bottle/Event/Recipe with data backfill"
```

---

### Task 2: `BarAccessService`

**Files:**
- Create: `api/src/bars/bar-access.service.ts`
- Modify: `api/src/bars/bars.service.ts`
- Modify: `api/src/bars/bars.module.ts`
- Test: `api/src/bars/bar-access.service.spec.ts`

**Interfaces:**
- Consumes: `BarsService.getMembership(barId, userId)` (devient publique — était privée), `JwtPayload` (existant, `{ sub, username, role, vip }`).
- Produces (utilisé par les tâches 3-7) :
  ```ts
  interface BarAccess {
    canSeeVip: boolean;
    isOwnerOrAdmin: boolean;
  }
  class BarAccessService {
    assertMember(barId: string, user: JwtPayload): Promise<BarAccess>
  }
  ```
  `assertMember` lance `ForbiddenException` si l'utilisateur n'est ni `ADMIN` plateforme, ni membre du bar.

- [ ] **Step 1: Rendre `BarsService.getMembership` publique**

Dans `api/src/bars/bars.service.ts`, retirer le mot-clé `private` de la méthode `getMembership` :

```ts
  getMembership(barId: string, userId: string) {
    return this.prisma.barMembership.findUnique({
      where: { barId_userId: { barId, userId } },
    });
  }
```

Run: `cd api && npx jest bars/bars.service.spec.ts`
Expected: PASS (aucun test n'appelle cette méthode directement, ce changement de visibilité ne casse rien).

- [ ] **Step 2: Écrire le test qui échoue pour `BarAccessService`**

```ts
// api/src/bars/bar-access.service.spec.ts
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { BarAccessService } from './bar-access.service';
import { BarsService } from './bars.service';
import type { JwtPayload } from '../auth/auth.service';

describe('BarAccessService', () => {
  let service: BarAccessService;
  let barsService: { getMembership: jest.Mock };

  const BAR_ID = 'bar-1';
  const admin: JwtPayload = { sub: 'admin-1', username: 'root', role: 'ADMIN', vip: false };
  const member: JwtPayload = { sub: 'user-1', username: 'alice', role: 'USER', vip: false };

  beforeEach(async () => {
    barsService = { getMembership: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [BarAccessService, { provide: BarsService, useValue: barsService }],
    }).compile();

    service = moduleRef.get(BarAccessService);
  });

  it('grants full access to an ADMIN without a membership lookup', async () => {
    const access = await service.assertMember(BAR_ID, admin);

    expect(access).toEqual({ canSeeVip: true, isOwnerOrAdmin: true });
    expect(barsService.getMembership).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException for a non-member', async () => {
    barsService.getMembership.mockResolvedValue(null);

    await expect(service.assertMember(BAR_ID, member)).rejects.toThrow(ForbiddenException);
  });

  it('grants VIP visibility and owner status for an OWNER member', async () => {
    barsService.getMembership.mockResolvedValue({ role: 'OWNER', vip: true });

    const access = await service.assertMember(BAR_ID, member);

    expect(access).toEqual({ canSeeVip: true, isOwnerOrAdmin: true });
  });

  it('denies VIP visibility and owner status for a non-VIP MEMBER', async () => {
    barsService.getMembership.mockResolvedValue({ role: 'MEMBER', vip: false });

    const access = await service.assertMember(BAR_ID, member);

    expect(access).toEqual({ canSeeVip: false, isOwnerOrAdmin: false });
  });

  it('grants VIP visibility but not owner status for a VIP MEMBER', async () => {
    barsService.getMembership.mockResolvedValue({ role: 'MEMBER', vip: true });

    const access = await service.assertMember(BAR_ID, member);

    expect(access).toEqual({ canSeeVip: true, isOwnerOrAdmin: false });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && npx jest bars/bar-access.service.spec.ts`
Expected: FAIL — `Cannot find module './bar-access.service'`.

- [ ] **Step 4: Implémenter `BarAccessService`**

```ts
// api/src/bars/bar-access.service.ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { BarsService } from './bars.service';
import type { JwtPayload } from '../auth/auth.service';

export interface BarAccess {
  canSeeVip: boolean;
  isOwnerOrAdmin: boolean;
}

@Injectable()
export class BarAccessService {
  constructor(private readonly barsService: BarsService) {}

  async assertMember(barId: string, user: JwtPayload): Promise<BarAccess> {
    if (user.role === 'ADMIN') {
      return { canSeeVip: true, isOwnerOrAdmin: true };
    }

    const membership = await this.barsService.getMembership(barId, user.sub);
    if (!membership) {
      throw new ForbiddenException("Vous n'avez pas accès à ce bar");
    }

    return { canSeeVip: membership.vip, isOwnerOrAdmin: membership.role === 'OWNER' };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd api && npx jest bars/bar-access.service.spec.ts`
Expected: PASS, 5/5 tests.

- [ ] **Step 6: Enregistrer dans `BarsModule`**

```ts
// api/src/bars/bars.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BarsService } from './bars.service';
import { BarsController } from './bars.controller';
import { BarAccessService } from './bar-access.service';

@Module({
  imports: [UsersModule],
  controllers: [BarsController],
  providers: [BarsService, BarAccessService],
  exports: [BarsService, BarAccessService],
})
export class BarsModule {}
```

- [ ] **Step 7: Lancer la suite de tests complète**

Run: `cd api && npm test`
Expected: tous les tests passent (aucune régression).

- [ ] **Step 8: Commit**

```bash
git add api/src/bars
git commit -m "feat(api): add BarAccessService for shared bar permission checks"
```

---

### Task 3: Bottles — bar-scoped

**Files:**
- Modify: `api/src/bottles/dto/create-bottle.dto.ts`
- Modify: `api/src/bottles/dto/update-bottle.dto.ts`
- Modify: `api/src/bottles/bottles.service.ts`
- Modify: `api/src/bottles/bottles.controller.ts`
- Modify: `api/src/bottles/bottles.module.ts`
- Test: `api/src/bottles/bottles.service.spec.ts`

**Interfaces:**
- Consumes: `BarAccessService.assertMember(barId, user): Promise<{ canSeeVip, isOwnerOrAdmin }>` (Task 2).
- Produces: `BottlesService.findAll(barId: string, includeVip: boolean)`, unchanged `findOne(id)`/`create(dto)`/`update(id, dto)`/`remove(id)` signatures — `create`'s `dto` now carries `barId`.

- [ ] **Step 1: Ajouter `barId` au DTO de création**

Dans `api/src/bottles/dto/create-bottle.dto.ts`, ajouter en tête de classe (avant `name`) :

```ts
  @IsString()
  barId: string;
```

- [ ] **Step 2: Empêcher la modification de `barId` via le DTO de mise à jour**

Remplacer le contenu de `api/src/bottles/dto/update-bottle.dto.ts` :

```ts
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateBottleDto } from './create-bottle.dto';

export class UpdateBottleDto extends PartialType(OmitType(CreateBottleDto, ['barId'] as const)) {}
```

- [ ] **Step 3: Écrire les tests qui échouent pour le filtrage par bar**

Remplacer dans `api/src/bottles/bottles.service.spec.ts` les deux tests `findAll` existants par :

```ts
  it('excludes VIP bottles from the query when includeVip is false', async () => {
    await service.findAll('bar-1', false);

    expect(prisma.bottle.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1', vip: false },
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
  });

  it('does not filter by vip when includeVip is true', async () => {
    await service.findAll('bar-1', true);

    expect(prisma.bottle.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1' },
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
  });
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd api && npx jest bottles/bottles.service.spec.ts`
Expected: FAIL — actual `where` doesn't include `barId` yet.

- [ ] **Step 5: Mettre à jour `BottlesService.findAll`**

Dans `api/src/bottles/bottles.service.ts`, remplacer la méthode `findAll` :

```ts
  findAll(barId: string, includeVip: boolean) {
    return this.prisma.bottle.findMany({
      where: { barId, ...(includeVip ? {} : { vip: false }) },
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
  }
```

(`findOne`, `create`, `update`, `remove` restent inchangées — `create` reçoit déjà `barId` via `...rest` du DTO.)

- [ ] **Step 6: Run test to verify it passes**

Run: `cd api && npx jest bottles/bottles.service.spec.ts`
Expected: PASS, 3/3 tests.

- [ ] **Step 7: Mettre à jour le controller**

Remplacer le contenu de `api/src/bottles/bottles.controller.ts` :

```ts
import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { BottlesService } from './bottles.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';

@UseGuards(JwtAuthGuard)
@Controller('bottles')
export class BottlesController {
  constructor(
    private readonly bottlesService: BottlesService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @Get()
  async findAll(@Req() req: Request, @Query('barId') barId: string) {
    const user = req.user as JwtPayload;
    const { canSeeVip } = await this.barAccessService.assertMember(barId, user);
    return this.bottlesService.findAll(barId, canSeeVip);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    await this.barAccessService.assertMember(bottle.barId, user);
    return bottle;
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateBottleDto) {
    const user = req.user as JwtPayload;
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(dto.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut gérer le stock');
    }
    return this.bottlesService.create(dto);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBottleDto) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(bottle.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut gérer le stock');
    }
    return this.bottlesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload;
    const bottle = await this.bottlesService.findOne(id);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(bottle.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut gérer le stock');
    }
    return this.bottlesService.remove(id);
  }
}
```

(Cette version retire `OptionalJwtAuthGuard`, `RolesGuard`, `@Roles('ADMIN')` — plus utilisés sur ce controller.)

- [ ] **Step 8: Mettre à jour le module**

```ts
// api/src/bottles/bottles.module.ts
import { Module } from '@nestjs/common';
import { BarsModule } from '../bars/bars.module';
import { BottlesService } from './bottles.service';
import { BottlesController } from './bottles.controller';

@Module({
  imports: [BarsModule],
  controllers: [BottlesController],
  providers: [BottlesService],
  exports: [BottlesService],
})
export class BottlesModule {}
```

- [ ] **Step 9: Lancer la suite de tests complète**

Run: `cd api && npm test`
Expected: tous les tests passent.

- [ ] **Step 10: Commit**

```bash
git add api/src/bottles
git commit -m "feat(api): scope bottles to a bar"
```

---

### Task 4: Events — bar-scoped

**Files:**
- Modify: `api/src/events/dto/create-event.dto.ts`
- Modify: `api/src/events/events.service.ts`
- Modify: `api/src/events/events.controller.ts`
- Modify: `api/src/events/events.module.ts`
- Test: `api/src/events/events.service.spec.ts`

**Interfaces:**
- Consumes: `BarAccessService.assertMember` (Task 2).
- Produces: `EventsService.findAll(barId: string)`, unchanged `findBySlug(slug)`/`create(dto)`/`remove(slug)` signatures — `create`'s `dto` now carries `barId`.

- [ ] **Step 1: Ajouter `barId` au DTO de création**

```ts
// api/src/events/dto/create-event.dto.ts
import { IsDateString, IsString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  barId: string;

  @IsString()
  name: string;

  @IsDateString()
  date: string;
}
```

(Il n'existe pas de `UpdateEventDto` — pas de route `PATCH /events/:slug` à protéger.)

- [ ] **Step 2: Écrire les tests qui échouent**

Mettre à jour `api/src/events/events.service.spec.ts` : les deux tests existants passent `barId` dans l'input, et un nouveau test couvre `findAll` :

```ts
import { Test } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: { event: Record<string, jest.Mock> };

  beforeEach(async () => {
    prisma = {
      event: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(EventsService);
  });

  it('slugifies the event name, stripping accents and spaces', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    prisma.event.create.mockImplementation(({ data }) => Promise.resolve(data));

    const event = await service.create({ barId: 'bar-1', name: 'Apéro du samedi', date: '2026-07-11' });

    expect(event.slug).toBe('apero-du-samedi');
  });

  it('appends a numeric suffix when the slug already exists', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({ slug: 'apero-du-samedi' })
      .mockResolvedValueOnce(null);
    prisma.event.create.mockImplementation(({ data }) => Promise.resolve(data));

    const event = await service.create({ barId: 'bar-1', name: 'Apéro du samedi', date: '2026-07-18' });

    expect(event.slug).toBe('apero-du-samedi-2');
  });

  it('scopes findAll to the given bar', async () => {
    await service.findAll('bar-1');

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1' },
      orderBy: { date: 'asc' },
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && npx jest events/events.service.spec.ts`
Expected: FAIL — `findAll` doesn't accept/use a `barId` argument yet, and `create`'s data doesn't carry `barId`.

- [ ] **Step 4: Mettre à jour `EventsService`**

Remplacer `findAll` et `create` dans `api/src/events/events.service.ts` :

```ts
  findAll(barId: string) {
    return this.prisma.event.findMany({ where: { barId }, orderBy: { date: 'asc' } });
  }
```

```ts
  async create(dto: CreateEventDto) {
    const base = slugify(dto.name);
    let slug = base;
    let n = 1;
    while (await this.prisma.event.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return this.prisma.event.create({ data: { barId: dto.barId, name: dto.name, date: dto.date, slug } });
  }
```

(`findBySlug`, `remove` restent inchangées.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd api && npx jest events/events.service.spec.ts`
Expected: PASS, 3/3 tests.

- [ ] **Step 6: Mettre à jour le controller**

```ts
// api/src/events/events.controller.ts
import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @Get()
  async findAll(@Req() req: Request, @Query('barId') barId: string) {
    const user = req.user as JwtPayload;
    await this.barAccessService.assertMember(barId, user);
    return this.eventsService.findAll(barId);
  }

  @Get(':slug')
  async findOne(@Req() req: Request, @Param('slug') slug: string) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    await this.barAccessService.assertMember(event.barId, user);
    return event;
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateEventDto) {
    const user = req.user as JwtPayload;
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(dto.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut créer une soirée');
    }
    return this.eventsService.create(dto);
  }

  @Delete(':slug')
  async remove(@Req() req: Request, @Param('slug') slug: string) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(event.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut supprimer une soirée');
    }
    return this.eventsService.remove(slug);
  }
}
```

- [ ] **Step 7: Mettre à jour le module**

```ts
// api/src/events/events.module.ts
import { Module } from '@nestjs/common';
import { BarsModule } from '../bars/bars.module';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports: [BarsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
```

- [ ] **Step 8: Lancer la suite de tests complète**

Run: `cd api && npm test`
Expected: tous les tests passent.

- [ ] **Step 9: Commit**

```bash
git add api/src/events
git commit -m "feat(api): scope events to a bar"
```

---

### Task 5: Recipes — bar-scoped

**Files:**
- Modify: `api/src/recipes/dto/create-recipe.dto.ts`
- Modify: `api/src/recipes/dto/update-recipe.dto.ts`
- Modify: `api/src/recipes/recipes.service.ts`
- Modify: `api/src/recipes/recipes.controller.ts`
- Modify: `api/src/recipes/recipes.module.ts`
- Test: `api/src/recipes/recipes.service.spec.ts`

**Interfaces:**
- Consumes: `BarAccessService.assertMember` (Task 2).
- Produces: `RecipesService.findVisible(barId: string, includeVip: boolean)`, unchanged `findOne(id)`/`create(dto, userId)`/`update(id, dto, user)`/`remove(id, user)` signatures.

- [ ] **Step 1: Ajouter `barId` au DTO de création**

Dans `api/src/recipes/dto/create-recipe.dto.ts`, ajouter en tête de classe (avant `name`) :

```ts
  @IsString()
  barId: string;
```

- [ ] **Step 2: Empêcher la modification de `barId` via le DTO de mise à jour**

```ts
// api/src/recipes/dto/update-recipe.dto.ts
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateRecipeDto } from './create-recipe.dto';

export class UpdateRecipeDto extends PartialType(OmitType(CreateRecipeDto, ['barId'] as const)) {}
```

- [ ] **Step 3: Écrire les tests qui échouent pour le filtrage par bar**

Remplacer dans `api/src/recipes/recipes.service.spec.ts` les deux tests `findVisible` existants par :

```ts
  it('excludes VIP recipes from the query when includeVip is false', async () => {
    await service.findVisible('bar-1', false);

    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1', vip: false },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('does not filter by vip when includeVip is true', async () => {
    await service.findVisible('bar-1', true);

    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1' },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd api && npx jest recipes/recipes.service.spec.ts`
Expected: FAIL — actual `where` doesn't include `barId` yet.

- [ ] **Step 5: Mettre à jour `RecipesService.findVisible`**

```ts
  findVisible(barId: string, includeVip: boolean) {
    return this.prisma.recipe.findMany({
      where: { barId, ...(includeVip ? {} : { vip: false }) },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
```

(`findOne`, `create`, `update`, `remove`, `assertOwnerOrAdmin` restent inchangées.)

- [ ] **Step 6: Run test to verify it passes**

Run: `cd api && npx jest recipes/recipes.service.spec.ts`
Expected: PASS, tous les tests existants (8) toujours verts.

- [ ] **Step 7: Mettre à jour le controller**

```ts
// api/src/recipes/recipes.controller.ts
import { Body, Controller, Delete, ForbiddenException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateRecipeDto) {
    const user = req.user as JwtPayload;
    const { canSeeVip } = await this.barAccessService.assertMember(dto.barId, user);
    if (!canSeeVip) {
      throw new ForbiddenException('Réservé aux comptes VIP ou Admin de ce bar');
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

(`update`/`remove` gardent la logique auteur-ou-admin existante, inchangée — pas de vérification de bar supplémentaire, comme décidé dans le design.)

- [ ] **Step 8: Mettre à jour le module**

```ts
// api/src/recipes/recipes.module.ts
import { Module } from '@nestjs/common';
import { BarsModule } from '../bars/bars.module';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';

@Module({
  imports: [BarsModule],
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
```

- [ ] **Step 9: Lancer la suite de tests complète**

Run: `cd api && npm test`
Expected: tous les tests passent.

- [ ] **Step 10: Commit**

```bash
git add api/src/recipes
git commit -m "feat(api): scope recipes to a bar"
```

---

### Task 6: Cocktails — bar-scoped

**Files:**
- Modify: `api/src/cocktails/cocktails.service.ts`
- Modify: `api/src/cocktails/cocktails.controller.ts`
- Modify: `api/src/cocktails/cocktails.module.ts`

**Interfaces:**
- Consumes: `BottlesService.findAll(barId, includeVip)` (Task 3), `RecipesService.findVisible(barId, includeVip)` (Task 5), `BarAccessService.assertMember` (Task 2).
- Produces: `CocktailsService.evaluate(barId: string, includeVip: boolean): Promise<RecipeAvailability[]>` (le paramètre `includeVip` change de position/nom — était `evaluate(includeVip)`).

No dedicated test file for this task — `cocktails.service.spec.ts` only tests the pure `evaluateRecipes` function, whose signature is untouched by this change; `CocktailsService.evaluate()` itself has no existing unit test (matches the existing codebase convention of not unit-testing thin orchestration methods that just wire two already-tested services together).

- [ ] **Step 1: Mettre à jour `CocktailsService.evaluate`**

Dans `api/src/cocktails/cocktails.service.ts`, remplacer la méthode `evaluate` :

```ts
  async evaluate(barId: string, includeVip: boolean): Promise<RecipeAvailability[]> {
    const [bottles, customRecipes] = await Promise.all([
      this.bottlesService.findAll(barId, includeVip),
      this.recipesService.findVisible(barId, includeVip),
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
```

- [ ] **Step 2: Mettre à jour le controller**

```ts
// api/src/cocktails/cocktails.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { CocktailsService } from './cocktails.service';

@Controller('cocktails')
export class CocktailsController {
  constructor(
    private readonly cocktailsService: CocktailsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async evaluate(@Req() req: Request, @Query('barId') barId: string) {
    const user = req.user as JwtPayload;
    const { canSeeVip } = await this.barAccessService.assertMember(barId, user);
    return this.cocktailsService.evaluate(barId, canSeeVip);
  }
}
```

- [ ] **Step 3: Mettre à jour le module**

```ts
// api/src/cocktails/cocktails.module.ts
import { Module } from '@nestjs/common';
import { BottlesModule } from '../bottles/bottles.module';
import { RecipesModule } from '../recipes/recipes.module';
import { BarsModule } from '../bars/bars.module';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';

@Module({
  imports: [BottlesModule, RecipesModule, BarsModule],
  controllers: [CocktailsController],
  providers: [CocktailsService],
})
export class CocktailsModule {}
```

- [ ] **Step 4: Lancer la suite de tests complète**

Run: `cd api && npm test`
Expected: tous les tests passent (y compris `cocktails.service.spec.ts`, dont le contenu n'a pas changé).

- [ ] **Step 5: Commit**

```bash
git add api/src/cocktails
git commit -m "feat(api): scope cocktail evaluation to a bar"
```

---

### Task 7: StockAdjustments — bar-scoped controller

**Files:**
- Modify: `api/src/stock-adjustments/stock-adjustments.controller.ts`
- Modify: `api/src/stock-adjustments/stock-adjustments.module.ts`

**Interfaces:**
- Consumes: `EventsService.findBySlug(slug)` (existant, retourne désormais un `event.barId`), `BarAccessService.assertMember` (Task 2).
- `StockAdjustmentsService` reste **inchangée** — `apply`/`findForEvent` continuent de prendre `slug`, le bar est vérifié uniquement dans le controller via l'event trouvé. `stock-adjustments.service.spec.ts` n'a donc besoin d'aucune modification.

Ce controller devient privé aux membres du bar (fin de `OptionalJwtAuthGuard` en lecture) et l'écriture (`apply`, le "bilan") passe de `@Roles('ADMIN')` global à propriétaire du bar (ou `ADMIN`) — décision explicite du design : les ajustements de stock sont une action de gestion du bar, contrairement aux `Contribution` (invités) qui restent, elles, inchangées.

- [ ] **Step 1: Mettre à jour le controller**

```ts
// api/src/stock-adjustments/stock-adjustments.controller.ts
import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { EventsService } from '../events/events.service';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { ApplyStockAdjustmentsDto } from './dto/apply-stock-adjustments.dto';

@UseGuards(JwtAuthGuard)
@Controller('events/:slug/stock-adjustments')
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
    private readonly eventsService: EventsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @Get()
  async findAll(@Req() req: Request, @Param('slug') slug: string) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    await this.barAccessService.assertMember(event.barId, user);
    return this.stockAdjustmentsService.findForEvent(slug);
  }

  @Post()
  async apply(@Req() req: Request, @Param('slug') slug: string, @Body() dto: ApplyStockAdjustmentsDto) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(event.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut valider un bilan de stock');
    }
    return this.stockAdjustmentsService.apply(slug, dto);
  }
}
```

- [ ] **Step 2: Mettre à jour le module**

```ts
// api/src/stock-adjustments/stock-adjustments.module.ts
import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { BarsModule } from '../bars/bars.module';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockAdjustmentsController } from './stock-adjustments.controller';

@Module({
  imports: [EventsModule, BarsModule],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}
```

- [ ] **Step 3: Lancer la suite de tests complète**

Run: `cd api && npm test`
Expected: tous les tests passent (y compris `stock-adjustments.service.spec.ts`, inchangé).

- [ ] **Step 4: Commit**

```bash
git add api/src/stock-adjustments
git commit -m "feat(api): scope stock adjustments to a bar"
```

---

### Task 8: Frontend — `api-client.ts` gains `barId` parameters

**Files:**
- Modify: `src/lib/api-client.ts`

**Interfaces:**
- Produces: `listBottles(barId)`, `addBottle(barId, input)`, `listEvents(barId)`, `createEvent(barId, input)`, `evaluateCocktails(barId)`, `createRecipe(barId, input)`. Toutes les autres fonctions (`updateBottle`, `deleteBottle`, `getEvent`, `deleteEvent`, `listContributions`, `addContribution`, `deleteContribution`, `listStockAdjustments`, `applyStockAdjustments`, `updateRecipe`, `deleteRecipe`) restent **inchangées** — le bar se déduit côté API de la ressource ciblée.

No test framework for the frontend — verify with `npx tsc --noEmit -p .` (this will show errors at every call site until Tasks 9-11 update them; that's expected at this point in the plan).

- [ ] **Step 1: Ajouter `barId` aux fonctions concernées**

Dans `src/lib/api-client.ts`, remplacer :

```ts
export function listBottles(): Promise<Bottle[]> {
  return request<Bottle[]>("/bottles");
}

export function addBottle(
  input: Omit<Bottle, "id" | "createdAt">,
): Promise<Bottle> {
  return request<Bottle>("/bottles", { method: "POST", body: JSON.stringify(input) });
}
```

par :

```ts
export function listBottles(barId: string): Promise<Bottle[]> {
  return request<Bottle[]>(`/bottles?barId=${barId}`);
}

export function addBottle(
  barId: string,
  input: Omit<Bottle, "id" | "createdAt">,
): Promise<Bottle> {
  return request<Bottle>("/bottles", { method: "POST", body: JSON.stringify({ ...input, barId }) });
}
```

Remplacer :

```ts
export function listEvents(): Promise<EventItem[]> {
  return request<EventItem[]>("/events");
}
```

par :

```ts
export function listEvents(barId: string): Promise<EventItem[]> {
  return request<EventItem[]>(`/events?barId=${barId}`);
}
```

Remplacer :

```ts
export function createEvent(input: { name: string; date: string }): Promise<EventItem> {
  return request<EventItem>("/events", { method: "POST", body: JSON.stringify(input) });
}
```

par :

```ts
export function createEvent(barId: string, input: { name: string; date: string }): Promise<EventItem> {
  return request<EventItem>("/events", { method: "POST", body: JSON.stringify({ ...input, barId }) });
}
```

Remplacer :

```ts
export function evaluateCocktails(): Promise<RecipeAvailability[]> {
  return request<RecipeAvailability[]>("/cocktails");
}
```

par :

```ts
export function evaluateCocktails(barId: string): Promise<RecipeAvailability[]> {
  return request<RecipeAvailability[]>(`/cocktails?barId=${barId}`);
}
```

Remplacer :

```ts
export function createRecipe(input: RecipeInput): Promise<CocktailRecipe> {
  return request<CocktailRecipe>("/recipes", { method: "POST", body: JSON.stringify(input) });
}
```

par :

```ts
export function createRecipe(barId: string, input: RecipeInput): Promise<CocktailRecipe> {
  return request<CocktailRecipe>("/recipes", { method: "POST", body: JSON.stringify({ ...input, barId }) });
}
```

- [ ] **Step 2: Type-check (des erreurs sont attendues aux points d'appel)**

Run: `npx tsc --noEmit -p .`
Expected: erreurs dans `src/app/page.tsx`, `src/app/stock/page.tsx`, `src/app/cocktails/page.tsx`, `src/app/soirees/page.tsx`, `src/app/soirees/[slug]/page.tsx`, `src/app/soirees/[slug]/bilan/page.tsx`, `src/app/actions.ts` (arguments manquants) — c'est normal, ces fichiers sont corrigés dans les tâches 9-11.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-client.ts
git commit -m "feat(web): add barId parameters to bar-scoped api-client functions"
```

---

### Task 9: Frontend — accueil, stock, gestion des bouteilles

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/stock/page.tsx`
- Modify: `src/app/stock/AddBottleForm.tsx`
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `listMyBars`, `resolveActiveBar` (existants, phase 1), `listBottles(barId)`, `addBottle(barId, input)`, `evaluateCocktails(barId)` (Task 8), `getSession` (existant).
- Produces: `requireBarOwnerOrAdmin(barId): Promise<void>` (nouveau helper dans `src/app/actions.ts`, redirige vers `/login` si pas de session, vers `/` si ni `ADMIN` ni propriétaire du bar `barId` — réutilisé par la Task 11).

- [ ] **Step 1: Ajouter le helper `requireBarOwnerOrAdmin` à `actions.ts`**

Dans `src/app/actions.ts`, ajouter l'import et le helper après `requireVipOrAdmin` (si elle existe déjà) ou après `requireAdmin` :

```ts
import * as api from "@/lib/api-client";
```

(déjà présent — vérifier qu'il l'est). Ajouter :

```ts
async function requireBarOwnerOrAdmin(barId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") return;

  const bars = await api.listMyBars();
  const isOwner = bars.some((bar) => bar.id === barId && bar.myRole === "OWNER");
  if (!isOwner) redirect("/");
}
```

- [ ] **Step 2: Mettre à jour `createBottle` pour recevoir un `barId`**

Remplacer dans `src/app/actions.ts` :

```ts
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
```

par :

```ts
export async function createBottle(barId: string, formData: FormData) {
  await requireBarOwnerOrAdmin(barId);
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

  await api.addBottle(barId, { name, type, quantity, vip, tags, notes, lowStockThreshold, volumes, imageUrl });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath("/");
}
```

`updateBottleQuantity`, `updateBottleVolumes`, `updateBottleThreshold`, `deleteBottleAction` restent **inchangées** — elles opèrent sur une bouteille existante par `id`, et l'API déduit désormais le bar de cette bouteille pour la vérification de permission (Task 3). Remplacer simplement leur garde `await requireAdmin();` par rien de plus — elles gardent `requireAdmin()` tel quel pour l'instant serait incorrect (un propriétaire de bar non-admin ne pourrait plus gérer SES bouteilles). Remplacer dans chacune des 4 fonctions `await requireAdmin();` par un simple contrôle de session, puisque l'autorisation fine (owner-ou-admin) est désormais vérifiée côté API à partir du `barId` de la bouteille elle-même :

```ts
export async function updateBottleQuantity(id: string, quantity: number) {
  await requireLoggedIn();
  await api.updateBottle(id, { quantity: Math.max(0, quantity) });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath("/");
}

export async function updateBottleVolumes(id: string, volumes: BottleVolume[], imageUrl?: string) {
  await requireLoggedIn();
  const quantity = volumes.reduce((sum, v) => sum + v.quantity, 0);
  await api.updateBottle(id, { volumes, quantity, imageUrl });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
}

export async function updateBottleThreshold(id: string, threshold: number | null) {
  await requireLoggedIn();
  await api.updateBottle(id, { lowStockThreshold: threshold ?? undefined });
  revalidatePath("/stock");
  revalidatePath("/");
}

export async function deleteBottleAction(id: string) {
  await requireLoggedIn();
  await api.deleteBottle(id);
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath("/");
}
```

Ajouter le petit helper `requireLoggedIn` juste avant `requireBarOwnerOrAdmin` (une redirection `/login` simple — la véritable autorisation, propriétaire-ou-admin, est appliquée par l'API à partir du bar réel de la bouteille ; ce garde côté frontend évite juste d'exposer l'action à un visiteur non connecté) :

```ts
async function requireLoggedIn() {
  const session = await getSession();
  if (!session) redirect("/login");
}
```

- [ ] **Step 3: Mettre à jour la page d'accueil**

`src/app/page.tsx` fait 256 lignes ; seules les 16 premières (imports + tout début du corps de la fonction, jusqu'à `accessibleBottles`) changent. Le reste du fichier (tout le JSX du `return`, et `LoungeMetricCard`) est **inchangé**, ne pas y toucher.

Remplacer dans `src/app/page.tsx` :

```tsx
import Link from "next/link";
import { listBottles, listEvents, evaluateCocktails } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";

export default async function HomePage() {
  const [bottles, events, availability, session] = await Promise.all([
    listBottles(),
    listEvents(),
    evaluateCocktails(),
    getSession(),
  ]);

  const isVipOrAdmin = Boolean(session?.vip || session?.role === "ADMIN");
  const accessibleBottles = isVipOrAdmin ? bottles : bottles.filter((b) => !b.vip);
```

par :

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
```

Le reste de la fonction (`stockCount`, `vipCount`, `totalLiters`, `makeableNow`, `lowStock`, `today`, `upcoming`, `nextEvent`, et tout le JSX du `return`) reste identique — ces variables utilisent toujours `bottles`/`events`/`availability`, dont la source a changé mais pas la forme.

- [ ] **Step 4: Mettre à jour la page de stock**

`src/app/stock/page.tsx` fait 71 lignes ; les 29 premières changent (imports, résolution du bar actif, calcul de `canManageStock`, `AddBottleForm` reçoit `barId`). Le reste du JSX (le bandeau de KPIs et le `<StockStudio>` final) reste identique à l'exception de la valeur passée à la prop `isAdmin` de `StockStudio`.

Remplacer dans `src/app/stock/page.tsx` :

```tsx
import { listBottles } from "@/lib/api-client";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { isAdminLoggedIn, getSession } from "@/lib/session";
import StockStudio from "./StockStudio";
import AddBottleForm from "./AddBottleForm";
import PageTransition from "@/components/PageTransition";
import AlertsManagerTrigger from "./AlertsManagerTrigger";

export default async function StockPage() {
  const [isAdmin, session, bottles] = await Promise.all([
    isAdminLoggedIn(),
    getSession(),
    listBottles(),
  ]);

  const isVipOrAdmin = Boolean(session?.vip || session?.role === "ADMIN");

  const normal = bottles.filter((b) => !b.vip);
  const vip = bottles.filter((b) => b.vip);

  const accessibleBottles = isVipOrAdmin ? bottles : normal;

  const totalBottlesCount = accessibleBottles.reduce((sum, b) => sum + calculateTotalBottlesCount(b), 0);
  const totalLitersCount = accessibleBottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const lowStockCount = accessibleBottles.filter(
    (b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold
  ).length;

  const addBottleForm = <AddBottleForm isVip={isVipOrAdmin} />;
```

par :

```tsx
import { redirect } from "next/navigation";
import { listBottles, listMyBars } from "@/lib/api-client";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import StockStudio from "./StockStudio";
import AddBottleForm from "./AddBottleForm";
import PageTransition from "@/components/PageTransition";
import AlertsManagerTrigger from "./AlertsManagerTrigger";

export default async function StockPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const bottles = await listBottles(activeBar.id);

  const isVipOrAdmin = Boolean(session.vip || session.role === "ADMIN" || activeBar.myVip);
  const canManageStock = session.role === "ADMIN" || activeBar.myRole === "OWNER";

  const normal = bottles.filter((b) => !b.vip);
  const vip = bottles.filter((b) => b.vip);

  const accessibleBottles = isVipOrAdmin ? bottles : normal;

  const totalBottlesCount = accessibleBottles.reduce((sum, b) => sum + calculateTotalBottlesCount(b), 0);
  const totalLitersCount = accessibleBottles.reduce((sum, b) => sum + calculateBottleTotalLiters(b), 0);
  const lowStockCount = accessibleBottles.filter(
    (b) => b.lowStockThreshold != null && b.quantity <= b.lowStockThreshold
  ).length;

  const addBottleForm = <AddBottleForm isVip={isVipOrAdmin} barId={activeBar.id} />;
```

Puis, plus loin dans le même fichier, remplacer :

```tsx
      <StockStudio
        normalBottles={normal}
        vipBottles={vip}
        addBottleForm={addBottleForm}
        isAdmin={isAdmin}
        isVip={isVipOrAdmin}
      />
```

par :

```tsx
      <StockStudio
        normalBottles={normal}
        vipBottles={vip}
        addBottleForm={addBottleForm}
        isAdmin={canManageStock}
        isVip={isVipOrAdmin}
      />
```

(`StockStudio`, `BottleDetailModal`, `BottleGridCard`, `BottleListRow`, `BottleTable`, `StockTabs` gardent tous une prop nommée `isAdmin` en interne — on ne renomme pas cette prop dans 6 fichiers pour ce plan, on se contente de lui passer la bonne valeur calculée depuis la page. C'est un choix délibéré de minimiser le diff.)

- [ ] **Step 5: Passer `barId` à `AddBottleForm` et le lier à l'action**

Dans `src/app/stock/AddBottleForm.tsx`, remplacer :

```tsx
export default function AddBottleForm({ isVip = false }: { isVip?: boolean }) {
```

par :

```tsx
export default function AddBottleForm({ isVip = false, barId }: { isVip?: boolean; barId: string }) {
```

Puis remplacer :

```tsx
  return (
    <form action={createBottle} className="grid sm:grid-cols-2 gap-4">
```

par :

```tsx
  return (
    <form action={createBottle.bind(null, barId)} className="grid sm:grid-cols-2 gap-4">
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: plus d'erreurs sur `src/app/page.tsx`, `src/app/stock/page.tsx`, `src/app/stock/AddBottleForm.tsx`, ni sur les fonctions bouteilles de `src/app/actions.ts`. Des erreurs peuvent encore apparaître sur `src/app/cocktails/page.tsx` et les fichiers `src/app/soirees/...` — c'est normal, corrigées dans les tâches 10-11.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/stock/page.tsx src/app/stock/AddBottleForm.tsx src/app/actions.ts
git commit -m "feat(web): scope home/stock pages and bottle management to the active bar"
```

---

### Task 10: Frontend — cocktails, recettes custom

**Files:**
- Modify: `src/app/cocktails/page.tsx`
- Modify: `src/app/cocktails/CreateRecipeModal.tsx`
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `listMyBars`, `resolveActiveBar` (existants), `listBottles(barId)`, `evaluateCocktails(barId)`, `createRecipe(barId, input)` (Task 8).
- Produces: `requireBarVipOrAdmin(barId): Promise<void>` (nouveau helper dans `src/app/actions.ts`, redirige vers `/login` si pas de session, vers `/` si ni `ADMIN` ni VIP sur ce bar).

- [ ] **Step 1: Ajouter le helper `requireBarVipOrAdmin` à `actions.ts`**

Dans `src/app/actions.ts`, ajouter juste après `requireBarOwnerOrAdmin` (créé en Task 9) :

```ts
async function requireBarVipOrAdmin(barId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") return;

  const bars = await api.listMyBars();
  const bar = bars.find((b) => b.id === barId);
  if (!bar || !bar.myVip) redirect("/");
}
```

(`bar.myVip` reflète déjà `BarMembership.vip` pour ce bar — et la ligne `OWNER` d'un bar a toujours `vip: true` posé à la création en phase 1, donc ce contrôle couvre aussi les propriétaires sans condition séparée.)

- [ ] **Step 2: Mettre à jour `createRecipe` et `parseRecipeFormData` pour recevoir un `barId`**

Remplacer dans `src/app/actions.ts` :

```ts
export async function createRecipe(formData: FormData) {
  await requireVipOrAdmin();
  const input = parseRecipeFormData(formData);
  if (!input.name || input.tags.length === 0 || input.ingredientsList.length === 0 || input.instructions.length === 0) {
    return;
  }
  await api.createRecipe(input);
  revalidatePath("/cocktails");
}
```

par :

```ts
export async function createRecipe(barId: string, formData: FormData) {
  await requireBarVipOrAdmin(barId);
  const input = parseRecipeFormData(formData);
  if (!input.name || input.tags.length === 0 || input.ingredientsList.length === 0 || input.instructions.length === 0) {
    return;
  }
  await api.createRecipe(barId, input);
  revalidatePath("/cocktails");
}
```

`updateRecipe(id, formData)` et `deleteRecipeAction(id)` restent **inchangées** — elles opèrent sur une recette existante par `id`, et l'API applique déjà la logique auteur-ou-admin existante (Task 5), indépendante du bar. La fonction `requireVipOrAdmin()` (globale, existante) qu'elles appellent encore reste correcte pour elles : c'est uniquement la *création* qui doit désormais vérifier le VIP *du bar ciblé* plutôt que le VIP global.

- [ ] **Step 3: Mettre à jour la page cocktails**

`src/app/cocktails/page.tsx` fait 41 lignes ; remplacer tout le fichier :

```tsx
import { redirect } from "next/navigation";
import { evaluateCocktails, listBottles, listMyBars } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import CocktailStudio from "./CocktailStudio";
import PageTransition from "@/components/PageTransition";

export default async function CocktailsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const [results, bottles] = await Promise.all([
    evaluateCocktails(activeBar.id),
    listBottles(activeBar.id),
  ]);

  const isVip = Boolean(session.vip || session.role === "ADMIN" || activeBar.myVip);
  const isAdmin = session.role === "ADMIN";
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
        currentUserId={session.sub}
        isAdmin={isAdmin}
        allTags={allTags}
        barId={activeBar.id}
      />
    </PageTransition>
  );
}
```

(Le composant `CocktailStudio` gagne une nouvelle prop `barId`, transmise telle quelle à `CreateRecipeModal` — voir le diff exact au Step 4.)

- [ ] **Step 4: Lier `createRecipe` à `barId` dans `CreateRecipeModal`**

Dans `src/app/cocktails/CreateRecipeModal.tsx`, remplacer :

```tsx
interface CreateRecipeModalProps {
  mode: "create" | "edit";
  allTags: string[];
  initialRecipe?: CocktailRecipe;
  onClose: () => void;
}

export default function CreateRecipeModal({ mode, allTags, initialRecipe, onClose }: CreateRecipeModalProps) {
```

par :

```tsx
interface CreateRecipeModalProps {
  mode: "create" | "edit";
  allTags: string[];
  initialRecipe?: CocktailRecipe;
  onClose: () => void;
  barId: string;
}

export default function CreateRecipeModal({ mode, allTags, initialRecipe, onClose, barId }: CreateRecipeModalProps) {
```

Puis remplacer :

```tsx
  const action = mode === "edit" && initialRecipe ? updateRecipe.bind(null, initialRecipe.id) : createRecipe;
```

par :

```tsx
  const action = mode === "edit" && initialRecipe ? updateRecipe.bind(null, initialRecipe.id) : createRecipe.bind(null, barId);
```

Enfin, dans `src/app/cocktails/CocktailStudio.tsx`, remplacer :

```tsx
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
```

par :

```tsx
interface CocktailStudioProps {
  initialResults: RecipeAvailability[];
  isVip?: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  allTags: string[];
  barId: string;
}

type FormModalState = { mode: "create" } | { mode: "edit"; recipe: CocktailRecipe } | null;

export default function CocktailStudio({
  initialResults,
  isVip = false,
  currentUserId,
  isAdmin = false,
  allTags,
  barId,
}: CocktailStudioProps) {
```

Puis, plus loin dans le même fichier, remplacer l'unique rendu de `CreateRecipeModal` (utilisé aussi bien en mode création qu'édition, via `formModal.mode`) :

```tsx
      {formModal && (
        <CreateRecipeModal
          mode={formModal.mode}
          allTags={allTags}
          initialRecipe={formModal.mode === "edit" ? formModal.recipe : undefined}
          onClose={() => setFormModal(null)}
        />
      )}
```

par :

```tsx
      {formModal && (
        <CreateRecipeModal
          mode={formModal.mode}
          allTags={allTags}
          initialRecipe={formModal.mode === "edit" ? formModal.recipe : undefined}
          onClose={() => setFormModal(null)}
          barId={barId}
        />
      )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: plus d'erreurs sur `src/app/cocktails/*`. Des erreurs peuvent rester sur `src/app/soirees/...` — normal, corrigées en Task 11.

- [ ] **Step 6: Commit**

```bash
git add src/app/cocktails src/app/actions.ts
git commit -m "feat(web): scope cocktails page and custom recipe creation to the active bar"
```

---

### Task 11: Frontend — soirées

**Files:**
- Modify: `src/app/soirees/page.tsx`
- Modify: `src/app/soirees/[slug]/page.tsx`
- Modify: `src/app/soirees/[slug]/bilan/page.tsx`
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `listMyBars`, `resolveActiveBar` (existants), `listEvents(barId)`, `createEvent(barId, input)`, `listBottles(barId)`, `evaluateCocktails(barId)` (Task 8), `requireBarOwnerOrAdmin` (Task 9, réutilisé tel quel).
- `getEvent(slug)`, `listStockAdjustments(slug)`, `listContributions(slug)` restent **inchangées** — le bar se déduit côté API de l'event trouvé (Tasks 4/7), `Contribution` est hors scope de ce plan.

- [ ] **Step 1: Mettre à jour `createEvent` pour recevoir un `barId`**

Remplacer dans `src/app/actions.ts` :

```ts
export async function createEvent(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!name || !date) return;

  const event = await api.createEvent({ name, date });
  revalidatePath("/soirees");
  redirect(`/soirees/${event.slug}`);
}
```

par :

```ts
export async function createEvent(barId: string, formData: FormData) {
  await requireBarOwnerOrAdmin(barId);
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!name || !date) return;

  const event = await api.createEvent(barId, { name, date });
  revalidatePath("/soirees");
  redirect(`/soirees/${event.slug}`);
}
```

`deleteEventAction(slug)` et `submitBilan(slug, formData)` restent **inchangées** dans leur signature — mais remplacer leur `await requireAdmin();` par `await requireLoggedIn();` (créé en Task 9), pour la même raison que les actions bouteilles : l'autorisation fine (propriétaire du bar concerné, ou admin) est désormais vérifiée côté API à partir du `barId` de l'événement (Tasks 4 et 7).

- [ ] **Step 2: Mettre à jour la page liste des soirées**

Dans `src/app/soirees/page.tsx`, remplacer :

```tsx
import Link from "next/link";
import { listEvents } from "@/lib/api-client";
import { createEvent } from "@/app/actions";
import CopyLink from "./CopyLink";
import DeleteEventButton from "./DeleteEventButton";
import PageTransition from "@/components/PageTransition";

export default async function SoireesPage() {
  const events = await listEvents();
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
```

par :

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { listEvents, listMyBars } from "@/lib/api-client";
import { createEvent } from "@/app/actions";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import CopyLink from "./CopyLink";
import DeleteEventButton from "./DeleteEventButton";
import PageTransition from "@/components/PageTransition";

export default async function SoireesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const events = await listEvents(activeBar.id);
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
```

Puis, plus loin dans le même fichier, remplacer :

```tsx
          <form action={createEvent} className="space-y-3.5">
```

par :

```tsx
          <form action={createEvent.bind(null, activeBar.id)} className="space-y-3.5">
```

- [ ] **Step 3: Mettre à jour la page détail d'une soirée**

Dans `src/app/soirees/[slug]/page.tsx`, remplacer :

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

  const [bottles, adjustments, availability, session] = await Promise.all([
    listBottles(),
    listStockAdjustments(slug),
    evaluateCocktails(),
    getSession(),
  ]);

  const contributions = session ? await listContributions(slug) : [];
```

par :

```tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getEvent, listContributions, listBottles, listStockAdjustments, evaluateCocktails, listMyBars } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import GuestPanel from "./GuestPanel";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const event = await getEvent(slug);
  if (!event) notFound();

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const [bottles, adjustments, availability, contributions] = await Promise.all([
    listBottles(activeBar.id),
    listStockAdjustments(slug),
    evaluateCocktails(activeBar.id),
    listContributions(slug),
  ]);
```

(`Contribution` reste accessible à tout compte connecté, comme aujourd'hui — plus besoin de la conditionner à `session`, elle l'est déjà via le `redirect("/login")` ci-dessus.)

- [ ] **Step 4: Mettre à jour la page de bilan**

Dans `src/app/soirees/[slug]/bilan/page.tsx`, remplacer :

```tsx
import { notFound } from "next/navigation";
import { getEvent, listBottles } from "@/lib/api-client";
import BilanClientForm from "./BilanClientForm";

export default async function BilanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const bottles = await listBottles();
  // Sort alphabetically so it is predictable
  bottles.sort((a, b) => a.name.localeCompare(b.name));
```

par :

```tsx
import { notFound, redirect } from "next/navigation";
import { getEvent, listBottles, listMyBars } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import BilanClientForm from "./BilanClientForm";

export default async function BilanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const event = await getEvent(slug);
  if (!event) notFound();

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/creer");

  const bottles = await listBottles(activeBar.id);
  // Sort alphabetically so it is predictable
  bottles.sort((a, b) => a.name.localeCompare(b.name));
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: zéro erreur sur l'ensemble du frontend.

- [ ] **Step 6: Commit**

```bash
git add src/app/soirees src/app/actions.ts
git commit -m "feat(web): scope soirees pages and event management to the active bar"
```

---

### Task 12: Vérification manuelle de bout en bout

**Files:** aucun (vérification uniquement).

- [ ] **Step 1: Lancer la suite de tests API complète**

Run: `cd api && npm test`
Expected: tous les tests passent.

- [ ] **Step 2: Type-check le frontend complet**

Run: `npx tsc --noEmit -p .`
Expected: zéro erreur.

- [ ] **Step 3: Parcours manuel avec deux bars distincts**

En utilisant le navigateur (ou en demandant à l'utilisateur de vérifier, selon la disponibilité de l'environnement d'exécution). Rappel : l'app tourne sous `basePath: "/bar"` — toute URL tapée dans le navigateur a besoin de ce préfixe (ex. `http://localhost:3000/bar/stock`), les chemins ci-dessous sont donnés en logique (sans préfixe) :

1. Compte `owner1` (propriétaire du "Bar de owner1", créé en phase 1) : ajouter une bouteille "Rhum Test A" avec le tag `rhum` dans son bar.
2. Créer un second compte `owner2`, créer son propre bar "Bar de owner2", y ajouter une bouteille "Gin Test B" avec le tag `gin`.
3. Confirmer que `owner1` sur `/stock` (réellement `/bar/stock`) ne voit que "Rhum Test A", jamais "Gin Test B", et inversement pour `owner2`.
4. Confirmer qu'un membre invité (non-owner) du bar de `owner1` peut voir le stock mais ne peut pas ajouter/modifier/supprimer de bouteille (pas de formulaire d'ajout, actions bloquées côté API si tentées directement).
5. Confirmer que créer une soirée fonctionne pour `owner1`, qu'elle n'apparaît pas dans la liste des soirées de `owner2`.
6. Confirmer que les recettes custom créées par `owner1` (VIP sur son bar) n'apparaissent pas dans les cocktails de `owner2`.
7. Confirmer qu'un compte `USER` sans aucun bar (n'a ni créé ni rejoint de bar) est redirigé vers `/creer` en visitant `/`, `/stock`, `/cocktails` ou `/soirees`.
8. Confirmer que les contributions à une soirée (ce que les invités apportent) fonctionnent toujours pour n'importe quel compte connecté, indépendamment de l'appartenance au bar — comportement volontairement inchangé.

- [ ] **Step 4: Commit final (si le parcours a révélé des ajustements)**

Uniquement si l'étape 3 a mené à des corrections de code ; sinon, cette étape est un no-op — la fonctionnalité est déjà entièrement committée tâche par tâche.

