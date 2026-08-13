const { PrismaClient } = require('@prisma/client'); const bcrypt=require('bcrypt');
const prisma = new PrismaClient();
(async()=>{
  for (const t of ['eventMedia','wishlistItemAssignment','wishlistItem','stockAdjustment','contribution','event','bottleVolume','bottle','barMembership','barJoinRequest','recipe','bar','user']) await prisma[t].deleteMany({});
  const hash = await bcrypt.hash('t',10);
  const u = await prisma.user.create({data:{username:'proprio',passwordHash:hash}});
  const other = await prisma.user.create({data:{username:'etranger',passwordHash:hash}});
  const bar = await prisma.bar.create({data:{name:'Bar, "chez Léa"',isPublic:false,memberships:{create:[{userId:u.id,role:'OWNER',vip:true}]}}});
  const bar2 = await prisma.bar.create({data:{name:'Bar étranger',isPublic:false,memberships:{create:[{userId:other.id,role:'OWNER',vip:true}]}}});
  await prisma.event.create({data:{slug:'apero-du-samedi-a1b2c3d4',name:'Apéro, chez Léa; ambiance rétro',date:'2026-09-30',barId:bar.id}});
  await prisma.event.create({data:{slug:'nouvel-an-e5f6g7h8',name:'Nouvel An',date:'2026-12-31',barId:bar.id}});
  await prisma.event.create({data:{slug:'prive-etranger-xyz',name:'Soirée privée étrangère',date:'2026-10-01',barId:bar2.id}});
  console.log(JSON.stringify({user:u.id,other:other.id}));
  await prisma.$disconnect();
})();
