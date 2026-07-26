import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Usage: ADMIN_USERNAME=... ADMIN_PASSWORD=... npx ts-node scripts/create-admin.ts',
    );
  }
  if (password.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new Error(`Le nom d'utilisateur "${username}" existe déjà.`);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const admin = await prisma.user.create({
    data: { username, passwordHash, role: 'ADMIN' },
    select: { id: true, username: true, role: true, createdAt: true },
  });

  console.log(`Compte admin créé : "${admin.username}" (${admin.id})`);
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
