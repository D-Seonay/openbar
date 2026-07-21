/*
  Warnings:

  - A unique constraint covering the columns `[inviteToken]` on the table `Bar` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Bar" ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Bar_inviteToken_key" ON "Bar"("inviteToken");
