"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionsModule = void 0;
// src/promotions/promotions.module.ts
const common_1 = require("@nestjs/common");
const promotions_service_1 = require("./promotions.service");
const prisma_service_1 = require("../prisma/prisma.service");
const overlays_controller_1 = require("./overlays.controller");
// Si ya tienes un PromotionsController para CRUD/admin, déjalo como está e impórtalo aquí también:
const promotions_controller_1 = require("./promotions.controller"); // <-- si existe en tu repo
let PromotionsModule = class PromotionsModule {
};
exports.PromotionsModule = PromotionsModule;
exports.PromotionsModule = PromotionsModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            overlays_controller_1.OverlaysController,
            promotions_controller_1.PromotionsController, // quita esta línea si NO tienes este archivo
        ],
        providers: [promotions_service_1.PromotionsService, prisma_service_1.PrismaService],
        exports: [promotions_service_1.PromotionsService],
    })
], PromotionsModule);
//# sourceMappingURL=promotions.module.js.map