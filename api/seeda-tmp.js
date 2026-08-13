const { PrismaClient } = require('@prisma/client'); const bcrypt=require('bcrypt');
const prisma = new PrismaClient();
(async()=>{
  for (const t of ['auditLog','eventMedia','wishlistItemAssignment','wishlistItem','stockAdjustment','contribution','event','bottleVolume','bottle','barMembership','barJoinRequest','recipe','bar','user']) await prisma[t].deleteMany({});
  const hash = await bcrypt.hash('test1234',10);
  const owner = await prisma.user.create({data:{username:'proprio',passwordHash:hash}});
  const member = await prisma.user.create({data:{username:'membre',passwordHash:hash}});
  const bar = await prisma.bar.create({data:{name:'Bar de test',isPublic:false,memberships:{create:[
    {userId:owner.id,role:'OWNER',vip:true},{userId:member.id,role:'MEMBER'}]}}});
  console.log(JSON.stringify({owner:owner.id,member:member.id,bar:bar.id}));
  await prisma.$disconnect();
})();
