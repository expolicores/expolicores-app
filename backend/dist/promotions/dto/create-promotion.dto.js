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
exports.CreatePromotionDto = exports.PromotionAudience = exports.PromotionType = void 0;
//create-Promotion.dto.ts
// prettier-ignore
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var PromotionType;
(function (PromotionType) {
    PromotionType["PRICE_OVERRIDE"] = "PRICE_OVERRIDE";
    PromotionType["PERCENT_OFF"] = "PERCENT_OFF";
})(PromotionType || (exports.PromotionType = PromotionType = {}));
var PromotionAudience;
(function (PromotionAudience) {
    PromotionAudience["ANY"] = "ANY";
    PromotionAudience["B2C"] = "B2C";
    PromotionAudience["B2B"] = "B2B";
})(PromotionAudience || (exports.PromotionAudience = PromotionAudience = {}));
class PromotionProductInput {
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PromotionProductInput.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PromotionProductInput.prototype, "minQty", void 0);
class BenefitsInput {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BenefitsInput.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.0001),
    __metadata("design:type", Number)
], BenefitsInput.prototype, "percent", void 0);
class CreatePromotionDto {
    constructor() {
        this.audience = PromotionAudience.ANY;
        this.active = true;
        this.stacking = false;
        this.priority = 100;
    }
}
exports.CreatePromotionDto = CreatePromotionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePromotionDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(PromotionType),
    __metadata("design:type", String)
], CreatePromotionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(PromotionAudience),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePromotionDto.prototype, "audience", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreatePromotionDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreatePromotionDto.prototype, "stacking", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreatePromotionDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePromotionDto.prototype, "startsAt", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePromotionDto.prototype, "endsAt", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PromotionProductInput),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreatePromotionDto.prototype, "products", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BenefitsInput),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", BenefitsInput)
], CreatePromotionDto.prototype, "benefits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreatePromotionDto.prototype, "conditions", void 0);
//# sourceMappingURL=create-promotion.dto.js.map