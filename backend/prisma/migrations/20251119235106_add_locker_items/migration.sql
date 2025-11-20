-- CreateTable
CREATE TABLE "LockerItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LockerItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LockerItem_userId_idx" ON "LockerItem"("userId");

-- CreateIndex
CREATE INDEX "LockerItem_productId_idx" ON "LockerItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "LockerItem_userId_productId_key" ON "LockerItem"("userId", "productId");

-- AddForeignKey
ALTER TABLE "LockerItem" ADD CONSTRAINT "LockerItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockerItem" ADD CONSTRAINT "LockerItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
