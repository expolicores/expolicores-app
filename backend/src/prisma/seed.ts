import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const products = [
  { name: 'Club Colombia Dorada 330ml', price: 4500, stock: 100, description: 'Cerveza dorada', category: 'Cerveza', imageUrl: 'https://picsum.photos/seed/club/400/400' },
  { name: 'Poker Lata 330ml', price: 3500, stock: 120, description: 'Cerveza lager', category: 'Cerveza', imageUrl: 'https://picsum.photos/seed/poker/400/400' },
  { name: 'Corona 355ml', price: 6500, stock: 60, description: 'Cerveza mexicana', category: 'Cerveza', imageUrl: 'https://picsum.photos/seed/corona/400/400' },
  { name: 'Concha y Toro Reservado Cabernet 750ml', price: 42000, stock: 20, description: 'Cabernet', category: 'Vino', imageUrl: 'https://picsum.photos/seed/cabernet/400/400' },
  { name: 'Gato Negro Merlot 750ml', price: 38000, stock: 18, description: 'Merlot', category: 'Vino', imageUrl: 'https://picsum.photos/seed/merlot/400/400' },
  { name: 'Ron Medellín Añejo 750ml', price: 56000, stock: 25, description: 'Añejo', category: 'Ron', imageUrl: 'https://picsum.photos/seed/medellin/400/400' },
  { name: 'Ron Viejo de Caldas 8 años 750ml', price: 69000, stock: 15, description: '8 años', category: 'Ron', imageUrl: 'https://picsum.photos/seed/caldas/400/400' },
  { name: 'Aguardiente Antioqueño sin azúcar 750ml', price: 48000, stock: 30, description: 'Sin azúcar', category: 'Aguardiente', imageUrl: 'https://picsum.photos/seed/antioqueno/400/400' },
  { name: 'Old Parr 12 750ml', price: 135000, stock: 12, description: '12 años', category: 'Whisky', imageUrl: 'https://picsum.photos/seed/oldparr/400/400' },
  { name: 'Buchanans 12 750ml', price: 149000, stock: 10, description: '12 años', category: 'Whisky', imageUrl: 'https://picsum.photos/seed/buchanans/400/400' },
  { name: 'Papas Margarita Limón 25g', price: 1800, stock: 200, description: 'Snack', category: 'Snacks', imageUrl: 'https://picsum.photos/seed/margarita/400/400' },
  { name: 'Maní La Especial 100g', price: 3500, stock: 150, description: 'Snack', category: 'Snacks', imageUrl: 'https://picsum.photos/seed/mani/400/400' },
  { name: 'Detergente Ariel 1kg', price: 12000, stock: 80, description: 'Aseo', category: 'Aseo', imageUrl: 'https://picsum.photos/seed/ariel/400/400' },
  { name: 'Suavitel 1L', price: 11000, stock: 70, description: 'Aseo', category: 'Aseo', imageUrl: 'https://picsum.photos/seed/suavitel/400/400' },
];

async function main() {
  await prisma.product.deleteMany();
  const result = await prisma.product.createMany({ data: products });
  console.log(`Seed OK: ${result.count} productos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
