# NestJS + Postgres API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone NestJS + Postgres API (`api/`) that owns all business logic and persistence for Le Bar de Noa — auth, user accounts, stock, cocktails, soirées, contributions, and bilans — fully testable via HTTP without touching the existing Next.js app.

**Architecture:** A single NestJS app with one module per domain area (Auth, Users, Bottles, Cocktails, Events, Contributions, StockAdjustments), each following controller → service → module, backed by Postgres via Prisma. JWT issued at login is stored in an httpOnly cookie; `JwtAuthGuard` and `RolesGuard` gate routes. This plan does not touch `src/` (the Next.js app) — that integration is a separate follow-up plan.

**Tech Stack:** NestJS 10, Prisma 5 + PostgreSQL 16 (via Docker Compose for local dev), `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` for auth, `bcrypt` for password hashing, `class-validator`/`class-transformer` for DTOs, Jest (NestJS default) for tests.

## Global Constraints

- This plan only creates/modifies files under `api/`, plus a root-level `docker-compose.yml` and `.gitignore`. Do not modify anything under `src/`, `data/`, or other existing Next.js files.
- No functional behavior changes beyond the migration itself: cocktail feasibility logic, stock/volume sync logic, and slug generation must be faithful ports of the existing logic in `src/lib/cocktails.ts` and `src/lib/db.ts`.
- VIP is a boolean on `User`, global to the account (not per-event). Roles are `ADMIN` and `USER`.
- All comments/messages user-facing in French (error messages), code identifiers in English — consistent with the existing codebase's convention.
- Test scope per spec: `AuthService` (bcrypt + JWT), `RolesGuard`, `CocktailsService` (feasibility). Additional tests are added where a task ports non-trivial logic (slug collisions, stock/volume sync) — plain CRUD passthroughs are not unit-tested.
- The full production `docker-compose.yml` (with `api` and `web` services and their Dockerfiles) is out of scope for this plan — Task 1 only adds a `postgres` service for local development. Wiring the complete stack for the home-server deployment is part of the follow-up Next.js integration plan.
- Reference spec: `docs/superpowers/specs/2026-07-10-nestjs-postgres-backend-design.md`.

---

### Task 1: Scaffold the NestJS project and local Postgres

**Files:**
- Create: `api/` (via Nest CLI scaffold)
- Modify: `api/src/app.module.ts`
- Delete: `api/src/app.controller.ts`, `api/src/app.controller.spec.ts`, `api/src/app.service.ts`
- Create: `docker-compose.yml` (repo root)
- Modify: `.gitignore` (repo root)
- Create: `api/.env` (not committed), `api/.env.example` (committed)

**Interfaces:**
- Produces: an empty, bootable `AppModule` at `api/src/app.module.ts` that later tasks add imports to.

- [ ] **Step 1: Scaffold the Nest project**

Run from the repo root:

```bash
npx @nestjs/cli new api --package-manager npm --skip-git --language TypeScript
```

Expected: `api/` directory created with a default Nest app (`src/main.ts`, `src/app.module.ts`, etc.) and its own `package.json`.

- [ ] **Step 2: Remove the default hello-world scaffold**

```bash
rm api/src/app.controller.ts api/src/app.controller.spec.ts api/src/app.service.ts
```

Replace `api/src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
```

- [ ] **Step 3: Install additional dependencies**

```bash
cd api
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt cookie-parser class-validator class-transformer @nestjs/mapped-types @prisma/client
npm install -D prisma @types/passport-jwt @types/bcrypt @types/cookie-parser
cd ..
```

- [ ] **Step 4: Add local Postgres via Docker Compose**

Create `docker-compose.yml` at the repo root:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: bardenoa
      POSTGRES_PASSWORD: bardenoa
      POSTGRES_DB: bardenoa
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 5: Configure environment variables**

Create `api/.env.example` (committed, documents required vars):

```
DATABASE_URL="postgresql://bardenoa:bardenoa@localhost:5432/bardenoa"
JWT_SECRET="dev-secret-change-me"
WEB_ORIGIN="http://localhost:3000"
PORT=3001
```

Copy it to the real (gitignored) `api/.env`:

```bash
cp api/.env.example api/.env
```

- [ ] **Step 6: Update `.gitignore` for the new nested project**

Add to `/Users/seonay/Claude/Projects/bardenoa/.gitignore` (the existing `/node_modules` and `/build` entries only match the repo root, so the nested `api/` project needs its own entries):

```
# api/ (NestJS)
api/node_modules
api/dist
```

(`.env*` already in `.gitignore` covers `api/.env` since that pattern has no leading slash.)

- [ ] **Step 7: Start Postgres and verify the Nest app boots**

```bash
docker compose up -d postgres
cd api && npm run start:dev
```

Expected console output: `Nest application successfully started`. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add api docker-compose.yml .gitignore
git commit -m "chore: scaffold NestJS api project with local Postgres"
```

---

### Task 2: Prisma schema, migration, and PrismaService

**Files:**
- Create: `api/prisma/schema.prisma`
- Create: `api/src/prisma/prisma.service.ts`
- Create: `api/src/prisma/prisma.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Produces: `PrismaModule` (global, exported from `api/src/prisma/prisma.module.ts`), `PrismaService` extending `PrismaClient` — every later service injects this via constructor.
- Produces: Prisma models `User`, `Bottle`, `BottleVolume`, `Event`, `Contribution`, `StockAdjustment`, and enums `Role`, `BottleType`, consumed by every subsequent task.

- [ ] **Step 1: Write the Prisma schema**

Create `api/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  USER
}

enum BottleType {
  whisky
  rhum
  vodka
  gin
  tequila
  liqueur
  vin
  champagne
  biere
  mixer
  autre
}

model User {
  id            String         @id @default(cuid())
  username      String         @unique
  passwordHash  String
  role          Role           @default(USER)
  vip           Boolean        @default(false)
  createdAt     DateTime       @default(now())
  contributions Contribution[]
}

model Bottle {
  id                String            @id @default(cuid())
  name              String
  type              BottleType
  quantity          Float
  tags              String[]
  vip               Boolean           @default(false)
  notes             String?
  lowStockThreshold Float?
  imageUrl          String?
  createdAt         DateTime          @default(now())
  volumes           BottleVolume[]
  stockAdjustments  StockAdjustment[]
}

model BottleVolume {
  id       String @id @default(cuid())
  bottleId String
  bottle   Bottle @relation(fields: [bottleId], references: [id], onDelete: Cascade)
  size     String
  quantity Float
}

model Event {
  id               String            @id @default(cuid())
  slug             String            @unique
  name             String
  date             String
  createdAt        DateTime          @default(now())
  contributions    Contribution[]
  stockAdjustments StockAdjustment[]
}

model Contribution {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  item      String
  quantity  String?
  createdAt DateTime @default(now())
}

model StockAdjustment {
  id             String   @id @default(cuid())
  eventId        String
  event          Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  bottleId       String
  bottle         Bottle   @relation(fields: [bottleId], references: [id])
  bottleName     String
  quantityBefore Float
  quantityAfter  Float
  createdAt      DateTime @default(now())
}
```

- [ ] **Step 2: Run the initial migration**

```bash
docker compose up -d postgres
cd api
npx prisma migrate dev --name init
```

Expected: output ends with `Your database is now in sync with your schema.` and a new folder `api/prisma/migrations/<timestamp>_init/` is created.

- [ ] **Step 3: Verify migration status**

```bash
npx prisma migrate status
```

Expected: `Database schema is up to date!`

- [ ] **Step 4: Create `PrismaService` and `PrismaModule`**

Create `api/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

Create `api/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 5: Register `PrismaModule` in `AppModule`**

Update `api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
})
export class AppModule {}
```

- [ ] **Step 6: Verify the app still boots**

```bash
cd api && npm run start:dev
```

Expected: `Nest application successfully started`, no Prisma connection errors. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
cd api
git add prisma src/prisma src/app.module.ts .env.example
git commit -m "feat(api): add Prisma schema and PrismaService"
```

---

### Task 3: Users module (service layer)

**Files:**
- Create: `api/src/users/users.service.ts`
- Create: `api/src/users/users.service.spec.ts`
- Create: `api/src/users/users.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` from Task 2 (`prisma.user.*`).
- Produces: `UsersService` with methods `create(input: { username: string; password: string; role?: Role; vip?: boolean })`, `findAll()`, `findByUsername(username: string)`, `update(id: string, input: { role?: Role; vip?: boolean })`, `remove(id: string)` — consumed by `AuthModule` (Task 4) and `UsersController` (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `api/src/users/users.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: Record<string, jest.Mock> };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('hashes the password before storing the user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: '1', username: data.username, role: data.role, vip: data.vip, createdAt: new Date() }),
    );

    await service.create({ username: 'noa', password: 'secret123' });

    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.passwordHash).not.toBe('secret123');
    expect(createArgs.data.passwordHash.length).toBeGreaterThan(20);
  });

  it('rejects creating a user with a username that already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(service.create({ username: 'noa', password: 'secret123' })).rejects.toThrow(
      ConflictException,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd api && npx jest users.service --no-coverage
```

Expected: FAIL — `Cannot find module './users.service'`.

- [ ] **Step 3: Implement `UsersService`**

Create `api/src/users/users.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

const PUBLIC_SELECT = { id: true, username: true, role: true, vip: true, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { username: string; password: string; role?: Role; vip?: boolean }) {
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictException("Ce nom d'utilisateur existe déjà");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        role: input.role ?? 'USER',
        vip: input.vip ?? false,
      },
      select: PUBLIC_SELECT,
    });
  }

  findAll() {
    return this.prisma.user.findMany({ select: PUBLIC_SELECT, orderBy: { username: 'asc' } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async update(id: string, input: { role?: Role; vip?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.prisma.user.update({ where: { id }, data: input, select: PUBLIC_SELECT });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd api && npx jest users.service --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Create `UsersModule` and register it in `AppModule`**

Create `api/src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

Update `api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, UsersModule],
})
export class AppModule {}
```

- [ ] **Step 6: Commit**

```bash
cd api
git add src/users src/app.module.ts
git commit -m "feat(api): add UsersService with bcrypt password hashing"
```

---

### Task 4: Auth module (JWT login, guards)

**Files:**
- Create: `api/src/auth/auth.service.ts`
- Create: `api/src/auth/auth.service.spec.ts`
- Create: `api/src/auth/jwt.strategy.ts`
- Create: `api/src/auth/jwt-auth.guard.ts`
- Create: `api/src/auth/roles.decorator.ts`
- Create: `api/src/auth/roles.guard.ts`
- Create: `api/src/auth/roles.guard.spec.ts`
- Create: `api/src/auth/dto/login.dto.ts`
- Create: `api/src/auth/auth.controller.ts`
- Create: `api/src/auth/auth.module.ts`
- Modify: `api/src/app.module.ts`
- Modify: `api/src/main.ts`

**Interfaces:**
- Consumes: `UsersService.findByUsername` from Task 3.
- Produces: `JwtPayload` interface (`{ sub, username, role, vip }`), `AuthService.login(username, password)` returning `{ token, user }`, `JwtAuthGuard`, `RolesGuard` + `@Roles(...)` decorator, cookie name `bardenoa_session` — consumed by every controller in Tasks 5–10.

- [ ] **Step 1: Write the failing `AuthService` tests**

Create `api/src/auth/auth.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByUsername: jest.Mock };

  beforeEach(async () => {
    usersService = { findByUsername: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('logs in successfully with correct credentials and returns a signed token', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    usersService.findByUsername.mockResolvedValue({
      id: '1',
      username: 'noa',
      passwordHash,
      role: 'ADMIN',
      vip: true,
    });

    const result = await service.login('noa', 'secret123');

    expect(result.token).toBe('signed.jwt.token');
    expect(result.user).toEqual({ id: '1', username: 'noa', role: 'ADMIN', vip: true });
  });

  it('rejects login with a wrong password', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    usersService.findByUsername.mockResolvedValue({
      id: '1',
      username: 'noa',
      passwordHash,
      role: 'USER',
      vip: false,
    });

    await expect(service.login('noa', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login for an unknown username', async () => {
    usersService.findByUsername.mockResolvedValue(null);

    await expect(service.login('ghost', 'whatever')).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd api && npx jest auth.service --no-coverage
```

Expected: FAIL — `Cannot find module './auth.service'`.

- [ ] **Step 3: Implement `AuthService`**

Create `api/src/auth/auth.service.ts`:

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

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
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
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd api && npx jest auth.service --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing `RolesGuard` tests**

Create `api/src/auth/roles.guard.spec.ts`:

```ts
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when the route has no @Roles decorator', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: 'USER' }))).toBe(true);
  });

  it('allows an ADMIN user on a route that requires ADMIN', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('rejects a USER on a route that requires ADMIN', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: 'USER' }))).toBe(false);
  });

  it('rejects when there is no authenticated user on the request', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
cd api && npx jest roles.guard --no-coverage
```

Expected: FAIL — `Cannot find module './roles.guard'`.

- [ ] **Step 7: Implement the decorator and guard**

Create `api/src/auth/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

Create `api/src/auth/roles.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import type { JwtPayload } from './auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) return false;
    return requiredRoles.includes(user.role);
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
cd api && npx jest roles.guard --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 9: Implement the JWT strategy, guard, login DTO, and controller**

Create `api/src/auth/jwt.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { JwtPayload } from './auth.service';

export const SESSION_COOKIE = 'bardenoa_session';

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.[SESSION_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}
```

Create `api/src/auth/jwt-auth.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Create `api/src/auth/dto/login.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}
```

Create `api/src/auth/auth.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SESSION_COOKIE } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.login(dto.username, dto.password);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
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

Create `api/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 10: Register `AuthModule` in `AppModule`, wire cookie parsing and validation in `main.ts`**

Update `api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule],
})
export class AppModule {}
```

Update `api/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

- [ ] **Step 11: Verify the app boots**

```bash
cd api && npm run start:dev
```

Expected: `Nest application successfully started`, routes `POST /auth/login` and `POST /auth/logout` registered (visible in the Nest startup log as `Mapped {/auth/login, POST} route`). Stop with Ctrl+C.

- [ ] **Step 12: Commit**

```bash
cd api
git add src/auth src/app.module.ts src/main.ts
git commit -m "feat(api): add JWT auth (login/logout, guards, roles)"
```

---

### Task 5: Users module (protected controller)

**Files:**
- Create: `api/src/users/dto/create-user.dto.ts`
- Create: `api/src/users/dto/update-user.dto.ts`
- Create: `api/src/users/users.controller.ts`
- Modify: `api/src/users/users.module.ts`

**Interfaces:**
- Consumes: `UsersService` (Task 3), `JwtAuthGuard`, `RolesGuard`, `@Roles` (Task 4).
- Produces: `POST/GET /users`, `PATCH/DELETE /users/:id`, all `ADMIN`-only.

- [ ] **Step 1: Create the DTOs**

Create `api/src/users/dto/create-user.dto.ts`:

```ts
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  vip?: boolean;
}
```

Create `api/src/users/dto/update-user.dto.ts`:

```ts
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  vip?: boolean;
}
```

- [ ] **Step 2: Create the controller**

Create `api/src/users/users.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
```

- [ ] **Step 3: Wire the controller into `UsersModule`**

Update `api/src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 4: Manual verification**

```bash
docker compose up -d postgres
cd api && npm run start:dev &
sleep 2
curl -i -X POST http://localhost:3001/users -H "Content-Type: application/json" -d '{"username":"noa","password":"secret123","role":"ADMIN","vip":true}'
```

Expected: `401 Unauthorized` (no session cookie yet — confirms the route is guarded). Stop the dev server (`kill %1` or Ctrl+C in its terminal).

- [ ] **Step 5: Commit**

```bash
cd api
git add src/users
git commit -m "feat(api): add admin-only users CRUD controller"
```

---

### Task 6: Bottles module

**Files:**
- Create: `api/src/bottles/dto/create-bottle.dto.ts`
- Create: `api/src/bottles/dto/update-bottle.dto.ts`
- Create: `api/src/bottles/bottles.service.ts`
- Create: `api/src/bottles/bottles.controller.ts`
- Create: `api/src/bottles/bottles.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `JwtAuthGuard`, `RolesGuard`, `@Roles`.
- Produces: `BottlesService` with `findAll()`, `findOne(id)`, `create(dto)`, `update(id, dto)`, `remove(id)` — exported for `CocktailsModule` (Task 7) and `StockAdjustmentsModule` (Task 10). Routes `GET/POST /bottles`, `GET/PATCH/DELETE /bottles/:id`, all `ADMIN`-only.

- [ ] **Step 1: Create the DTOs**

Create `api/src/bottles/dto/create-bottle.dto.ts`:

```ts
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BottleType } from '@prisma/client';

class BottleVolumeDto {
  @IsString()
  size: string;

  @IsNumber()
  quantity: number;
}

export class CreateBottleDto {
  @IsString()
  name: string;

  @IsEnum(BottleType)
  type: BottleType;

  @IsNumber()
  quantity: number;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsBoolean()
  vip: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BottleVolumeDto)
  volumes?: BottleVolumeDto[];
}
```

Create `api/src/bottles/dto/update-bottle.dto.ts`:

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateBottleDto } from './create-bottle.dto';

export class UpdateBottleDto extends PartialType(CreateBottleDto) {}
```

- [ ] **Step 2: Implement `BottlesService`**

Create `api/src/bottles/bottles.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';

@Injectable()
export class BottlesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.bottle.findMany({ include: { volumes: true }, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const bottle = await this.prisma.bottle.findUnique({ where: { id }, include: { volumes: true } });
    if (!bottle) throw new NotFoundException('Bouteille introuvable');
    return bottle;
  }

  create(dto: CreateBottleDto) {
    const { volumes, ...rest } = dto;
    return this.prisma.bottle.create({
      data: { ...rest, volumes: volumes ? { create: volumes } : undefined },
      include: { volumes: true },
    });
  }

  async update(id: string, dto: UpdateBottleDto) {
    await this.findOne(id);
    const { volumes, ...rest } = dto;
    return this.prisma.bottle.update({
      where: { id },
      data: {
        ...rest,
        ...(volumes ? { volumes: { deleteMany: {}, create: volumes } } : {}),
      },
      include: { volumes: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.bottle.delete({ where: { id } });
    return { success: true };
  }
}
```

- [ ] **Step 3: Implement `BottlesController`**

Create `api/src/bottles/bottles.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BottlesService } from './bottles.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('bottles')
export class BottlesController {
  constructor(private readonly bottlesService: BottlesService) {}

  @Get()
  findAll() {
    return this.bottlesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bottlesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBottleDto) {
    return this.bottlesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBottleDto) {
    return this.bottlesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bottlesService.remove(id);
  }
}
```

- [ ] **Step 4: Create `BottlesModule` and register it in `AppModule`**

Create `api/src/bottles/bottles.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { BottlesService } from './bottles.service';
import { BottlesController } from './bottles.controller';

@Module({
  controllers: [BottlesController],
  providers: [BottlesService],
  exports: [BottlesService],
})
export class BottlesModule {}
```

Update `api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BottlesModule } from './bottles/bottles.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, BottlesModule],
})
export class AppModule {}
```

- [ ] **Step 5: Verify the app boots**

```bash
cd api && npm run start:dev
```

Expected: startup log shows `Mapped {/bottles, GET} route`, `Mapped {/bottles, POST} route`, etc. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
cd api
git add src/bottles src/app.module.ts
git commit -m "feat(api): add bottles CRUD with volumes"
```

---

### Task 7: Cocktails module (feasibility engine)

**Files:**
- Create: `api/src/cocktails/cocktails.data.ts`
- Create: `api/src/cocktails/cocktails.service.ts`
- Create: `api/src/cocktails/cocktails.service.spec.ts`
- Create: `api/src/cocktails/cocktails.controller.ts`
- Create: `api/src/cocktails/cocktails.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `BottlesService.findAll()` from Task 6 (returns bottles with `{ quantity, tags, vip }` shape compatible with the feasibility function).
- Produces: `evaluateRecipes(bottles)` pure function and `CocktailsService.evaluate()` returning `RecipeAvailability[]` (`{ recipe, makeable, usesVip, missingTags }`), exposed at `GET /cocktails`.

- [ ] **Step 1: Port the static recipe catalog**

Create `api/src/cocktails/cocktails.data.ts`. This is a byte-for-byte port of the data already in the repo — no new content to invent, no judgment calls: open `src/lib/cocktails.ts`, copy the `CocktailRecipe` interface (lines 3–13) and the full `COCKTAILS` array (lines 16–380, all 20 recipes from `mojito` through `amaretto-sour`) verbatim into the new file, changing only the `export` of the interface (it isn't exported in the source file, but must be exported here since `cocktails.service.ts` in Step 4 imports it as a type). The `evaluateRecipes` tests in Step 2 exercise this data directly (by recipe `id` and expected `tags`), so any transcription mistake shows up as a failing test in Step 3.

The resulting file's shape:

```ts
export interface CocktailRecipe {
  id: string;
  name: string;
  glass?: string;
  tags: string[];
  ingredientsList: string[];
  instructions: string[];
  prepTime: string;
  difficulty: 'Facile' | 'Moyen' | 'Expert';
  description: string;
}

export const COCKTAILS: CocktailRecipe[] = [
  { id: 'mojito', name: 'Mojito', /* ...full recipe fields as in src/lib/cocktails.ts... */ },
  // ...remaining 19 recipes, copied verbatim from src/lib/cocktails.ts lines 16-380...
];
```

- [ ] **Step 2: Write the failing feasibility tests**

Create `api/src/cocktails/cocktails.service.spec.ts` (ported 1:1 from `src/lib/cocktails.test.ts`):

```ts
import { evaluateRecipes } from './cocktails.service';
import { COCKTAILS } from './cocktails.data';

interface TestBottle {
  quantity: number;
  tags: string[];
  vip: boolean;
}

function bottle(overrides: Partial<TestBottle>): TestBottle {
  return {
    quantity: overrides.quantity ?? 1,
    tags: overrides.tags ?? [],
    vip: overrides.vip ?? false,
  };
}

describe('evaluateRecipes', () => {
  it('marks a recipe makeable when every required tag is covered', () => {
    const bottles = [bottle({ tags: ['rhum blanc'] }), bottle({ tags: ['cola'] }), bottle({ tags: ['citron vert'] })];
    const results = evaluateRecipes(bottles);
    const cubaLibre = results.find((r) => r.recipe.id === 'cuba-libre')!;
    expect(cubaLibre.makeable).toBe(true);
    expect(cubaLibre.missingTags).toEqual([]);
  });

  it('lists the missing tags for a recipe that cannot be made', () => {
    const bottles = [bottle({ tags: ['rhum blanc'] })];
    const results = evaluateRecipes(bottles);
    const cubaLibre = results.find((r) => r.recipe.id === 'cuba-libre')!;
    expect(cubaLibre.makeable).toBe(false);
    expect(cubaLibre.missingTags).toEqual(['cola', 'citron vert']);
  });

  it('ignores bottles with zero quantity', () => {
    const bottles = [bottle({ tags: ['rhum blanc'], quantity: 0 })];
    const results = evaluateRecipes(bottles);
    const daiquiri = results.find((r) => r.recipe.id === 'daiquiri')!;
    expect(daiquiri.missingTags).toContain('rhum blanc');
  });

  it('prefers a non-VIP bottle over a VIP bottle covering the same tag', () => {
    const bottles = [bottle({ tags: ['whisky'], vip: true }), bottle({ tags: ['whisky'], vip: false }), bottle({ tags: ['cola'] })];
    const results = evaluateRecipes(bottles);
    const whiskyCoca = results.find((r) => r.recipe.id === 'whisky-coca')!;
    expect(whiskyCoca.makeable).toBe(true);
    expect(whiskyCoca.usesVip).toBe(false);
  });

  it('flags a recipe as VIP-only when only a VIP bottle covers a required tag', () => {
    const bottles = [bottle({ tags: ['whisky'], vip: true }), bottle({ tags: ['cola'] })];
    const results = evaluateRecipes(bottles);
    const whiskyCoca = results.find((r) => r.recipe.id === 'whisky-coca')!;
    expect(whiskyCoca.makeable).toBe(true);
    expect(whiskyCoca.usesVip).toBe(true);
  });

  it('matches tags case-insensitively', () => {
    const bottles = [bottle({ tags: ['RHUM Blanc'] }), bottle({ tags: ['Cola'] }), bottle({ tags: ['Citron Vert'] })];
    const results = evaluateRecipes(bottles);
    const cubaLibre = results.find((r) => r.recipe.id === 'cuba-libre')!;
    expect(cubaLibre.makeable).toBe(true);
  });

  it('evaluates every recipe in the catalog', () => {
    const results = evaluateRecipes([]);
    expect(results).toHaveLength(COCKTAILS.length);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd api && npx jest cocktails.service --no-coverage
```

Expected: FAIL — `Cannot find module './cocktails.service'`.

- [ ] **Step 4: Implement `evaluateRecipes` and `CocktailsService`**

Create `api/src/cocktails/cocktails.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { BottlesService } from '../bottles/bottles.service';
import { COCKTAILS, type CocktailRecipe } from './cocktails.data';

export interface RecipeAvailability {
  recipe: CocktailRecipe;
  makeable: boolean;
  usesVip: boolean;
  missingTags: string[];
}

interface StockLike {
  quantity: number;
  tags: string[];
  vip: boolean;
}

function normalize(tag: string) {
  return tag.trim().toLowerCase();
}

export function evaluateRecipes(bottles: StockLike[]): RecipeAvailability[] {
  const inStock = bottles.filter((b) => b.quantity > 0);

  function bestMatch(tag: string) {
    const candidates = inStock.filter((b) => b.tags.map(normalize).includes(normalize(tag)));
    if (candidates.length === 0) return null;
    return candidates.find((b) => !b.vip) ?? candidates[0];
  }

  return COCKTAILS.map((recipe) => {
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

@Injectable()
export class CocktailsService {
  constructor(private readonly bottlesService: BottlesService) {}

  async evaluate(): Promise<RecipeAvailability[]> {
    const bottles = await this.bottlesService.findAll();
    return evaluateRecipes(bottles);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd api && npx jest cocktails.service --no-coverage
```

Expected: PASS (7 tests).

- [ ] **Step 6: Implement the controller, module, and register in `AppModule`**

Create `api/src/cocktails/cocktails.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CocktailsService } from './cocktails.service';

@UseGuards(JwtAuthGuard)
@Controller('cocktails')
export class CocktailsController {
  constructor(private readonly cocktailsService: CocktailsService) {}

  @Get()
  evaluate() {
    return this.cocktailsService.evaluate();
  }
}
```

Create `api/src/cocktails/cocktails.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { BottlesModule } from '../bottles/bottles.module';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';

@Module({
  imports: [BottlesModule],
  controllers: [CocktailsController],
  providers: [CocktailsService],
})
export class CocktailsModule {}
```

Update `api/src/app.module.ts` to add `CocktailsModule` to the `imports` array (alongside the existing ones).

- [ ] **Step 7: Verify the app boots**

```bash
cd api && npm run start:dev
```

Expected: startup log shows `Mapped {/cocktails, GET} route`. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
cd api
git add src/cocktails src/app.module.ts
git commit -m "feat(api): port cocktail feasibility engine from src/lib/cocktails.ts"
```

---

### Task 8: Events module

**Files:**
- Create: `api/src/events/dto/create-event.dto.ts`
- Create: `api/src/events/events.service.ts`
- Create: `api/src/events/events.service.spec.ts`
- Create: `api/src/events/events.controller.ts`
- Create: `api/src/events/events.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`.
- Produces: `EventsService` with `findAll()`, `findBySlug(slug)` (throws `NotFoundException` if missing), `create(dto)`, `remove(slug)` — `findBySlug` and the model shape (`{ id, slug, name, date }`) are consumed by `ContributionsModule` (Task 9) and `StockAdjustmentsModule` (Task 10). Routes `GET/POST /events`, `DELETE /events/:slug`, `ADMIN`-only.

- [ ] **Step 1: Write the failing slug tests**

Create `api/src/events/events.service.spec.ts`:

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

    const event = await service.create({ name: 'Apéro du samedi', date: '2026-07-11' });

    expect(event.slug).toBe('apero-du-samedi');
  });

  it('appends a numeric suffix when the slug already exists', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({ slug: 'apero-du-samedi' })
      .mockResolvedValueOnce(null);
    prisma.event.create.mockImplementation(({ data }) => Promise.resolve(data));

    const event = await service.create({ name: 'Apéro du samedi', date: '2026-07-18' });

    expect(event.slug).toBe('apero-du-samedi-2');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd api && npx jest events.service --no-coverage
```

Expected: FAIL — `Cannot find module './events.service'`.

- [ ] **Step 3: Implement `EventsService`**

Create `api/src/events/dto/create-event.dto.ts`:

```ts
import { IsDateString, IsString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsDateString()
  date: string;
}
```

Create `api/src/events/events.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'soiree'
  );
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.event.findMany({ orderBy: { date: 'asc' } });
  }

  async findBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Soirée introuvable');
    return event;
  }

  async create(dto: CreateEventDto) {
    const base = slugify(dto.name);
    let slug = base;
    let n = 1;
    while (await this.prisma.event.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return this.prisma.event.create({ data: { name: dto.name, date: dto.date, slug } });
  }

  async remove(slug: string) {
    await this.findBySlug(slug);
    await this.prisma.event.delete({ where: { slug } });
    return { success: true };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd api && npx jest events.service --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Implement the controller, module, and register in `AppModule`**

Create `api/src/events/events.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.eventsService.remove(slug);
  }
}
```

Create `api/src/events/events.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
```

Update `api/src/app.module.ts` to add `EventsModule` to the `imports` array.

- [ ] **Step 6: Verify the app boots**

```bash
cd api && npm run start:dev
```

Expected: startup log shows `Mapped {/events, GET} route`, `Mapped {/events, POST} route`, `Mapped {/events/:slug, DELETE} route`. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
cd api
git add src/events src/app.module.ts
git commit -m "feat(api): add events CRUD with slug generation"
```

---

### Task 9: Contributions module

**Files:**
- Create: `api/src/contributions/dto/create-contribution.dto.ts`
- Create: `api/src/contributions/contributions.service.ts`
- Create: `api/src/contributions/contributions.controller.ts`
- Create: `api/src/contributions/contributions.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `EventsService.findBySlug(slug)` (Task 8), `JwtAuthGuard` + `JwtPayload` (Task 4).
- Produces: `GET/POST /events/:slug/contributions`, `DELETE /events/:slug/contributions/:id`, authenticated (any role). A contribution's `userId` is always the authenticated caller — never taken from the request body.

- [ ] **Step 1: Create the DTO**

Create `api/src/contributions/dto/create-contribution.dto.ts`:

```ts
import { IsOptional, IsString } from 'class-validator';

export class CreateContributionDto {
  @IsString()
  item: string;

  @IsOptional()
  @IsString()
  quantity?: string;
}
```

- [ ] **Step 2: Implement `ContributionsService`**

Create `api/src/contributions/contributions.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { CreateContributionDto } from './dto/create-contribution.dto';

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async findForEvent(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.contribution.findMany({
      where: { eventId: event.id },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(slug: string, userId: string, dto: CreateContributionDto) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.contribution.create({
      data: { eventId: event.id, userId, item: dto.item, quantity: dto.quantity },
      include: { user: { select: { id: true, username: true } } },
    });
  }

  async remove(id: string, userId: string) {
    const contribution = await this.prisma.contribution.findUnique({ where: { id } });
    if (!contribution || contribution.userId !== userId) {
      throw new NotFoundException('Contribution introuvable');
    }
    await this.prisma.contribution.delete({ where: { id } });
    return { success: true };
  }
}
```

- [ ] **Step 3: Implement the controller, module, and register in `AppModule`**

Create `api/src/contributions/contributions.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';

@UseGuards(JwtAuthGuard)
@Controller('events/:slug/contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get()
  findAll(@Param('slug') slug: string) {
    return this.contributionsService.findForEvent(slug);
  }

  @Post()
  create(@Param('slug') slug: string, @Body() dto: CreateContributionDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.contributionsService.create(slug, user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.contributionsService.remove(id, user.sub);
  }
}
```

Create `api/src/contributions/contributions.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { ContributionsService } from './contributions.service';
import { ContributionsController } from './contributions.controller';

@Module({
  imports: [EventsModule],
  controllers: [ContributionsController],
  providers: [ContributionsService],
})
export class ContributionsModule {}
```

Update `api/src/app.module.ts` to add `ContributionsModule` to the `imports` array.

- [ ] **Step 4: Verify the app boots**

```bash
cd api && npm run start:dev
```

Expected: startup log shows `Mapped {/events/:slug/contributions, GET} route` and the `POST`/`DELETE` variants. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
cd api
git add src/contributions src/app.module.ts
git commit -m "feat(api): add contributions tied to the authenticated user"
```

---

### Task 10: StockAdjustments module (bilan post-soirée)

**Files:**
- Create: `api/src/stock-adjustments/dto/apply-stock-adjustments.dto.ts`
- Create: `api/src/stock-adjustments/stock-adjustments.service.ts`
- Create: `api/src/stock-adjustments/stock-adjustments.service.spec.ts`
- Create: `api/src/stock-adjustments/stock-adjustments.controller.ts`
- Create: `api/src/stock-adjustments/stock-adjustments.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `EventsService.findBySlug(slug)` (Task 8).
- Produces: `GET/POST /events/:slug/stock-adjustments`, `ADMIN`-only. `StockAdjustmentsService.apply(slug, dto)` returns the created `StockAdjustment[]`.

- [ ] **Step 1: Write the failing volume-sync tests**

Create `api/src/stock-adjustments/stock-adjustments.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

describe('StockAdjustmentsService', () => {
  let service: StockAdjustmentsService;
  let prisma: {
    bottle: { findUnique: jest.Mock; update: jest.Mock };
    bottleVolume: { update: jest.Mock; deleteMany: jest.Mock };
    stockAdjustment: { create: jest.Mock };
  };
  let eventsService: { findBySlug: jest.Mock };

  beforeEach(async () => {
    prisma = {
      bottle: { findUnique: jest.fn(), update: jest.fn() },
      bottleVolume: { update: jest.fn(), deleteMany: jest.fn() },
      stockAdjustment: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'adj-1', ...data })),
      },
    };
    eventsService = { findBySlug: jest.fn().mockResolvedValue({ id: 'event-1', slug: 'apero' }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StockAdjustmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    service = moduleRef.get(StockAdjustmentsService);
  });

  it('removes consumed units from the last volume entries first', async () => {
    prisma.bottle.findUnique.mockResolvedValue({
      id: 'bottle-1',
      name: 'Rhum',
      quantity: 3,
      volumes: [
        { id: 'vol-1', quantity: 1 },
        { id: 'vol-2', quantity: 2 },
      ],
    });

    await service.apply('apero', { changes: [{ bottleId: 'bottle-1', quantityAfter: 1 }] });

    expect(prisma.bottleVolume.update).toHaveBeenCalledWith({ where: { id: 'vol-2' }, data: { quantity: 0 } });
    expect(prisma.bottleVolume.deleteMany).toHaveBeenCalledWith({
      where: { bottleId: 'bottle-1', quantity: { lte: 0 } },
    });
    expect(prisma.bottle.update).toHaveBeenCalledWith({ where: { id: 'bottle-1' }, data: { quantity: 1 } });
  });

  it('adds returned units to the first volume entry when quantity increases', async () => {
    prisma.bottle.findUnique.mockResolvedValue({
      id: 'bottle-1',
      name: 'Rhum',
      quantity: 1,
      volumes: [{ id: 'vol-1', quantity: 1 }],
    });

    await service.apply('apero', { changes: [{ bottleId: 'bottle-1', quantityAfter: 2 }] });

    expect(prisma.bottleVolume.update).toHaveBeenCalledWith({ where: { id: 'vol-1' }, data: { quantity: 2 } });
  });

  it('skips bottles where the quantity is unchanged', async () => {
    prisma.bottle.findUnique.mockResolvedValue({ id: 'bottle-1', name: 'Rhum', quantity: 2, volumes: [] });

    const result = await service.apply('apero', { changes: [{ bottleId: 'bottle-1', quantityAfter: 2 }] });

    expect(result).toEqual([]);
    expect(prisma.bottle.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd api && npx jest stock-adjustments.service --no-coverage
```

Expected: FAIL — `Cannot find module './stock-adjustments.service'`.

- [ ] **Step 3: Implement `StockAdjustmentsService`**

Create `api/src/stock-adjustments/dto/apply-stock-adjustments.dto.ts`:

```ts
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class StockChangeDto {
  @IsString()
  bottleId: string;

  @IsNumber()
  quantityAfter: number;
}

export class ApplyStockAdjustmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockChangeDto)
  changes: StockChangeDto[];
}
```

Create `api/src/stock-adjustments/stock-adjustments.service.ts` (faithful port of `applyStockAdjustments` in `src/lib/db.ts`):

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ApplyStockAdjustmentsDto } from './dto/apply-stock-adjustments.dto';

@Injectable()
export class StockAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async findForEvent(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.stockAdjustment.findMany({ where: { eventId: event.id }, orderBy: { createdAt: 'asc' } });
  }

  async apply(slug: string, dto: ApplyStockAdjustmentsDto) {
    const event = await this.eventsService.findBySlug(slug);
    const created = [];

    for (const change of dto.changes) {
      const bottle = await this.prisma.bottle.findUnique({
        where: { id: change.bottleId },
        include: { volumes: true },
      });
      if (!bottle) continue;

      const quantityBefore = bottle.quantity;
      const quantityAfter = Math.max(0, change.quantityAfter);
      if (quantityBefore === quantityAfter) continue;

      const diff = quantityBefore - quantityAfter;

      if (bottle.volumes.length > 0) {
        if (diff > 0) {
          let toRemove = diff;
          for (let i = bottle.volumes.length - 1; i >= 0 && toRemove > 0; i--) {
            const vol = bottle.volumes[i];
            const removeHere = Math.min(vol.quantity, toRemove);
            if (removeHere > 0) {
              await this.prisma.bottleVolume.update({
                where: { id: vol.id },
                data: { quantity: vol.quantity - removeHere },
              });
            }
            toRemove -= removeHere;
          }
          await this.prisma.bottleVolume.deleteMany({
            where: { bottleId: bottle.id, quantity: { lte: 0 } },
          });
        } else if (diff < 0) {
          const added = Math.abs(diff);
          const firstVolume = bottle.volumes[0];
          await this.prisma.bottleVolume.update({
            where: { id: firstVolume.id },
            data: { quantity: firstVolume.quantity + added },
          });
        }
      }

      await this.prisma.bottle.update({ where: { id: bottle.id }, data: { quantity: quantityAfter } });

      const adjustment = await this.prisma.stockAdjustment.create({
        data: {
          eventId: event.id,
          bottleId: bottle.id,
          bottleName: bottle.name,
          quantityBefore,
          quantityAfter,
        },
      });
      created.push(adjustment);
    }

    return created;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd api && npx jest stock-adjustments.service --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Implement the controller, module, and register in `AppModule`**

Create `api/src/stock-adjustments/stock-adjustments.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { ApplyStockAdjustmentsDto } from './dto/apply-stock-adjustments.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('events/:slug/stock-adjustments')
export class StockAdjustmentsController {
  constructor(private readonly stockAdjustmentsService: StockAdjustmentsService) {}

  @Get()
  findAll(@Param('slug') slug: string) {
    return this.stockAdjustmentsService.findForEvent(slug);
  }

  @Post()
  apply(@Param('slug') slug: string, @Body() dto: ApplyStockAdjustmentsDto) {
    return this.stockAdjustmentsService.apply(slug, dto);
  }
}
```

Create `api/src/stock-adjustments/stock-adjustments.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockAdjustmentsController } from './stock-adjustments.controller';

@Module({
  imports: [EventsModule],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}
```

Update `api/src/app.module.ts` — this is the final module, so the full `imports` array now reads:

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
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Run the full test suite**

```bash
cd api && npm test
```

Expected: all test suites pass (Users, Auth, RolesGuard, Cocktails, Events, StockAdjustments).

- [ ] **Step 7: Commit**

```bash
cd api
git add src/stock-adjustments src/app.module.ts
git commit -m "feat(api): add stock-adjustments (bilan post-soirée) with volume sync"
```

---

### Task 11: Migration script from `data/store.json`

**Files:**
- Create: `api/scripts/migrate-from-json.ts`
- Modify: `api/package.json` (add a `migrate:json` script)

**Interfaces:**
- Consumes: `data/store.json` (repo root, existing v1/v2 file format: `{ bottles, events, contributions, stockAdjustments }`).
- Produces: populated Postgres database — one `User` per unique `guestName` found in `contributions`, plus one `ADMIN` user, entered interactively.

- [ ] **Step 1: Write the migration script**

Create `api/scripts/migrate-from-json.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface LegacyBottleVolume {
  size: string;
  quantity: number;
}

interface LegacyBottle {
  id: string;
  name: string;
  type: string;
  quantity: number;
  tags: string[];
  vip: boolean;
  notes?: string;
  lowStockThreshold?: number;
  imageUrl?: string;
  volumes?: LegacyBottleVolume[];
}

interface LegacyEvent {
  slug: string;
  name: string;
  date: string;
}

interface LegacyContribution {
  eventSlug: string;
  guestName: string;
  item: string;
  quantity?: string;
}

interface LegacyStockAdjustment {
  eventSlug: string;
  bottleId: string;
  bottleName: string;
  quantityBefore: number;
  quantityAfter: number;
}

interface LegacyStore {
  bottles: LegacyBottle[];
  events: LegacyEvent[];
  contributions: LegacyContribution[];
  stockAdjustments: LegacyStockAdjustment[];
}

function randomPassword(): string {
  return Math.random().toString(36).slice(2, 10);
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function uniqueUsername(base: string): Promise<string> {
  let username = base;
  let n = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    n += 1;
    username = `${base}-${n}`;
  }
  return username;
}

async function main() {
  const storePath = path.join(__dirname, '..', '..', 'data', 'store.json');
  const raw = fs.readFileSync(storePath, 'utf-8');
  const store: LegacyStore = JSON.parse(raw);

  const adminUsername = await ask("Nom d'utilisateur admin: ");
  const adminPassword = await ask('Mot de passe admin: ');
  const admin = await prisma.user.create({
    data: {
      username: await uniqueUsername(adminUsername),
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
      vip: true,
    },
  });
  console.log(`Compte admin créé: ${admin.username}`);

  const bottleIdMap = new Map<string, string>();
  for (const b of store.bottles) {
    const created = await prisma.bottle.create({
      data: {
        name: b.name,
        type: b.type as never,
        quantity: b.quantity,
        tags: b.tags ?? [],
        vip: b.vip ?? false,
        notes: b.notes ?? null,
        lowStockThreshold: b.lowStockThreshold ?? null,
        imageUrl: b.imageUrl ?? null,
        volumes: b.volumes?.length
          ? { create: b.volumes.map((v) => ({ size: v.size, quantity: v.quantity })) }
          : undefined,
      },
    });
    bottleIdMap.set(b.id, created.id);
  }
  console.log(`${bottleIdMap.size} bouteilles importées.`);

  const eventIdMap = new Map<string, string>();
  for (const e of store.events) {
    const created = await prisma.event.create({ data: { slug: e.slug, name: e.name, date: e.date } });
    eventIdMap.set(e.slug, created.id);
  }
  console.log(`${eventIdMap.size} soirées importées.`);

  const guestUserMap = new Map<string, string>();
  const uniqueGuestNames = [...new Set(store.contributions.map((c) => c.guestName.trim()))];
  const generatedPasswords: Array<{ username: string; password: string }> = [];
  for (const guestName of uniqueGuestNames) {
    const username = await uniqueUsername(guestName);
    const password = randomPassword();
    const created = await prisma.user.create({
      data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'USER', vip: false },
    });
    guestUserMap.set(guestName, created.id);
    generatedPasswords.push({ username, password });
  }
  console.log(`${guestUserMap.size} comptes invités créés. Mots de passe temporaires à redistribuer :`);
  for (const { username, password } of generatedPasswords) {
    console.log(`  ${username}: ${password}`);
  }

  let contributionCount = 0;
  for (const c of store.contributions) {
    const eventId = eventIdMap.get(c.eventSlug);
    const userId = guestUserMap.get(c.guestName.trim());
    if (!eventId || !userId) continue;
    await prisma.contribution.create({
      data: { eventId, userId, item: c.item, quantity: c.quantity ?? null },
    });
    contributionCount += 1;
  }
  console.log(`${contributionCount} contributions importées.`);

  let adjustmentCount = 0;
  for (const a of store.stockAdjustments) {
    const eventId = eventIdMap.get(a.eventSlug);
    const bottleId = bottleIdMap.get(a.bottleId);
    if (!eventId || !bottleId) continue;
    await prisma.stockAdjustment.create({
      data: {
        eventId,
        bottleId,
        bottleName: a.bottleName,
        quantityBefore: a.quantityBefore,
        quantityAfter: a.quantityAfter,
      },
    });
    adjustmentCount += 1;
  }
  console.log(`${adjustmentCount} ajustements de stock importés.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Add an npm script to run it**

In `api/package.json`, add to `"scripts"`:

```json
"migrate:json": "ts-node scripts/migrate-from-json.ts"
```

Install `ts-node` if not already present as a transitive dependency of the Nest CLI scaffold:

```bash
cd api && npm install -D ts-node
```

- [ ] **Step 3: Manual verification against the real seed data**

```bash
docker compose up -d postgres
cd api
npx prisma migrate reset --force
npm run migrate:json
```

When prompted, enter an admin username/password. Expected: console prints counts of imported bottles/events/contributions/adjustments matching the contents of `data/store.json`, plus a list of generated guest usernames and temporary passwords.

Verify with Prisma Studio:

```bash
npx prisma studio
```

Expected: `User`, `Bottle`, `Event`, `Contribution`, `StockAdjustment` tables show the imported rows in the browser UI. Close Prisma Studio (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
cd api
git add scripts package.json package-lock.json
git commit -m "feat(api): add one-shot migration script from data/store.json"
```

---

### Task 12: End-to-end smoke test of the full API

**Files:**
- None (verification-only task; no new files).

**Interfaces:**
- Consumes: every module built in Tasks 1–11.
- Produces: confidence that the whole API works together over real HTTP requests before starting the Next.js integration plan.

- [ ] **Step 1: Reset the database and start the API**

```bash
docker compose up -d postgres
cd api
npx prisma migrate reset --force
npm run start:dev &
sleep 2
```

- [ ] **Step 2: Create an admin user directly via Prisma (bootstrap, since `/users` requires an existing admin)**

```bash
cd api
cat <<'EOF' > /tmp/bootstrap-admin.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();
bcrypt.hash('adminpass123', 10).then(async (hash) => {
  await prisma.user.create({ data: { username: 'admin', passwordHash: hash, role: 'ADMIN', vip: true } });
  await prisma.$disconnect();
});
EOF
npx ts-node /tmp/bootstrap-admin.ts
```

Expected: no output, exits cleanly.

- [ ] **Step 3: Log in as admin and capture the session cookie**

```bash
curl -i -c /tmp/cookies.txt -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpass123"}'
```

Expected: `200 OK`, body `{"user":{"id":"...","username":"admin","role":"ADMIN","vip":true}}`, and `/tmp/cookies.txt` contains a `bardenoa_session` cookie.

- [ ] **Step 4: Create a regular user, a bottle, an event, and a contribution**

```bash
curl -s -b /tmp/cookies.txt -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"username":"marie","password":"secret123","vip":false}'

curl -s -b /tmp/cookies.txt -X POST http://localhost:3001/bottles \
  -H "Content-Type: application/json" \
  -d '{"name":"Rhum blanc","type":"rhum","quantity":2,"tags":["rhum blanc"],"vip":false}'

curl -s -b /tmp/cookies.txt -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{"name":"Apéro test","date":"2026-07-20"}'
```

Expected: each returns `200`/`201` with the created resource as JSON, including a generated `slug` like `apero-test` for the event.

- [ ] **Step 5: Log in as the regular user and add a contribution**

```bash
curl -i -c /tmp/marie-cookies.txt -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"marie","password":"secret123"}'

curl -s -b /tmp/marie-cookies.txt -X POST http://localhost:3001/events/apero-test/contributions \
  -H "Content-Type: application/json" \
  -d '{"item":"Glaçons","quantity":"2 sacs"}'
```

Expected: `200`, contribution JSON includes `"user":{"username":"marie"}`.

- [ ] **Step 6: Fetch cocktail feasibility and confirm it reflects the new bottle**

```bash
curl -s -b /tmp/cookies.txt http://localhost:3001/cocktails | grep -o '"id":"cuba-libre"[^}]*"missingTags":\[[^]]*\]'
```

Expected: the Cuba Libre entry's `missingTags` includes `cola` and `citron vert` (only `rhum blanc` is in stock).

- [ ] **Step 7: Run a bilan (stock adjustment) and confirm the bottle quantity updates**

```bash
BOTTLE_ID=$(curl -s -b /tmp/cookies.txt http://localhost:3001/bottles | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

curl -s -b /tmp/cookies.txt -X POST http://localhost:3001/events/apero-test/stock-adjustments \
  -H "Content-Type: application/json" \
  -d "{\"changes\":[{\"bottleId\":\"$BOTTLE_ID\",\"quantityAfter\":1}]}"

curl -s -b /tmp/cookies.txt http://localhost:3001/bottles/$BOTTLE_ID | grep -o '"quantity":[0-9.]*'
```

Expected: the stock-adjustment response is a non-empty array, and the final `quantity` reads `1`.

- [ ] **Step 8: Clean up**

```bash
kill %1
rm -f /tmp/bootstrap-admin.ts /tmp/cookies.txt /tmp/marie-cookies.txt
```

- [ ] **Step 9: No commit for this task** — it is verification-only. If any step failed, fix the underlying module in its own follow-up commit before considering this plan complete.
