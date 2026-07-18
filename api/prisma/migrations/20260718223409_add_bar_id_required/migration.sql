/*
  Warnings:

  - Made the column `barId` on table `Bottle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `barId` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `barId` on table `Recipe` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Bottle" ALTER COLUMN "barId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "barId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Recipe" ALTER COLUMN "barId" SET NOT NULL;
