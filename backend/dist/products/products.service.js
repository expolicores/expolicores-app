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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProductsService = class ProductsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ---------- CRUD (admin) ----------
    async create(data) {
        return this.prisma.product.create({
            data: {
                ...data,
                b2bPrice: data.b2bPrice ?? data.price,
            },
        });
    }
    findAll() {
        return this.prisma.product.findMany();
    }
    findOne(id) {
        return this.prisma.product.findUnique({ where: { id } });
    }
    update(id, data) {
        return this.prisma.product.update({ where: { id }, data });
    }
    remove(id) {
        return this.prisma.product.delete({ where: { id } });
    }
    async getPriceList(audience) {
        const orderBy = audience === 'B2B' ? { updatedAt: 'desc' } : { name: 'asc' };
        const select = {
            id: true,
            name: true,
            price: true,
            b2bPrice: true,
            imageUrl: true,
            category: true,
            stock: true,
            description: true,
            createdAt: true,
            updatedAt: true,
        };
        const [total, items] = await this.prisma.$transaction([
            this.prisma.product.count(),
            this.prisma.product.findMany({
                select,
                orderBy,
            }),
        ]);
        return {
            total,
            items: items.map((item) => ({
                ...item,
                b2bPrice: item.b2bPrice ?? item.price,
            })),
        };
    }
    // ---------- Catálogo publico ----------
    async listPublic() {
        const items = await this.prisma.product.findMany({
            select: {
                id: true,
                name: true,
                price: true,
                b2bPrice: true,
                imageUrl: true,
                category: true,
                stock: true,
                description: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return items.map((item) => ({
            ...item,
            b2bPrice: item.b2bPrice ?? item.price,
        }));
    }
    async listCategories() {
        const rows = await this.prisma.product.findMany({
            distinct: ['category'],
            where: { category: { not: null } },
            select: { category: true },
            orderBy: { category: 'asc' },
        });
        return rows.map((r) => r.category);
    }
    async findPublicBasicsByIds(ids) {
        if (!ids.length)
            return [];
        const rows = await this.prisma.product.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                price: true,
                b2bPrice: true,
                stock: true,
            },
        });
        const byId = new Map(rows.map((row) => [row.id, row]));
        return ids
            .map((id) => byId.get(id))
            .filter((row) => !!row)
            .map((row) => ({
            ...row,
            b2bPrice: row.b2bPrice ?? row.price,
        }));
    }
    // ---------- Búsqueda + filtros + orden + paginación ----------
    resolveOrderBy(sort) {
        switch (sort) {
            case 'price_asc':
                return { price: 'asc' };
            case 'price_desc':
                return { price: 'desc' };
            case 'name_asc':
                return { name: 'asc' };
            case 'name_desc':
                return { name: 'desc' };
            case 'newest':
            default:
                return { createdAt: 'desc' };
        }
    }
    applyTagFilter(where, tag) {
        if (!tag)
            return;
        const addAnd = (clause) => {
            if (!where.AND) {
                where.AND = clause;
            }
            else if (Array.isArray(where.AND)) {
                where.AND.push(clause);
            }
            else {
                where.AND = [where.AND, clause];
            }
        };
        const addOr = (...clauses) => {
            const existing = where.OR;
            const buffer = Array.isArray(existing)
                ? existing.slice()
                : existing
                    ? [existing]
                    : [];
            buffer.push(...clauses);
            where.OR = buffer;
        };
        switch (tag) {
            case 'low_price':
                addAnd({ price: { lte: 16_000 } });
                break;
            case 'oferta':
                addOr({ name: { contains: 'oferta', mode: 'insensitive' } }, { description: { contains: 'oferta', mode: 'insensitive' } }, { name: { contains: 'promo', mode: 'insensitive' } }, { description: { contains: 'promo', mode: 'insensitive' } }, { name: { contains: 'descuento', mode: 'insensitive' } }, { description: { contains: 'descuento', mode: 'insensitive' } });
                break;
            case 'pack':
                addOr({ name: { contains: 'pack', mode: 'insensitive' } }, { name: { contains: 'combo', mode: 'insensitive' } }, { description: { contains: 'pack', mode: 'insensitive' } }, { description: { contains: 'combo', mode: 'insensitive' } });
                break;
        }
    }
    async findPublicWithQuery(query) {
        const qRaw = (query.q ?? '').trim();
        const category = (query.category ?? '').trim();
        const page = Math.max(1, Number(query.page ?? 1));
        const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
        const skip = (page - 1) * limit;
        const sort = query.sort ?? 'newest';
        const where = {};
        if (qRaw) {
            where.OR = [
                { name: { contains: qRaw, mode: 'insensitive' } },
                { description: { contains: qRaw, mode: 'insensitive' } },
            ];
        }
        if (category) {
            where.category = { equals: category };
        }
        this.applyTagFilter(where, query.tag);
        const orderBy = this.resolveOrderBy(sort);
        const [total, items] = await this.prisma.$transaction([
            this.prisma.product.count({ where }),
            this.prisma.product.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    price: true,
                    b2bPrice: true,
                    imageUrl: true,
                    category: true,
                    stock: true,
                    description: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
        ]);
        return {
            total,
            items: items.map((item) => ({
                ...item,
                b2bPrice: item.b2bPrice ?? item.price,
            })),
        };
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);
//# sourceMappingURL=products.service.js.map