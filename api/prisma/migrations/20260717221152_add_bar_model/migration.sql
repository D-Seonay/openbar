-- CreateEnum
CREATE TYPE "BarRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "Bar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarMembership" (
    "id" TEXT NOT NULL,
    "barId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BarRole" NOT NULL,
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarMembership_barId_userId_key" ON "BarMembership"("barId", "userId");

-- AddForeignKey
ALTER TABLE "BarMembership" ADD CONSTRAINT "BarMembership_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarMembership" ADD CONSTRAINT "BarMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
