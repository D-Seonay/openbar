-- AlterTable
ALTER TABLE "Bottle" ADD COLUMN     "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Bottle_barId_barcode_key" ON "Bottle"("barId", "barcode");

