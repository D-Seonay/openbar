/*
  Warnings:

  - Made the column `barId` on table `Bottle` required. This step will fail if there are existing NULL values in that column.
  - Made the column `barId` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `barId` on table `Recipe` required. This step will fail if there are existing NULL values in that column.

*/

-- Create a default bar if needed, then assign orphaned rows to it before
-- enforcing NOT NULL so existing data doesn't block the migration.
DO $$
DECLARE
  default_bar_id TEXT;
BEGIN
  -- Use the first existing bar, or create one if the table is empty
  SELECT id INTO default_bar_id FROM "Bar" LIMIT 1;

  IF default_bar_id IS NULL THEN
    default_bar_id := gen_random_uuid()::TEXT;
    INSERT INTO "Bar" (id, name, "createdAt")
    VALUES (default_bar_id, 'Bar par défaut', NOW());
  END IF;

  UPDATE "Bottle" SET "barId" = default_bar_id WHERE "barId" IS NULL;
  UPDATE "Event"  SET "barId" = default_bar_id WHERE "barId" IS NULL;
  UPDATE "Recipe" SET "barId" = default_bar_id WHERE "barId" IS NULL;
END $$;

-- AlterTable
ALTER TABLE "Bottle" ALTER COLUMN "barId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "barId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Recipe" ALTER COLUMN "barId" SET NOT NULL;
