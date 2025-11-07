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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const products_service_1 = require("./products.service");
const create_product_dto_1 = require("./create-product.dto");
const update_product_dto_1 = require("./update-product.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const query_products_dto_1 = require("./query-products.dto");
let ProductsController = class ProductsController {
    constructor(productsService) {
        this.productsService = productsService;
    }
    // -------------------------------------------------------------------
    // PÚBLICOS
    // -------------------------------------------------------------------
    // Catálogo con búsqueda + filtros + orden + paginación (total en header)
    async listPublic(query, res) {
        const { total, items } = await this.productsService.findPublicWithQuery(query);
        res.setHeader('X-Total-Count', String(total));
        return items;
    }
    // Categorías (DEBE ir antes de ":id")
    categories() {
        return this.productsService.listCategories();
    }
    /**
     * Batch de precios/stock para hidratar el feed en un solo viaje:
     * GET /products/prices?ids=1,5,1009&audience=B2C
     * Devuelve: [{ id, price, b2bPrice, stock }]
     */
    async getPricesBatch(idsParam, audience) {
        if (!idsParam || !idsParam.trim()) {
            throw new common_1.BadRequestException('ids es requerido (comma-separated)');
        }
        const ids = idsParam
            .split(',')
            .map((s) => Number(String(s).trim()))
            .filter((n) => Number.isFinite(n));
        if (!ids.length) {
            throw new common_1.BadRequestException('ids inválidos');
        }
        // Obtén datos básicos (rápidos) para esos IDs
        const basics = await this.productsService.findPublicBasicsByIds(ids);
        // audience es informativo para el front; devolvemos ambos precios para consistencia
        // (el front decide si usar price o b2bPrice según rol/vista)
        // Si quieres filtrar campos, lo puedes hacer aquí.
        return basics.map((p) => ({
            id: p.id,
            price: p.price,
            b2bPrice: p.b2bPrice ?? p.price,
            stock: p.stock ?? null,
        }));
    }
    // -------------------------------------------------------------------
    // ADMIN ONLY
    // -------------------------------------------------------------------
    // Alias que usan pantallas Admin para ver listas de precio (B2C/B2B)
    // Devuelve array y X-Total-Count en header
    async getPriceListB2C(res) {
        const { total, items } = await this.productsService.getPriceList('B2C');
        res.setHeader('X-Total-Count', String(total));
        return items;
    }
    async getPriceListB2B(res) {
        const { total, items } = await this.productsService.getPriceList('B2B');
        res.setHeader('X-Total-Count', String(total));
        return items;
    }
    findAllAdmin() {
        return this.productsService.findAll();
    }
    create(dto) {
        return this.productsService.create(dto);
    }
    update(id, dto) {
        return this.productsService.update(id, dto);
    }
    updatePartial(id, dto) {
        return this.productsService.update(id, dto);
    }
    remove(id) {
        return this.productsService.remove(id);
    }
    // -------------------------------------------------------------------
    // PÚBLICO: Detalle por id (al final para no chocar con rutas estáticas)
    // -------------------------------------------------------------------
    findOnePublic(id) {
        return this.productsService.findOne(id);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_products_dto_1.QueryProductsDto, Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "listPublic", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('prices'),
    __param(0, (0, common_1.Query)('ids')),
    __param(1, (0, common_1.Query)('audience')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getPricesBatch", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)('pricelist/b2c'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getPriceListB2C", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)('pricelist/b2b'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getPriceListB2B", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "findAllAdmin", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "create", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "update", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "updatePartial", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "findOnePublic", null);
exports.ProductsController = ProductsController = __decorate([
    (0, common_1.Controller)('products'),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsController);
//# sourceMappingURL=products.controller.js.map