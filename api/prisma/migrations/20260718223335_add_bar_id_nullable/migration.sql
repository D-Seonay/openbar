-- AlterTable
ALTER TABLE "Bottle" ADD COLUMN     "barId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "barId" TEXT;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "barId" TEXT;

-- AddForeignKey
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
