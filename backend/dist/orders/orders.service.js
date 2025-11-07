"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
// backend/src/orders/orders.service.ts
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const shipping_1 = __importDefault(require("../config/shipping"));
const whatsapp_service_1 = require("../notifications/whatsapp.service");
const geo_1 = require("../common/geo"); // ← misma lógica que /geo/validate
const push_service_1 = require("../notifications/push.service"); // ← Expo Push
const live_activities_service_1 = require("../live-activities/live-activities.service"); // ← APNs Live Activity (nuevo)
let OrdersService = OrdersService_1 = class OrdersService {
    constructor(prisma, shipping, whatsapp, push, liveActivities) {
        this.prisma = prisma;
        this.shipping = shipping;
        this.whatsapp = whatsapp;
        this.push = push;
        this.liveActivities = liveActivities;
        this.logger = new common_1.Logger(OrdersService_1.name);
        this.orderInclude = {
            items: { include: { product: true } },
            user: { select: { id: true, email: true, name: true, role: true, phone: true } },
        };
    }
    async create(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, phone: true },
        });
        if (!user)
            throw new common_1.NotFoundException('USER_NOT_FOUND');
        const address = await this.prisma.address.findFirst({
            where: { id: dto.addressId, userId },
            select: {
                id: true,
                label: true,
                line1: true,
                neighborhood: true,
                city: true,
                lat: true,
                lng: true,
                notes: true,
            },
        });
        if (!address)
            throw new common_1.NotFoundException('ADDRESS_NOT_FOUND');
        const hasGeo = typeof address.lat === 'number' && typeof address.lng === 'number';
        // ===== Productos y subtotal (respeta B2B/ADMIN) =====
        if (!dto.items || dto.items.length === 0)
            throw new common_1.BadRequestException('EMPTY_CART');
        const ids = dto.items.map((i) => i.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, price: true, b2bPrice: true, stock: true },
        });
        if (products.length !== ids.length) {
            const foundIds = new Set(products.map((p) => p.id));
            const missing = ids.filter((id) => !foundIds.has(id));
            throw new common_1.NotFoundException({
                code: 'PRODUCT_NOT_FOUND',
                missing,
                message: 'PRODUCT_NOT_FOUND',
            });
        }
        const byId = new Map(products.map((p) => [p.id, p]));
        const usesB2B = user.role === client_1.Role.B2B || user.role === client_1.Role.ADMIN;
        let subtotal = 0;
        for (const it of dto.items) {
            const p = byId.get(it.productId);
            if (p.stock < it.quantity)
                throw new common_1.ConflictException(`OUT_OF_STOCK:${p.id}`);
            const unitPrice = usesB2B ? p.b2bPrice : p.price;
            subtotal += unitPrice * it.quantity;
        }
        // ===== Envío (MISMA lógica que Checkout: validateGeo) =====
        let shipping = this.shipping.min; // fallback sin geo
        if (hasGeo) {
            const geo = (0, geo_1.validateGeo)({ lat: address.lat, lng: address.lng });
            if (!geo.inCoverage)
                throw new common_1.BadRequestException('COVERAGE_OUT_OF_RANGE');
            shipping = geo.shippingCost;
            // Para auditoría: geo.meta?.pricingMode, geo.distanceKm, etc.
        }
        const total = subtotal + shipping;
        // ===== Crear orden + descontar stock =====
        const created = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    userId,
                    total,
                    status: client_1.OrderStatus.RECIBIDO, // estado inicial
                    items: { create: dto.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
                },
                include: this.orderInclude,
            });
            for (const it of dto.items) {
                const res = await tx.product.updateMany({
                    where: { id: it.productId, stock: { gte: it.quantity } },
                    data: { stock: { decrement: it.quantity } },
                });
                if (res.count !== 1)
                    throw new common_1.ConflictException(`OUT_OF_STOCK:${it.productId}`);
            }
            return order;
        });
        // ===== PUSH: Pedido creado (no bloquea flujo) =====
        try {
            await this.push.sendToUser(String(userId), {
                title: 'Pedido creado',
                body: `#${created.id} recibido. Te avisaremos los cambios.`,
                data: { type: 'ORDER_CREATED', orderId: created.id },
                priority: 'high',
                sound: 'default',
            });
        }
        catch (e) {
            this.logger.warn(`push ORDER_CREATED failed for user ${userId}: ${e.message}`);
        }
        // (Live Activities): la app iOS inicia la actividad y registra el token desde el frontend.
        // El backend NO envía update aquí; solo responderá a cambios de estado.
        // ===== WhatsApp confirmación =====
        const toPhone = this.normalizeCoPhone(user.phone ?? created.user?.phone ?? '');
        const addressLabel = address.label ?? 'Dirección';
        const addressLine = [address.line1, address.neighborhood, address.city].filter(Boolean).join(', ');
        const waItems = created.items.map((i) => {
            const linePrice = usesB2B ? i.product.b2bPrice : i.product.price;
            return { name: i.product.name, quantity: i.quantity, price: linePrice };
        });
        const notesFromPayload = [dto.notes, address.notes];
        if (!hasGeo)
            notesFromPayload.push('Atención: validar cobertura, dirección sin coordenadas');
        const notes = notesFromPayload
            .map((n) => (n ?? '').trim())
            .filter((n) => n.length > 0)
            .join(' | ') || undefined;
        const waRes = await this.whatsapp.sendOrderConfirmation({
            toPhone,
            orderId: created.id,
            subtotal,
            shipping,
            total: created.total,
            paymentMethod: dto.paymentMethod ?? 'COD',
            items: waItems,
            addressLabel,
            addressLine,
            notes,
            tenant: 'Expolicores Villa de Leyva',
        });
        await this.prisma.notificationLog.upsert({
            where: { orderId_type: { orderId: created.id, type: 'ORDER_CREATED' } },
            update: {
                sid: waRes.sid ?? null,
                ok: waRes.ok,
                error: waRes.ok ? null : 'send failed',
                to: toPhone,
            },
            create: {
                orderId: created.id,
                channel: 'WHATSAPP',
                type: 'ORDER_CREATED',
                sid: waRes.sid ?? null,
                ok: waRes.ok,
                error: waRes.ok ? null : 'send failed',
                to: toPhone,
            },
        });
        // Devuelve totales explícitos para OrderSuccessScreen
        return { ...created, subtotal, shipping, total, address };
    }
    async calcTotal(items, useB2B) {
        const ids = [...new Set(items.map((i) => i.productId))];
        const products = await this.prisma.product.findMany({
            where: { id: { in: ids } },
            select: { id: true, price: true, b2bPrice: true },
        });
        const priceMap = new Map(products.map((p) => [p.id, useB2B ? p.b2bPrice : p.price]));
        return items.reduce((sum, i) => sum + (priceMap.get(i.productId) ?? 0) * i.quantity, 0);
    }
    async findAll() {
        return this.prisma.order.findMany({ orderBy: { id: 'desc' }, include: this.orderInclude });
    }
    async findMine(userId) {
        return this.prisma.order.findMany({
            where: { userId },
            orderBy: { id: 'desc' },
            include: this.orderInclude,
        });
    }
    async findOneAs(id, user) {
        const where = user.role === client_1.Role.ADMIN ? { id } : { id, userId: user.id };
        const order = await this.prisma.order.findFirst({ where, include: this.orderInclude });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        return order;
    }
    async findOne(id) {
        const order = await this.prisma.order.findUnique({ where: { id }, include: this.orderInclude });
        if (!order)
            throw new common_1.NotFoundException(`Order with ID ${id} not found`);
        return order;
    }
    async findOneForUser(id, user) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: { items: { include: { product: true } }, user: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (user.role !== client_1.Role.ADMIN && order.userId !== user.id) {
            throw new common_1.ForbiddenException('You cannot access this order');
        }
        return order;
    }
    async update(id, dto) {
        const { items, ...rest } = dto;
        const existing = await this.prisma.order.findUnique({
            where: { id },
            select: { user: { select: { role: true } } },
        });
        if (!existing)
            throw new common_1.NotFoundException(`Order with ID ${id} not found`);
        const usesB2B = existing.user?.role === client_1.Role.B2B || existing.user?.role === client_1.Role.ADMIN;
        let totalUpdate;
        if (items) {
            await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
            totalUpdate = await this.calcTotal(items, usesB2B);
        }
        const updated = await this.prisma.order.update({
            where: { id },
            data: {
                ...rest,
                ...(totalUpdate !== undefined ? { total: totalUpdate } : {}),
                items: items
                    ? { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) }
                    : undefined,
            },
            include: this.orderInclude,
        });
        return updated;
    }
    async updateStatus(id, status) {
        const order = await this.prisma.order.update({
            where: { id },
            data: { status },
            include: this.orderInclude,
        });
        // ===== PUSH por estado (no bloquea) =====
        try {
            const msg = this.messageForStatus(status, order.id);
            if (msg) {
                await this.push.sendToUser(String(order.userId), {
                    title: msg.title,
                    body: msg.body,
                    data: { type: 'ORDER_STATUS', orderId: order.id, status },
                    priority: 'high',
                    sound: 'default',
                });
            }
        }
        catch (e) {
            this.logger.warn(`push STATUS_${status} failed for user ${order.userId}: ${e.message}`);
        }
        // ===== Live Activities (APNs liveactivity) — no bloquea =====
        try {
            // Enviamos update con el nuevo estado; si no hay Live Activity registrada, el service ignora.
            await this.liveActivities.update(order.id, {
                orderId: order.id,
                status, // EN_CAMINO | ENTREGADO | CANCELADO (RECIBIDO no se usa en frontend)
            });
            if (status === 'ENTREGADO' || status === 'CANCELADO') {
                await this.liveActivities.end(order.id, status);
            }
        }
        catch (e) {
            this.logger.warn(`liveActivity STATUS_${status} failed for order ${order.id}: ${e.message}`);
        }
        // ===== WhatsApp por estado (como estaba) =====
        if (status === 'EN_CAMINO' || status === 'ENTREGADO' || status === 'CANCELADO') {
            const toPhone = this.normalizeCoPhone(order.user?.phone ?? '');
            const res = await this.whatsapp.sendStatusUpdate({
                toPhone,
                orderId: order.id,
                newStatus: status,
                tenant: 'Expolicores Villa de Leyva',
            });
            await this.prisma.notificationLog.upsert({
                where: { orderId_type: { orderId: order.id, type: `STATUS_${status}` } },
                update: {
                    sid: res.sid ?? null,
                    ok: res.ok,
                    error: res.ok ? null : 'send failed',
                    to: toPhone,
                },
                create: {
                    orderId: order.id,
                    channel: 'WHATSAPP',
                    type: `STATUS_${status}`,
                    sid: res.sid ?? null,
                    ok: res.ok,
                    error: res.ok ? null : 'send failed',
                    to: toPhone,
                },
            });
        }
        return order;
    }
    async remove(id) {
        await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
        await this.prisma.order.delete({ where: { id } });
        return { id };
    }
    // E.164 CO básica (+57) para compatibilidad con Twilio WhatsApp
    normalizeCoPhone(input) {
        const digits = (input || '').replace(/\D/g, '');
        if (!digits)
            return '+57';
        if (digits.startsWith('57'))
            return `+${digits}`;
        if (digits.length === 10)
            return `+57${digits}`;
        if (digits.startsWith('0') && digits.length === 11)
            return `+57${digits.slice(1)}`;
        if (input?.startsWith('+'))
            return input;
        return `+57${digits}`;
    }
    // Mensajes para estados que existen en tu enum
    messageForStatus(status, orderId) {
        switch (status) {
            case 'EN_CAMINO':
                return { title: 'En camino', body: `#${orderId} ya va en camino.` };
            case 'ENTREGADO':
                return { title: 'Entregado', body: `#${orderId} ha sido entregado. ¡Gracias!` };
            case 'CANCELADO':
                return { title: 'Pedido cancelado', body: `#${orderId} fue cancelado.` };
            default:
                return null; // RECIBIDO u otros no generan push extra
        }
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(shipping_1.default.KEY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, void 0, whatsapp_service_1.WhatsAppService,
        push_service_1.PushService,
        live_activities_service_1.LiveActivitiesService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map