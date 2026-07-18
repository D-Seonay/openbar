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
