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
exports.FavoritesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const PRODUCT_SELECT = {
    id: true,
    name: true,
    description: true,
    imageUrl: true,
    price: true,
    b2bPrice: true,
    stock: true,
    category: true,
    createdAt: true,
    updatedAt: true,
};
let FavoritesService = class FavoritesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listProducts(userId) {
        const favorites = await this.prisma.favorite.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { product: { select: PRODUCT_SELECT } },
        });
        return favorites.map((fav) => fav.product);
    }
    async add(userId, productId) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: PRODUCT_SELECT,
        });
        if (!product) {
            throw new common_1.NotFoundException('PRODUCT_NOT_FOUND');
        }
        try {
            await this.prisma.favorite.create({
                data: { userId, productId },
            });
        }
        catch (error) {
            if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
                throw error;
            }
            // Ignore duplicate favorite attempts
        }
        return product;
    }
    async remove(userId, productId) {
        await this.prisma.favorite.deleteMany({
            where: { userId, productId },
        });
    }
};
exports.FavoritesService = FavoritesService;
exports.FavoritesService = FavoritesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FavoritesService);
//# sourceMappingURL=favorites.service.js.map