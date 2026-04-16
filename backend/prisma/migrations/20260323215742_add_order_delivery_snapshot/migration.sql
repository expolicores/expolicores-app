-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "deliveryAddressShort" TEXT,
ADD COLUMN "deliveryCity" TEXT,
ADD COLUMN "deliveryCountry" TEXT,
ADD COLUMN "deliveryLabel" TEXT,
ADD COLUMN "deliveryLat" DOUBLE PRECISION,
ADD COLUMN "deliveryLine1" TEXT,
ADD COLUMN "deliveryLine2" TEXT,
ADD COLUMN "deliveryLng" DOUBLE PRECISION,
ADD COLUMN "deliveryNeighborhood" TEXT,
ADD COLUMN "deliveryNotes" TEXT,
ADD COLUMN "deliveryPhone" TEXT,
ADD COLUMN "deliveryRecipient" TEXT,
ADD COLUMN "deliveryState" TEXT;