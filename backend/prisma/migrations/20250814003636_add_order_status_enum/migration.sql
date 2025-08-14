-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('RECIBIDO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'RECIBIDO';
