-- DropForeignKey
ALTER TABLE "NotificationLog" DROP CONSTRAINT "NotificationLog_orderId_fkey";

-- DropIndex
DROP INDEX "NotificationLog_orderId_createdAt_idx";

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "messageSid" TEXT,
ADD COLUMN     "payload" JSONB,
ALTER COLUMN "orderId" DROP NOT NULL,
ALTER COLUMN "channel" DROP NOT NULL,
ALTER COLUMN "channel" DROP DEFAULT,
ALTER COLUMN "ok" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "NotificationLog_messageSid_idx" ON "NotificationLog"("messageSid");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "NotificationLog_orderId_type_key" RENAME TO "orderId_type";
