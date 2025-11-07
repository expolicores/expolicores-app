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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(cfg, prisma) {
        this.cfg = cfg;
        this.prisma = prisma;
        this.logger = new common_1.Logger(NotificationsService_1.name);
    }
    /** Maneja actualizaciones de estado de Twilio (idempotente por MessageSid si lo tenemos). */
    async handleStatus(payload) {
        const sid = payload.MessageSid || payload.SmsSid;
        if (!sid) {
            this.logger.warn('Webhook sin MessageSid, ignorando.');
            return { ok: false };
        }
        const status = (payload.MessageStatus || '').toLowerCase();
        const ok = status === 'delivered' ||
            status === 'sent' ||
            status === 'read'; // delivered/read lo consideramos éxito
        // Intentamos empatar por messageSid si existe en NotificationLog
        const existing = await this.prisma.notificationLog.findFirst({
            where: { messageSid: sid },
            select: { id: true },
        });
        const data = {
            messageSid: sid,
            ok,
            errorCode: payload.ErrorCode ? String(payload.ErrorCode) : null,
            payload,
        };
        if (existing) {
            await this.prisma.notificationLog.update({
                where: { id: existing.id },
                data,
            });
        }
        else {
            // Si no existe, creamos un registro “sueltico” (sin orderId) con el SID
            await this.prisma.notificationLog.create({
                data: {
                    channel: 'whatsapp',
                    type: 'STATUS_CALLBACK',
                    to: payload.To || null,
                    messageSid: sid,
                    ok,
                    errorCode: payload.ErrorCode ? String(payload.ErrorCode) : null,
                    payload,
                },
            });
        }
        this.logger.log(`Twilio status sid=${sid} status=${status} ok=${ok}`);
        return { ok: true };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map