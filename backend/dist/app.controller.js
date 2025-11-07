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
exports.AppController = void 0;
// backend/src/app.controller.ts
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const geo_1 = require("./common/geo");
let AppController = class AppController {
    constructor(appService) {
        this.appService = appService;
    }
    async health() {
        const users = await this.appService.countUsers();
        return {
            status: 'ok',
            userCount: users,
        };
    }
    /**
     * Valida cobertura y calcula costo de envío.
     * - Cobertura: distancia a TIENDA <= DELIVERY_RADIUS_KM
     * - Precio: Tarifa Clásica o Urbana V2 (según env FEATURE_TARIFF_URBAN_V2)
     */
    validateGeoEndpoint(body) {
        try {
            return (0, geo_1.validateGeo)(body);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message ?? 'Solicitud inválida');
        }
    }
    /**
     * Feed del home.
     * Comportamiento:
     *  - Si FEED_INLINE_JSON=1 y existe appService.getFeed(), responde JSON inline.
     *  - Si R2_FEED_LATEST_URL está configurado, redirige 302 a ese recurso (R2/Cloudflare).
     *  - Si nada está configurado, devuelve 400.
     *
     * Nota: Mantiene el contrato que usa el frontend:
     *  - La app puede pedir /feed y recibir el JSON directamente o seguir la redirección.
     */
    async getFeed(res) {
        const useInline = (process.env.FEED_INLINE_JSON || '0') === '1';
        const r2Url = process.env.R2_FEED_LATEST_URL;
        // Opción 1: Inline (si está habilitado y existe el método)
        if (useInline && typeof this.appService?.getFeed === 'function') {
            try {
                const feedJson = await this.appService.getFeed();
                return res
                    .status(200)
                    .setHeader('Cache-Control', 'public, max-age=30')
                    .json(feedJson);
            }
            catch (e) {
                throw new common_1.BadRequestException(e?.message ?? 'No se pudo generar el feed inline');
            }
        }
        // Opción 2: Redirección a R2 (recomendada en producción)
        if (r2Url && r2Url.startsWith('http')) {
            // 302 para permitir clientes con cache corto; puedes usar 307 si prefieres.
            return res.redirect(302, r2Url);
        }
        // Sin configuración válida
        throw new common_1.BadRequestException('Feed no configurado. Define R2_FEED_LATEST_URL o habilita FEED_INLINE_JSON=1');
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "health", null);
__decorate([
    (0, common_1.Post)('geo/validate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], AppController.prototype, "validateGeoEndpoint", null);
__decorate([
    (0, common_1.Get)('feed'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getFeed", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService])
], AppController);
//# sourceMappingURL=app.controller.js.map