/**
 * node backend/scripts/validate-feed-ids.js path/to/feed.json
 * Revisa que todos los ids/productId existan en la tabla Product
 */
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const path = process.argv[2];
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  const ids = new Set<string>();
  (raw.slots || []).forEach((s: any) => (s.items || []).forEach((it: any) => {
    const id = String(it.productId ?? it.id ?? '').trim();
    if (id) ids.add(id);
  }));

  const list = [...ids];
  const products = await prisma.product.findMany({ where: { id: { in: list.map(Number).filter(Boolean) } }, select: { id: true } });
  const ok = new Set(products.map(p => String(p.id)));
  const missing = list.filter(id => !ok.has(id));

  console.log(`Total en feed: ${list.length} | Encontrados: ${ok.size} | Faltantes: ${missing.length}`);
  if (missing.length) {
    console.log('Faltantes:', missing);
    process.exitCode = 1;
  }
}
main().finally(() => prisma.$disconnect());
