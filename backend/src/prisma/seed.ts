// backend/src/prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ---- Password base
  const pass123 = await bcrypt.hash('123456', 10);

  // ---- Usuarios (idempotente con upsert)
  await prisma.user.upsert({
    where: { email: 'admin@expolicores.com' },
    update: { password: pass123, role: Role.ADMIN, name: 'Admin' },
    create: {
      email: 'admin@expolicores.com',
      password: pass123,
      name: 'Admin',
      role: Role.ADMIN,
      phone: '0000000000',
    },
  });

  await prisma.user.upsert({
    where: { email: 'cliente1@example.com' },
    update: { password: pass123, role: Role.CLIENTE, name: 'Cliente Uno' },
    create: {
      email: 'cliente1@example.com',
      password: pass123,
      name: 'Cliente Uno',
      role: Role.CLIENTE,
      phone: '0000000000',
    },
  });

  // ---- Limpieza segura del catálogo (respeta FKs)
  // OrderItem -> Order -> Product para evitar error P2003
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.product.deleteMany(),
  ]);

  // ---- Productos base
  const products = [
    { name: 'Club Colombia Dorada 330ml', price: 4500,  stock: 100, description: 'Cerveza dorada',     category: 'Cerveza',     imageUrl: 'https://picsum.photos/seed/club/400/400' },
    { name: 'Poker Lata 330ml',           price: 3500,  stock: 120, description: 'Cerveza lager',      category: 'Cerveza',     imageUrl: 'https://picsum.photos/seed/poker/400/400' },
    { name: 'Corona 355ml',               price: 6500,  stock: 60,  description: 'Cerveza mexicana',   category: 'Cerveza',     imageUrl: 'https://picsum.photos/seed/corona/400/400' },
    { name: 'Concha y Toro Reservado Cabernet 750ml', price: 42000, stock: 20, description: 'Cabernet', category: 'Vino',        imageUrl: 'https://picsum.photos/seed/cabernet/400/400' },
    { name: 'Gato Negro Merlot 750ml',    price: 38000, stock: 18,  description: 'Merlot',             category: 'Vino',        imageUrl: 'https://picsum.photos/seed/merlot/400/400' },
    { name: 'Ron Medellín Añejo 750ml',   price: 56000, stock: 25,  description: 'Añejo',              category: 'Ron',         imageUrl: 'https://picsum.photos/seed/medellin/400/400' },
    { name: 'Ron Viejo de Caldas 8 años 750ml', price: 69000, stock: 15, description: '8 años',        category: 'Ron',         imageUrl: 'https://picsum.photos/seed/caldas/400/400' },
    { name: 'Aguardiente Antioqueño sin azúcar 750ml', price: 48000, stock: 30, description: 'Sin azúcar', category: 'Aguardiente', imageUrl: 'https://picsum.photos/seed/antioqueno/400/400' },
    { name: 'Old Parr 12 750ml',          price: 135000, stock: 12, description: '12 años',           category: 'Whisky',      imageUrl: 'https://picsum.photos/seed/oldparr/400/400' },
    { name: 'Buchanans 12 750ml',         price: 149000, stock: 10, description: '12 años',           category: 'Whisky',      imageUrl: 'https://picsum.photos/seed/buchanans/400/400' },
    { name: 'Papas Margarita Limón 25g',  price: 1800,  stock: 200, description: 'Snack',              category: 'Snacks',      imageUrl: 'https://picsum.photos/seed/margarita/400/400' },
    { name: 'Maní La Especial 100g',      price: 3500,  stock: 150, description: 'Snack',              category: 'Snacks',      imageUrl: 'https://picsum.photos/seed/mani/400/400' },
    { name: 'Detergente Ariel 1kg',       price: 12000, stock: 80,  description: 'Aseo',               category: 'Aseo',        imageUrl: 'https://picsum.photos/seed/ariel/400/400' },
    { name: 'Suavitel 1L',                price: 11000, stock: 70,  description: 'Aseo',               category: 'Aseo',        imageUrl: 'https://picsum.photos/seed/suavitel/400/400' },
  ];

//>>> Opcional: generar más productos de demo para probar paginación/sort
const ADD_DEMO_ITEMS = true;
  if (ADD_DEMO_ITEMS) {
    const categories = ['Cerveza','Vino','Ron','Aguardiente','Whisky','Snacks','Aseo'];
  for (let i = 1; i <= 60; i++) {
  products.push({
    name: `Producto ${i}`,
    price: 1000 + i * 137,
    stock: 5 + (i % 30),
    description: `Demo #${i}`,
    category: categories[i % categories.length],
    imageUrl: `https://picsum.photos/seed/p${i}/400/400`,
    });
    }
  }

  const { count } = await prisma.product.createMany({ data: products, skipDuplicates: true });
  console.log(`✅ Seed OK → productos: ${count}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
