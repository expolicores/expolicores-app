"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
// backend/src/notifications/notifications.module.ts
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("../prisma/prisma.module");
const notifications_controller_1 = require("./notifications.controller");
const notifications_service_1 = require("./notifications.service");
const sms_service_1 = require("./sms.service");
const push_controller_1 = require("./push.controller");
const push_service_1 = require("./push.service");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule, // si tienes configs por feature, puedes añadir forFeature(...) en otros módulos
            prisma_module_1.PrismaModule, // requerido por PushService (UserPushToken) y por servicios que usan DB
        ],
        controllers: [
            notifications_controller_1.NotificationsController, // webhooks u otros endpoints de notificaciones
            push_controller_1.PushController, // /notifications/push/register (y test si lo expones)
        ],
        providers: [
            notifications_service_1.NotificationsService, // lógica existente (sms/otros)
            sms_service_1.SmsService, // wrapper Twilio SMS
            push_service_1.PushService, // registro/envío de notificaciones push (Expo)
        ],
        exports: [
            sms_service_1.SmsService, // disponible para otros módulos (Auth/Orders, etc.)
            push_service_1.PushService, // disponible para OrdersService (envío push al crear/cambiar estado)
        ],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map