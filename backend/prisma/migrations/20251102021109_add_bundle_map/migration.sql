-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PromotionType" ADD VALUE 'X_FOR_Y';
ALTER TYPE "PromotionType" ADD VALUE 'GIFT_WITH_PURCHASE';

-- CreateTable
CREATE TABLE "BundleMap" (
    "bundleId" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundleMap_pkey" PRIMARY KEY ("bundleId")
);
