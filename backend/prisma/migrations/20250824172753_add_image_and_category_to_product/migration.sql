-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" VARCHAR(64),
ADD COLUMN     "imageUrl" TEXT;

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");
