-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "BarJoinRequest" (
    "id" TEXT NOT NULL,
    "barId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarJoinRequest_barId_userId_key" ON "BarJoinRequest"("barId", "userId");

-- AddForeignKey
ALTER TABLE "BarJoinRequest" ADD CONSTRAINT "BarJoinRequest_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarJoinRequest" ADD CONSTRAINT "BarJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
