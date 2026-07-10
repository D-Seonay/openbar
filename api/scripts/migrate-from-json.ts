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
