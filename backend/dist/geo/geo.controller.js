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
exports.GeoController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const geo_service_1 = require("./geo.service");
const validate_geo_dto_1 = require("./dto/validate-geo.dto");
let GeoController = class GeoController {
    constructor(geo, cfg) {
        this.geo = geo;
        this.cfg = cfg;
    }
    async validate(body) {
        // MVP: esperamos coords desde el cliente (Place Details). Si no vienen en body.lat/lng,
        // aceptamos las que vengan anidadas en normalizedAddress.
        const lat = body.lat ?? body.normalizedAddress?.lat;
        const lng = body.lng ?? body.normalizedAddress?.lng;
        const resp = this.geo.validateCoverage(lat, lng, body.normalizedAddress);
        return resp;
    }
};
exports.GeoController = GeoController;
__decorate([
    (0, common_1.Post)('validate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [validate_geo_dto_1.ValidateGeoDto]),
    __metadata("design:returntype", Promise)
], GeoController.prototype, "validate", null);
exports.GeoController = GeoController = __decorate([
    (0, common_1.Controller)('geo'),
    __metadata("design:paramtypes", [geo_service_1.GeoService, config_1.ConfigService])
], GeoController);
//# sourceMappingURL=geo.controller.js.map