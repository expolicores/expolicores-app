/*
  Warnings:

  - A unique constraint covering the columns `[orderId,type]` on the table `NotificationLog` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "NotificationLog_createdAt_idx";

-- DropIndex
DROP INDEX "NotificationLog_orderId_idx";

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
ALTER COLUMN "to" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "NotificationLog_orderId_createdAt_idx" ON "NotificationLog"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_orderId_type_key" ON "NotificationLog"("orderId", "type");
