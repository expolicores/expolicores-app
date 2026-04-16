-- Recreated to reconcile drift: this matches the current DB state
ALTER TABLE "PromotionProduct" ADD COLUMN IF NOT EXISTS "productId_int" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'PromotionProduct_productId_int_idx'
  ) THEN
    CREATE INDEX "PromotionProduct_productId_int_idx" ON "PromotionProduct"("productId_int");
  END IF;
END $$;
