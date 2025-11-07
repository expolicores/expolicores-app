"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/prisma/seed.ts
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
/** URL dummy estable para imágenes */
const img = (seed, w = 600, h = 600) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
async function main() {
    console.log('🚀 Seeding Expolicores (DEV)…');
    // ============== Usuarios (OTP-first ready) ==============
    const adminPass = await bcrypt.hash('Admin1234!', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@expolicores.com' },
        update: {
            password: adminPass,
            role: client_1.Role.ADMIN,
            name: 'Admin Expolicores',
            isEmailVerified: true,
        },
        create: {
            name: 'Admin Expolicores',
            email: 'admin@expolicores.com',
            password: adminPass,
            role: client_1.Role.ADMIN,
            phone: '+573000000000',
            isEmailVerified: true,
            isPhoneVerified: false,
        },
    });
    const business = await prisma.user.upsert({
        where: { phone: '+573001112233' },
        update: {
            name: 'Licorera Don Pepe',
            role: client_1.Role.B2B,
            isPhoneVerified: true,
            email: 'negocio@expolicores.com',
        },
        create: {
            name: 'Licorera Don Pepe',
            phone: '+573001112233',
            role: client_1.Role.B2B,
            isPhoneVerified: true,
            isEmailVerified: false,
            email: 'negocio@expolicores.com',
        },
    });
    // Cliente con el número del sandbox Twilio (para OTP)
    const cliente = await prisma.user.upsert({
        where: { phone: '+573115026310' },
        update: {
            name: 'Juan Cliente',
            role: client_1.Role.B2C,
            isPhoneVerified: true,
            email: 'expolicores@outlook.com',
            isEmailVerified: false,
        },
        create: {
            name: 'Juan Cliente',
            phone: '+573115026310',
            role: client_1.Role.B2C,
            isPhoneVerified: true,
            isEmailVerified: false,
            email: 'expolicores@outlook.com',
        },
    });
    console.log('👤 Users:', { admin: admin.id, business: business.id, cliente: cliente.id });
    // ============== Limpieza segura de datos dependientes ==============
    await prisma.$transaction([
        prisma.orderItem.deleteMany(),
        prisma.notificationLog.deleteMany(),
        prisma.order.deleteMany(),
        prisma.favorite.deleteMany(),
        prisma.product.deleteMany(),
    ]);
    // ============== Productos base con imágenes y b2bPrice ==============
    const baseProducts = [
        { name: 'Club Colombia Dorada 330ml', price: 4500, b2bPrice: Math.round(4500 * 0.8), stock: 100, description: 'Cerveza dorada', category: 'Cerveza', imageUrl: img('club') },
        { name: 'Poker Lata 330ml', price: 3500, b2bPrice: Math.round(3500 * 0.8), stock: 120, description: 'Cerveza lager', category: 'Cerveza', imageUrl: img('poker') },
        { name: 'Corona 355ml', price: 6500, b2bPrice: Math.round(6500 * 0.8), stock: 60, description: 'Cerveza mexicana', category: 'Cerveza', imageUrl: img('corona') },
        { name: 'Concha y Toro Reservado Cabernet 750ml', price: 42000, b2bPrice: Math.round(42000 * 0.8), stock: 20, description: 'Cabernet', category: 'Vino', imageUrl: img('cabernet') },
        { name: 'Gato Negro Merlot 750ml', price: 38000, b2bPrice: Math.round(38000 * 0.8), stock: 18, description: 'Merlot', category: 'Vino', imageUrl: img('merlot') },
        { name: 'Ron Medellín Añejo 750ml', price: 56000, b2bPrice: Math.round(56000 * 0.8), stock: 25, description: 'Añejo', category: 'Ron', imageUrl: img('medellin') },
        { name: 'Ron Viejo de Caldas 8 años 750ml', price: 69000, b2bPrice: Math.round(69000 * 0.8), stock: 15, description: '8 años', category: 'Ron', imageUrl: img('caldas') },
        { name: 'Aguardiente Antioqueño sin azúcar 750ml', price: 48000, b2bPrice: Math.round(48000 * 0.8), stock: 30, description: 'Sin azúcar', category: 'Aguardiente', imageUrl: img('antioqueno') },
        { name: 'Old Parr 12 750ml', price: 135000, b2bPrice: Math.round(135000 * 0.8), stock: 12, description: '12 años', category: 'Whisky', imageUrl: img('oldparr') },
        { name: 'Buchanans 12 750ml', price: 149000, b2bPrice: Math.round(149000 * 0.8), stock: 10, description: '12 años', category: 'Whisky', imageUrl: img('buchanans') },
        { name: 'Papas Margarita Limón 25g', price: 1800, b2bPrice: Math.round(1800 * 0.8), stock: 200, description: 'Snack', category: 'Snacks', imageUrl: img('margarita') },
        { name: 'Maní La Especial 100g', price: 3500, b2bPrice: Math.round(3500 * 0.8), stock: 150, description: 'Snack', category: 'Snacks', imageUrl: img('mani') },
        { name: 'Detergente Ariel 1kg', price: 12000, b2bPrice: Math.round(12000 * 0.8), stock: 80, description: 'Aseo', category: 'Aseo', imageUrl: img('ariel') },
        { name: 'Suavitel 1L', price: 11000, b2bPrice: Math.round(11000 * 0.8), stock: 70, description: 'Aseo', category: 'Aseo', imageUrl: img('suavitel') },
        { name: 'Vodka Absolut 750ml', price: 98000, b2bPrice: Math.round(98000 * 0.8), stock: 35, description: 'Vodka sueco premium', category: 'Vodka', imageUrl: img('absolut') },
        { name: 'Tequila José Cuervo 750ml', price: 120000, b2bPrice: Math.round(120000 * 0.8), stock: 20, description: 'Tequila reposado', category: 'Tequila', imageUrl: img('cuervo') },
    ];
    // Creamos los base (necesitamos los IDs)
    const createdBase = [];
    for (const p of baseProducts) {
        const created = await prisma.product.create({ data: p });
        createdBase.push(created);
    }
    // Items demo adicionales (paginación/testing)
    const ADD_DEMO_ITEMS = true;
    if (ADD_DEMO_ITEMS) {
        const categories = ['Cerveza', 'Vino', 'Ron', 'Aguardiente', 'Whisky', 'Snacks', 'Aseo', 'Vodka', 'Tequila'];
        const extra = [];
        for (let i = 1; i <= 60; i++) {
            const price = 1000 + i * 137;
            extra.push({
                name: `Producto ${i}`,
                price,
                b2bPrice: Math.round(price * 0.8),
                stock: 5 + (i % 30),
                description: `Demo #${i}`,
                category: categories[i % categories.length],
                imageUrl: img(`p${i}`),
            });
        }
        await prisma.product.createMany({ data: extra, skipDuplicates: true });
    }
    console.log(`🍷 Productos: ${createdBase.length} base + demo OK`);
    // ============== Direcciones ==============
    await prisma.address.createMany({
        data: [
            {
                userId: cliente.id,
                label: 'Casa',
                recipient: 'Juan Cliente',
                phone: '3114445566',
                line1: 'Carrera 10 # 12-34',
                neighborhood: 'Centro',
                city: 'Villa de Leyva',
                state: 'Boyacá',
                country: 'CO',
                isDefault: true,
                lat: 5.635,
                lng: -73.525,
            },
            {
                userId: business.id,
                label: 'Bodega',
                recipient: 'Don Pepe',
                phone: '3001112233',
                line1: 'Calle 8 # 7-21',
                neighborhood: 'Norte',
                city: 'Villa de Leyva',
                state: 'Boyacá',
                country: 'CO',
                isDefault: true,
                lat: 5.638,
                lng: -73.529,
            },
        ],
        skipDuplicates: true,
    });
    // ============== Favoritos ==============
    await prisma.favorite.createMany({
        data: [
            { userId: cliente.id, productId: createdBase[0].id }, // Club Colombia
            { userId: cliente.id, productId: createdBase[6].id }, // Ron Viejo de Caldas
            { userId: cliente.id, productId: createdBase[8].id }, // Old Parr
        ],
        skipDuplicates: true,
    });
    console.log('❤️ Favoritos: OK');
    // ============== Órdenes de ejemplo ==============
    const pfind = (name) => createdBase.find(x => x.name.includes(name));
    // Orden 1
    const o1Items = [
        { productId: pfind('Club Colombia').id, qty: 1, price: pfind('Club Colombia').price },
        { productId: pfind('Ron Medellín').id, qty: 2, price: pfind('Ron Medellín').price },
    ];
    const total1 = o1Items.reduce((acc, it) => acc + it.price * it.qty, 0);
    await prisma.order.create({
        data: {
            userId: cliente.id,
            total: total1,
            status: client_1.OrderStatus.RECIBIDO,
            items: { create: o1Items.map(it => ({ productId: it.productId, quantity: it.qty })) },
            notifications: { create: { channel: 'WHATSAPP', type: 'ORDER_CREATED', ok: true, to: cliente.phone } },
        },
    });
    // Orden 2
    const o2Items = [
        { productId: pfind('Old Parr').id, qty: 1, price: pfind('Old Parr').price },
        { productId: pfind('Aguardiente Antioqueño').id, qty: 3, price: pfind('Aguardiente Antioqueño').price },
    ];
    const total2 = o2Items.reduce((acc, it) => acc + it.price * it.qty, 0);
    await prisma.order.create({
        data: {
            userId: cliente.id,
            total: total2,
            status: client_1.OrderStatus.EN_CAMINO,
            items: { create: o2Items.map(it => ({ productId: it.productId, quantity: it.qty })) },
        },
    });
    console.log('✅ Seed terminado');
}
main()
    .catch((e) => {
    console.error('❌ Seed error', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map