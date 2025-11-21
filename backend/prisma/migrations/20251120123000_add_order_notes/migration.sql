-- Add optional notes to orders to store customer + address notes
ALTER TABLE "Order" ADD COLUMN "notes" TEXT;
