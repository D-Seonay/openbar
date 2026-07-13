-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('Facile', 'Moyen', 'Expert');

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "glass" TEXT,
    "tags" TEXT[],
    "ingredientsList" TEXT[],
    "instructions" TEXT[],
    "prepTime" TEXT NOT NULL,
    "difficulty" "RecipeDifficulty" NOT NULL DEFAULT 'Moyen',
    "description" TEXT NOT NULL,
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
