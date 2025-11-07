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
var JwtStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtStrategy = void 0;
// backend/src/auth/jwt.strategy.ts
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
let JwtStrategy = JwtStrategy_1 = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    constructor(prisma, config) {
        const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
        const rawSecret = (config.get('JWT_SECRET') || '').trim();
        // En desarrollo permitimos fallback; en producción exigimos secret válido
        const secretOrKey = rawSecret ||
            (nodeEnv !== 'production' ? 'dev-secret' : (() => { throw new Error('JWT_SECRET missing in production'); })());
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false, // ✅ NO ignorar expiración
            secretOrKey,
        });
        this.prisma = prisma;
        this.config = config;
        this.logger = new common_1.Logger(JwtStrategy_1.name);
        this.logEnabled = (process.env.LOG_JWT || 'false') === 'true';
        if (this.logEnabled) {
            this.logger.log(`JWT configured. env=${nodeEnv} secret.length=${String(secretOrKey).length}`);
        }
    }
    /**
     * Validate se ejecuta cuando el token es válido criptográficamente y no está expirado.
     * Aquí resolvemos el usuario y devolvemos la "shape" que se adjunta como req.user
     */
    async validate(payload) {
        if (this.logEnabled) {
            // No logueamos el token ni emails completos; solo info mínima
            this.logger.debug(`JWT payload -> sub=${payload.sub} role=${payload.role}`);
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                role: true,
                name: true,
                phone: true,
                businessVerificationStatus: true,
                adminProcessStatus: true,
                isEmailVerified: true,
                isPhoneVerified: true,
            },
        });
        // Si no existe, Passport interpretará "false/null" como Unauthorized (401)
        if (!user) {
            if (this.logEnabled)
                this.logger.warn(`JWT user not found: sub=${payload.sub}`);
            return null;
        }
        // Lo que retornes aquí queda en req.user
        return {
            id: user.id,
            email: user.email ?? null,
            role: user.role,
            name: user.name ?? null,
            phone: user.phone ?? null,
            businessVerificationStatus: user.businessVerificationStatus,
            adminProcessStatus: user.adminProcessStatus,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = JwtStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map