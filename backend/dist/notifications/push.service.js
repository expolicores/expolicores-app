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
var PushService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
// backend/src/notifications/push.service.ts
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const expo_server_sdk_1 = require("expo-server-sdk");
let PushService = PushService_1 = class PushService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(PushService_1.name);
        this.expo = new expo_server_sdk_1.Expo();
    }
    /**
     * Registra o reasigna un token push al usuario.
     * - `token` es UNIQUE en la tabla.
     * - Si existe, se actualiza userId/plataforma/lastUsedAt.
     */
    async register(userId, dto) {
        const token = (dto.token || '').trim();
        if (!token) {
            throw new Error('PUSH_TOKEN_MISSING');
        }
        // No bloqueamos si no es formato Expo (permite FCM/APNs directos a futuro),
        // pero dejamos advertencia para visibilidad.
        if (!expo_server_sdk_1.Expo.isExpoPushToken(token)) {
            this.logger.warn(`Formato de token no-Expo: ${token}`);
        }
        const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        const saved = await this.prisma.userPushToken.upsert({
            where: { token },
            update: {
                userId: uid,
                platform: dto.platform,
                lastUsedAt: new Date(),
            },
            create: {
                userId: uid,
                token,
                platform: dto.platform,
                lastUsedAt: new Date(),
            },
        });
        this.logger.log(`Token registrado user=${uid} platform=${dto.platform}`);
        return { ok: true, id: saved.id };
    }
    /**
     * Devuelve tokens activos para un usuario.
     */
    async tokensForUser(userId) {
        return this.prisma.userPushToken.findMany({ where: { userId } });
    }
    /**
     * Borra un token específico (idempotente).
     */
    async removeToken(token) {
        try {
            await this.prisma.userPushToken.delete({ where: { token } });
        }
        catch {
            // token no existe → ignorar
        }
    }
    /**
     * Envía una notificación a todos los tokens de un usuario.
     * Limpia tokens inválidos (DeviceNotRegistered).
     */
    async sendToUser(userId, message) {
        const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        const tokens = await this.prisma.userPushToken.findMany({ where: { userId: uid } });
        if (!tokens.length) {
            this.logger.log(`Sin tokens push para user=${uid}`);
            return { ok: true, sent: 0, invalid: 0 };
        }
        return this.sendToTokens(tokens.map((t) => t.token), message);
    }
    /**
     * Envía a un conjunto arbitrario de tokens (útil para pruebas/broadcasts controlados).
     * También realiza limpieza de tokens no válidos.
     */
    async sendToTokens(tokens, message) {
        if (!tokens.length)
            return { ok: true, sent: 0, invalid: 0 };
        const payloads = tokens.map((t) => ({ ...message, to: t }));
        const chunks = this.expo.chunkPushNotifications(payloads);
        let sent = 0;
        let invalid = 0;
        for (const chunk of chunks) {
            try {
                const tickets = await this.expo.sendPushNotificationsAsync(chunk);
                for (let i = 0; i < tickets.length; i++) {
                    const ticket = tickets[i];
                    const to = chunk[i]?.to;
                    if (ticket.status === 'ok') {
                        sent++;
                    }
                    else {
                        invalid++;
                        const details = ticket?.details;
                        const msg = ticket?.message || 'unknown';
                        this.logger.warn(`Expo ticket error: ${msg} ${details ? JSON.stringify(details) : ''}`);
                        // Limpieza conservadora: solo cuando es "DeviceNotRegistered"
                        if (details?.error === 'DeviceNotRegistered' && to) {
                            await this.prisma.userPushToken.deleteMany({ where: { token: to } });
                        }
                    }
                }
            }
            catch (err) {
                this.logger.error('Expo send error', err);
            }
        }
        return { ok: true, sent, invalid };
    }
};
exports.PushService = PushService;
exports.PushService = PushService = PushService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PushService);
//# sourceMappingURL=push.service.js.map