import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const q1 = await db.$queryRawUnsafe('SELECT COUNT(*)::int AS cnt FROM "_prisma_migrations";');
  console.log('Migrations in DB:', q1[0].cnt);

  const q2 = await db.$queryRawUnsafe('SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at;');
  console.log('Migrations list:', q2);

  const q3 = await db.$queryRawUnsafe(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='PromotionProduct'
      AND column_name IN ('productId','productId_int');
  `);
  console.log('PromotionProduct columns:', q3);

  const q4 = await db.$queryRawUnsafe(`
    SELECT 'Product' AS tbl, COUNT(*)::int AS c FROM "Product"
    UNION ALL SELECT 'Order', COUNT(*)::int FROM "Order"
    UNION ALL SELECT 'User', COUNT(*)::int FROM "User"
    UNION ALL SELECT 'PromotionProduct', COUNT(*)::int FROM "PromotionProduct";
  `);
  console.log('Table counts:', q4);
}
main().finally(()=>process.exit());
