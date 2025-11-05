// backend/src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';

// Controladores existentes (sms/whatsapp webhooks, etc.)
import { NotificationsController } from './notifications.controller';
// Servicios existentes (sms/otros)
import { NotificationsService } from './notifications.service';
import { SmsService } from './sms.service';

// ---- PUSH (Expo/FCM) ----
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [
    ConfigModule, // si tienes configs por feature, puedes usar ConfigModule.forFeature(...)
    PrismaModule, // requerido por PushService (UserPushToken)
  ],
  controllers: [
    NotificationsController,
    PushController, // /notifications/push/register, /notifications/push/test (si lo expones aquí)
  ],
  providers: [
    NotificationsService,
    SmsService,
    PushService, // permite inyectar en OrdersService, etc.
  ],
  exports: [
    SmsService,
    PushService, // <-- importante para usarlo desde OrdersModule
  ],
})
export class NotificationsModule {}
