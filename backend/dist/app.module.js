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
exports.AppModule = void 0;
// src/app.module.ts
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const addresses_module_1 = require("./addresses/addresses.module");
const products_module_1 = require("./products/products.module");
const orders_module_1 = require("./orders/orders.module");
const favorites_module_1 = require("./favorites/favorites.module");
const features_1 = __importDefault(require("./config/features"));
// Bodega (B2B) — catálogo/operaciones para NEGOCIO/ADMIN
const bodega_module_1 = require("./bodega/bodega.module");
// Business — flujo “Soy negocio”: solicitudes, estados admin y verificación
const business_module_1 = require("./business/business.module");
// Geocoding / Cobertura — validación de radio y costos de envío
const geo_module_1 = require("./geo/geo.module");
// Feed — contenido server-driven para Home (promos/combos por rol)
const feed_module_1 = require("./feed/feed.module");
// Promotions — ADMIN (CRUD + overlays públicos)
const promotions_module_1 = require("./promotions/promotions.module");
// Live Activities (ActivityKit) — servicio usado por OrdersService
const live_activities_module_1 = require("./live-activities/live-activities.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // Config global (.env) + feature flags
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [features_1.default],
                envFilePath: '.env',
            }),
            // Infra / dominio
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            addresses_module_1.AddressesModule,
            products_module_1.ProductsModule,
            // Live Activities debe estar disponible para OrdersModule
            live_activities_module_1.LiveActivitiesModule,
            orders_module_1.OrdersModule,
            favorites_module_1.FavoritesModule,
            // Módulos B2B
            bodega_module_1.BodegaModule, // Bodega Virtual (protegido por roles/estatus)
            business_module_1.BusinessModule, // gestión de solicitudes B2B
            // Geocoding / Cobertura
            geo_module_1.GeoModule,
            // Feed server-driven
            feed_module_1.FeedModule,
            // Promociones (incluye /promotions/overlays)
            promotions_module_1.PromotionsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map