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
exports.GeoService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const geo_1 = require("../common/geo");
let GeoService = class GeoService {
    constructor(cfg) {
        this.cfg = cfg;
        // Mover lectura de envs al constructor (ya existe this.cfg)
        this.storeLat = Number(this.cfg.get('STORE_LAT') ?? 0);
        this.storeLng = Number(this.cfg.get('STORE_LNG') ?? 0);
        this.radiusKm = Number(this.cfg.get('DELIVERY_RADIUS_KM') ?? 0);
        this.shippingBase = Number(this.cfg.get('SHIPPING_BASE') ?? 0);
        this.shippingPerKm = Number(this.cfg.get('SHIPPING_PER_KM') ?? 0);
        this.shippingMin = Number(this.cfg.get('SHIPPING_MIN') ?? 0);
    }
    validateCoverage(lat, lng, normalized) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return {
                inCoverage: false,
                distanceKm: 0,
                shippingCost: this.shippingMin,
                normalizedAddress: normalized,
                reason: 'INVALID_COORDS',
            };
        }
        const distance = (0, geo_1.haversineKm)({ lat: this.storeLat, lng: this.storeLng }, { lat, lng });
        const distanceRounded = Math.round(distance * 10) / 10; // 0.1 km
        const variable = this.shippingPerKm * distanceRounded;
        const cost = Math.max(this.shippingMin, this.shippingBase + variable);
        const inCoverage = distance <= this.radiusKm;
        return {
            inCoverage,
            distanceKm: distanceRounded,
            shippingCost: Math.round(cost),
            normalizedAddress: normalized,
            reason: inCoverage ? 'OK' : 'OUT_OF_RADIUS',
        };
    }
};
exports.GeoService = GeoService;
exports.GeoService = GeoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeoService);
//# sourceMappingURL=geo.service.js.map