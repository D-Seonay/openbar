const { PrismaClient } = require('@prisma/client'); const bcrypt=require('bcrypt');
const prisma = new PrismaClient();
(async()=>{
  for (const t of ['eventMedia','wishlistItemAssignment','wishlistItem','stockAdjustment','contribution','event','bottleVolume','bottle','barMembership','barJoinRequest','recipe','bar','user']) await prisma[t].deleteMany({});
  const u = await prisma.user.create({data:{username:'admin',passwordHash:await bcrypt.hash('test1234',10),role:'ADMIN'}});
  console.log(u.id); await prisma.$disconnect();
})();
