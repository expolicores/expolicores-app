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
exports.NotificationsController = void 0;
// src/notifications/notifications.controller.ts
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const notifications_service_1 = require("./notifications.service");
let NotificationsController = class NotificationsController {
    constructor(cfg, notifications) {
        this.cfg = cfg;
        this.notifications = notifications;
    }
    /** Webhook de Twilio para status de mensajes (Messaging Service / Senders). */
    async webhook(signature, req) {
        const authToken = this.cfg.get('TWILIO_AUTH_TOKEN');
        if (!authToken)
            throw new common_1.BadRequestException('Twilio auth token no configurado');
        if (!signature)
            throw new common_1.BadRequestException('Falta header x-twilio-signature');
        const url = this.cfg.get('TWILIO_WEBHOOK_PUBLIC_URL') ||
            `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        // Twilio SDK
        // - validateRequest (para x-www-form-urlencoded)
        // - validateRequestBody (para JSON/raw) — no tipado en d.ts, así que lo tomamos desde el módulo interno
        const twilio = require('twilio');
        const webhooks = require('twilio/lib/webhooks/webhooks');
        const contentType = String(req.headers['content-type'] || '').toLowerCase();
        let valid = false;
        try {
            if (contentType.includes('application/x-www-form-urlencoded')) {
                valid = twilio.validateRequest(authToken, signature, url, req.body);
            }
            else {
                const raw = typeof req.rawBody === 'string'
                    ? req.rawBody
                    : req.rawBody?.toString() || '';
                // Usamos la variante no tipada desde el módulo interno para JSON/raw
                valid = webhooks.validateRequestBody(authToken, raw, signature, url);
            }
        }
        catch {
            valid = false;
        }
        if (!valid) {
            throw new common_1.BadRequestException('Firma Twilio inválida');
        }
        await this.notifications.handleStatus(req.body);
        return { ok: true };
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Post)('webhook'),
    __param(0, (0, common_1.Headers)('x-twilio-signature')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "webhook", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.Controller)('notifications/twilio'),
    __metadata("design:paramtypes", [config_1.ConfigService,
        notifications_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map