-- Vaciar promos (según dijiste, no pasa nada)
DELETE FROM "PromotionProduct";

-- Si existe la columna temporal, la usamos; si no, recreamos limpio.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='PromotionProduct' AND column_name='productId_int'
  ) THEN
    -- Si todavía existe la vieja string, quítala
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='PromotionProduct' AND column_name='productId'
        AND data_type IN ('text','character varying')
    ) THEN
      ALTER TABLE "PromotionProduct" DROP COLUMN "productId";
    END IF;

    -- Renombrar int temporal a definitivo y fijar NOT NULL
    ALTER TABLE "PromotionProduct" RENAME COLUMN "productId_int" TO "productId";
    ALTER TABLE "PromotionProduct" ALTER COLUMN "productId" SET NOT NULL;

  ELSE
    -- No hay temporal: recreate limpio la columna definitiva INT NOT NULL
    ALTER TABLE "PromotionProduct" DROP COLUMN IF EXISTS "productId";
    ALTER TABLE "PromotionProduct" ADD COLUMN "productId" INTEGER NOT NULL;
  END IF;
END $$;

-- FK y índice
ALTER TABLE "PromotionProduct"
  DROP CONSTRAINT IF EXISTS "PromotionProduct_productId_fkey";

ALTER TABLE "PromotionProduct"
  ADD CONSTRAINT "PromotionProduct_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;

DROP INDEX IF EXISTS "PromotionProduct_productId_idx";
CREATE INDEX "PromotionProduct_productId_idx" ON "PromotionProduct"("productId");
