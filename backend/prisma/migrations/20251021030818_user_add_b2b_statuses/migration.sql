-- CreateEnum
CREATE TYPE "BusinessVerificationStatus" AS ENUM ('NONE', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdminProcessStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'ATTENDED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminProcessStatus" "AdminProcessStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "businessVerificationStatus" "BusinessVerificationStatus" NOT NULL DEFAULT 'NONE';
