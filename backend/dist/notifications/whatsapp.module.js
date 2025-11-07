"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppModule = void 0;
// src/notifications/whatsapp.module.ts
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const whatsapp_1 = __importDefault(require("../config/whatsapp"));
const prisma_module_1 = require("../prisma/prisma.module");
const whatsapp_service_1 = require("./whatsapp.service");
let WhatsAppModule = class WhatsAppModule {
};
exports.WhatsAppModule = WhatsAppModule;
exports.WhatsAppModule = WhatsAppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule, // para guardar NotificationLog y consultas
            config_1.ConfigModule.forFeature(whatsapp_1.default), // inyecta configuración tipada de WhatsApp
        ],
        providers: [whatsapp_service_1.WhatsAppService],
        exports: [whatsapp_service_1.WhatsAppService],
    })
], WhatsAppModule);
//# sourceMappingURL=whatsapp.module.js.map