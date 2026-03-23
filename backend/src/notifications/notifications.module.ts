// backend/src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsService } from './sms.service';

import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [
    ConfigModule, // si tienes configs por feature, puedes añadir forFeature(...) en otros módulos
    PrismaModule, // requerido por PushService (UserPushToken) y por servicios que usan DB
  ],
  controllers: [
    NotificationsController, // webhooks u otros endpoints de notificaciones
    PushController,          // /notifications/push/register (y test si lo expones)
  ],
  providers: [
    NotificationsService,    // lógica existente (sms/otros)
    SmsService,              // wrapper Twilio SMS
    PushService,             // registro/envío de notificaciones push (Expo)
  ],
  exports: [
    SmsService,              // disponible para otros módulos (Auth/Orders, etc.)
    PushService,             // disponible para OrdersService (envío push al crear/cambiar estado)
  ],
})
export class NotificationsModule {}
