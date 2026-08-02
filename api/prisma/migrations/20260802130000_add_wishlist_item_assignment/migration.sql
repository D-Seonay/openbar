-- CreateTable
CREATE TABLE "WishlistItemAssignment" (
    "id" TEXT NOT NULL,
    "wishlistItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItemAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItemAssignment_wishlistItemId_userId_key" ON "WishlistItemAssignment"("wishlistItemId", "userId");

-- AddForeignKey
ALTER TABLE "WishlistItemAssignment" ADD CONSTRAINT "WishlistItemAssignment_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "WishlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItemAssignment" ADD CONSTRAINT "WishlistItemAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
