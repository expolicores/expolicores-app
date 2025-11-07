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
exports.OrdersController = void 0;
// backend/src/orders/orders.controller.ts
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const create_order_dto_1 = require("./create-order.dto");
const update_order_dto_1 = require("./update-order.dto");
const update_order_status_dto_1 = require("./update-order-status.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
const swagger_1 = require("@nestjs/swagger");
// 👇 Disponible si quisieras mover la validación al guard a futuro
// import { SelfOrAdminGuard } from '../auth/guards/self-or-admin.guard';
let OrdersController = class OrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    // Crear orden (cliente autenticado)
    create(userId, dto) {
        return this.ordersService.create(userId, dto);
    }
    // Mis órdenes (cliente autenticado)
    findMine(userId) {
        return this.ordersService.findMine(userId);
    }
    // Ver UNA orden (dueño o ADMIN) -> usado por OrderTrackingScreen
    findOne(id, user) {
        return this.ordersService.findOneForUser(id, user); // 👈 owner-safe
    }
    // Listar TODAS las órdenes (solo ADMIN)
    findAll() {
        return this.ordersService.findAll();
    }
    // Actualizar (items/otros) - normalmente ADMIN
    update(id, dto) {
        return this.ordersService.update(id, dto);
    }
    // Cambiar estado (solo ADMIN)
    updateStatus(id, dto) {
        return this.ordersService.updateStatus(id, dto.status);
    }
    // Eliminar orden (solo ADMIN)
    remove(id) {
        return this.ordersService.remove(id);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una orden desde el carrito' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Orden creada (status: RECIBIDO)' }),
    (0, swagger_1.ApiBadRequestResponse)({
        description: 'EMPTY_CART | ADDRESS_MISSING_GEO | COVERAGE_OUT_OF_RANGE',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'ADDRESS_NOT_FOUND | PRODUCT_NOT_FOUND' }),
    (0, swagger_1.ApiConflictResponse)({ description: 'OUT_OF_STOCK:<productId>' }),
    (0, swagger_1.ApiUnauthorizedResponse)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "create", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('my'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar mis órdenes' }),
    (0, swagger_1.ApiOkResponse)({
        description: 'Listado de órdenes del usuario (incluye status y totales)',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "findMine", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard) // 👈 solo autenticación; la autorización se valida en el service
    ,
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Ver una orden por id (dueño o ADMIN)' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: Number, description: 'ID de la orden' }),
    (0, swagger_1.ApiOkResponse)({
        description: 'Detalle: { id, status, total, createdAt, updatedAt, items[{ product{name,imageUrl,price}, quantity }]}',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Order not found' }),
    (0, swagger_1.ApiUnauthorizedResponse)(),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "findOne", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar todas las órdenes (ADMIN)' }),
    (0, swagger_1.ApiOkResponse)(),
    (0, swagger_1.ApiForbiddenResponse)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "findAll", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar una orden (ADMIN)' }),
    (0, swagger_1.ApiOkResponse)(),
    (0, swagger_1.ApiForbiddenResponse)(),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Order with ID :id not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_order_dto_1.UpdateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "update", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Patch)(':id/status'),
    (0, swagger_1.ApiOperation)({
        summary: 'Cambiar estado de la orden (ADMIN)',
        description: 'Cambia el estado de una orden.\n\n' +
            '**Efecto colateral:** si `WHATSAPP_STATUS_NOTIFS=true`, el sistema enviará un WhatsApp corto al cliente cuando el nuevo estado sea `EN_CAMINO`, `ENTREGADO` o `CANCELADO`.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: Number, description: 'ID de la orden' }),
    (0, swagger_1.ApiBody)({
        type: update_order_status_dto_1.UpdateOrderStatusDto,
        description: 'Nuevo estado de la orden',
        examples: {
            enCamino: { value: { status: 'EN_CAMINO' } },
            entregado: { value: { status: 'ENTREGADO' } },
            cancelado: { value: { status: 'CANCELADO' } },
        },
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Orden actualizada. Devuelve el objeto Order.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Requiere rol ADMIN.' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_order_status_dto_1.UpdateOrderStatusDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar una orden (ADMIN)' }),
    (0, swagger_1.ApiOkResponse)(),
    (0, swagger_1.ApiForbiddenResponse)(),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "remove", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)('orders'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map