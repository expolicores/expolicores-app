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
exports.UpdateOrderDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class UpdateOrderItemDto {
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: 'ID del producto actualizado' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateOrderItemDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, description: 'Cantidad actualizada del producto' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateOrderItemDto.prototype, "quantity", void 0);
class UpdateOrderDto {
}
exports.UpdateOrderDto = UpdateOrderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 3, description: 'Nuevo ID del usuario que hace la orden' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateOrderDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 12000, description: 'Nuevo total de la orden' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateOrderDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [UpdateOrderItemDto],
        description: 'Lista de ítems actualizados de la orden',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpdateOrderItemDto),
    __metadata("design:type", Array)
], UpdateOrderDto.prototype, "items", void 0);
//# sourceMappingURL=update-order.dto.js.map