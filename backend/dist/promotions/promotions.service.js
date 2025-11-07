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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionsService = void 0;
// src/promotions/promotions.service.ts
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PromotionsService = class PromotionsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ---------------------------
    // Helpers
    // ---------------------------
    validatePayload(dto) {
        if (!dto.type)
            return; // update parcial puede no cambiar type/benefits
        const { type, benefits } = dto;
        if (type === 'PRICE_OVERRIDE') {
            if (!benefits || typeof benefits.price !== 'number' || benefits.price < 0) {
                throw new common_1.BadRequestException('PRICE_OVERRIDE requiere benefits.price >= 0');
            }
            return;
        }
        if (type === 'PERCENT_OFF') {
            const p = benefits?.percent;
            if (typeof p !== 'number' || p <= 0 || p >= 100) {
                throw new common_1.BadRequestException('PERCENT_OFF requiere benefits.percent en (0,100)');
            }
            return;
        }
        if (type === 'X_FOR_Y') {
            const x = benefits?.x;
            const y = benefits?.y;
            const bundleId = benefits?.bundleId;
            if (!Number.isInteger(x) || x <= 0)
                throw new common_1.BadRequestException('X_FOR_Y requiere benefits.x entero > 0');
            if (!Number.isInteger(y) || y <= 0)
                throw new common_1.BadRequestException('X_FOR_Y requiere benefits.y entero > 0');
            if (!bundleId || typeof bundleId !== 'string')
                throw new common_1.BadRequestException('X_FOR_Y requiere benefits.bundleId');
            return;
        }
        if (type === 'GIFT_WITH_PURCHASE') {
            const { bundleId, triggerProductId, giftProductId } = benefits ?? {};
            if (!bundleId || typeof bundleId !== 'string')
                throw new common_1.BadRequestException('GWP requiere benefits.bundleId');
            if (!triggerProductId || !giftProductId) {
                throw new common_1.BadRequestException('GWP requiere triggerProductId y giftProductId');
            }
            return;
        }
        throw new common_1.BadRequestException('Tipo de promoción no soportado');
    }
    /** Normaliza/arma components para BundleMap si no llegan explícitos en benefits.components */
    buildComponentsForBundle(type, dto) {
        const benefits = dto.benefits ?? {};
        const explicit = Array.isArray(benefits.components) ? benefits.components : undefined;
        if (explicit?.length) {
            return explicit
                .map((c) => ({ productId: String(c.productId), qty: Number(c.qty) }))
                .filter(c => !!c.productId && Number.isFinite(c.qty) && c.qty > 0);
        }
        // Inferencias mínimas por tipo:
        if (type === 'X_FOR_Y') {
            const target = (dto.products ?? [])[0]?.productId;
            const x = Number(benefits.x);
            if (target && Number.isFinite(x) && x > 0) {
                return [{ productId: String(target), qty: x }];
            }
        }
        if (type === 'GIFT_WITH_PURCHASE') {
            const trigger = benefits.triggerProductId
                ? String(benefits.triggerProductId)
                : (dto.products ?? [])[0]?.productId;
            const gift = benefits.giftProductId
                ? String(benefits.giftProductId)
                : (dto.products ?? [])[1]?.productId;
            const triggerQty = Number(benefits.triggerQty ?? 1);
            const comps = [];
            if (trigger && Number.isFinite(triggerQty) && triggerQty > 0) {
                comps.push({ productId: String(trigger), qty: triggerQty });
            }
            if (gift)
                comps.push({ productId: String(gift), qty: 1 });
            if (comps.length)
                return comps;
        }
        // Fallback: usa products con minQty (o 1)
        const fromProducts = (dto.products ?? [])
            .map(p => ({ productId: String(p.productId), qty: Number(p.minQty ?? 1) }))
            .filter(c => !!c.productId && Number.isFinite(c.qty) && c.qty > 0);
        return fromProducts;
    }
    /** Crea/actualiza el registro de BundleMap cuando el tipo es combo (X_FOR_Y / GWP) */
    async upsertBundleMapIfNeeded(type, dto) {
        if (type !== 'X_FOR_Y' && type !== 'GIFT_WITH_PURCHASE')
            return;
        const benefits = dto.benefits ?? {};
        const bundleId = benefits.bundleId;
        if (!bundleId || typeof bundleId !== 'string') {
            throw new common_1.BadRequestException('bundleId requerido para combos (X_FOR_Y, GWP)');
        }
        const components = this.buildComponentsForBundle(type, dto);
        if (!components?.length) {
            throw new common_1.BadRequestException('No se pudieron determinar componentes para BundleMap');
        }
        await this.prisma.bundleMap.upsert({
            where: { bundleId },
            update: { components: components, active: true },
            create: { bundleId, components: components, active: true },
        });
    }
    /** Helper: escoge productId efectivo para overlay */
    pickOverlayProductId(p) {
        const ben = (p?.benefitsJson ?? {});
        const cond = (p?.conditionsJson ?? {});
        // Prioridad: benefitsJson.productId -> benefitsJson.bundleId -> relación products[0]
        const fromBenefits = (ben.productId != null && String(ben.productId)) ||
            (ben.bundleId != null && String(ben.bundleId)) ||
            null;
        if (fromBenefits && String(fromBenefits).trim().length) {
            return String(fromBenefits).trim();
        }
        const firstRel = Array.isArray(p?.products) && p.products[0]?.productId != null
            ? String(p.products[0].productId)
            : null;
        return firstRel && firstRel.trim().length ? firstRel.trim() : null;
    }
    /** Helper: arma imageUrl/bannerKey para overlay */
    pickOverlayMedia(p) {
        const ben = (p?.benefitsJson ?? {});
        const cond = (p?.conditionsJson ?? {});
        const meta = (cond?.metadata ?? {});
        const imageUrl = meta.imageUrl ??
            meta.img ??
            ben.imageUrl ??
            undefined;
        const bannerKey = meta.bannerKey ?? undefined;
        return { imageUrl, bannerKey };
    }
    // ---------------------------
    // CRUD (ADMIN)
    // ---------------------------
    async create(dto) {
        if (!dto.name)
            throw new common_1.BadRequestException('name es requerido');
        if (!dto.startsAt || !dto.endsAt) {
            throw new common_1.BadRequestException('startsAt y endsAt son requeridos (ISO)');
        }
        this.validatePayload(dto);
        // Si es combo, registra/actualiza BundleMap
        await this.upsertBundleMapIfNeeded(dto.type, dto);
        const { products = [], ...rest } = dto;
        return this.prisma.promotion.create({
            data: {
                name: rest.name,
                type: rest.type,
                audience: (rest.audience ?? 'ANY'),
                active: rest.active ?? true,
                stacking: rest.stacking ?? false,
                priority: rest.priority ?? 100,
                startsAt: new Date(rest.startsAt),
                endsAt: new Date(rest.endsAt),
                benefitsJson: rest.benefits ?? undefined,
                conditionsJson: rest.conditions ?? undefined,
                products: {
                    // ⚠️ Creación anidada correcta: conectamos el Product por id (INT)
                    create: products.map((p) => ({
                        minQty: p.minQty ?? undefined,
                        product: { connect: { id: Number(p.productId) } },
                    })),
                },
            },
            include: { products: true },
        });
    }
    async findAll(query = {}) {
        const { active, type, audience } = query;
        return this.prisma.promotion.findMany({
            where: {
                active: typeof active === 'undefined' ? undefined : active === 'true',
                type: type ?? undefined,
                audience: audience ?? undefined,
            },
            orderBy: [{ priority: 'asc' }, { startsAt: 'asc' }],
            include: { products: true },
        });
    }
    async findOne(id) {
        const promo = await this.prisma.promotion.findUnique({
            where: { id },
            include: { products: true },
        });
        if (!promo)
            throw new common_1.NotFoundException('Promotion not found');
        return promo;
    }
    async update(id, dto) {
        // Validar payload si cambia type/benefits
        if (dto.type || dto.benefits)
            this.validatePayload(dto);
        // Si es combo y llega info (type/benefits/products), asegurar BundleMap
        if (dto.type || dto.benefits || dto.products) {
            const current = await this.prisma.promotion.findUnique({ where: { id } });
            const type = (dto.type ?? current?.type);
            const merged = {
                ...dto,
                type,
                benefits: dto.benefits ?? current?.benefitsJson,
                products: dto.products ?? undefined,
            };
            await this.upsertBundleMapIfNeeded(type, merged);
        }
        const { products, ...rest } = dto;
        // Actualiza campos base
        const updated = await this.prisma.promotion.update({
            where: { id },
            data: {
                name: rest.name ?? undefined,
                type: rest.type ?? undefined,
                audience: rest.audience ?? undefined,
                active: typeof rest.active === 'boolean' ? rest.active : undefined,
                stacking: typeof rest.stacking === 'boolean' ? rest.stacking : undefined,
                priority: typeof rest.priority === 'number' ? rest.priority : undefined,
                startsAt: rest.startsAt ? new Date(rest.startsAt) : undefined,
                endsAt: rest.endsAt ? new Date(rest.endsAt) : undefined,
                benefitsJson: rest.benefits ?? undefined,
                conditionsJson: rest.conditions ?? undefined,
            },
        });
        // Si vienen productos, reemplaza relaciones
        if (Array.isArray(products)) {
            await this.prisma.promotionProduct.deleteMany({ where: { promotionId: id } });
            if (products.length) {
                await this.prisma.promotionProduct.createMany({
                    data: products.map((p) => ({
                        promotionId: id, // Promotion.id (string)
                        productId: Number(p.productId), // ⚠️ FK a Product.id (INT)
                        minQty: p.minQty ?? null,
                    })),
                    skipDuplicates: true,
                });
            }
        }
        return this.findOne(id);
    }
    async softDelete(id) {
        // Soft delete simple: active=false
        return this.prisma.promotion.update({
            where: { id },
            data: { active: false },
        });
    }
    /**
     * Publicación del feed (hook).
     * Por ahora, devolvemos un resumen de vigentes como feedback rápido al admin.
     * La compilación a R2 queda fuera de esta fase.
     */
    async publish(id) {
        if (id)
            await this.findOne(id); // valida existencia
        const now = new Date();
        const activeNow = await this.prisma.promotion.count({
            where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
        });
        return { message: 'Publish triggered', activeNow };
    }
    // ---------------------------
    // OVERLAY REMOTO (público/autenticado)
    // ---------------------------
    /**
     * Devuelve overlays vigentes para la audiencia indicada.
     * Formato: [{ id, name, productId, price?, imageUrl?, bannerKey? }]
     * Si `limit` es un número > 0, limita resultados. Si no, devuelve todos.
     *
     * ⚠️ Cambios clave:
     * - Usa benefitsJson.productId o benefitsJson.bundleId si están presentes.
     * - Si no existen, cae a la relación products[0].
     * - No descarta promos sin relación products si tienen productId/bundleId en benefitsJson.
     */
    async getOverlayByAudience(audience, limit) {
        const now = new Date();
        const promos = await this.prisma.promotion.findMany({
            where: {
                active: true,
                startsAt: { lte: now },
                endsAt: { gte: now },
                OR: [{ audience }, { audience: 'ANY' }],
            },
            include: { products: { select: { productId: true }, take: 1 } },
            orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
            take: typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : undefined,
        });
        return promos
            // Mantener sólo aquellas que resultan con productId efectivo (por cualquiera de las fuentes)
            .map((p) => {
            const productId = this.pickOverlayProductId(p);
            if (!productId)
                return null;
            const benefits = p.benefitsJson ?? {};
            const price = typeof benefits.price === 'number' ? Number(benefits.price) : undefined;
            const media = this.pickOverlayMedia(p);
            return {
                id: p.id,
                name: p.name,
                productId, // string numérica (SKU/bundle) o slug, según modelo
                price, // PRICE_OVERRIDE; si es % no se fuerza aquí
                imageUrl: media.imageUrl, // conditions.metadata.imageUrl/img o benefitsJson.imageUrl
                bannerKey: media.bannerKey,
            };
        })
            .filter(Boolean);
    }
};
exports.PromotionsService = PromotionsService;
exports.PromotionsService = PromotionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PromotionsService);
//# sourceMappingURL=promotions.service.js.map