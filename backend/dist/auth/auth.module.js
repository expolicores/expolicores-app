"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
// src/auth/auth.module.ts
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("../prisma/prisma.module");
const whatsapp_module_1 = require("../notifications/whatsapp.module");
const notifications_module_1 = require("../notifications/notifications.module");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const jwt_strategy_1 = require("./jwt.strategy");
const roles_guard_1 = require("./guards/roles.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // Si ConfigModule ya es global en AppModule, puedes quitar este bloque.
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
                expandVariables: true,
            }),
            prisma_module_1.PrismaModule,
            whatsapp_module_1.WhatsAppModule,
            notifications_module_1.NotificationsModule,
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (cfg) => {
                    const secret = cfg.get('JWT_SECRET') ?? 'dev_secret';
                    // @nestjs/jwt v11 requiere número (segundos) o StringValue; evitamos string tipo "1d"
                    const expiresIn = Number(cfg.get('JWT_EXPIRES_IN_SECONDS')) || 86400; // 1 día por defecto
                    return {
                        secret,
                        signOptions: { expiresIn },
                    };
                },
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, jwt_strategy_1.JwtStrategy, roles_guard_1.RolesGuard],
        exports: [auth_service_1.AuthService, jwt_1.JwtModule, passport_1.PassportModule, roles_guard_1.RolesGuard],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map