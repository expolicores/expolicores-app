// backend/src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsService } from './sms.service';

// Push (registro de tokens Expo/FCM)
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [
    NotificationsController, // controladores existentes (ej. sms/whatsapp webhooks)
    PushController,          // nuevo: /notifications/push/register
  ],
  providers: [
    NotificationsService, // lógica existente (sms/whatsapp u otros)
    SmsService,           // wrapper Twilio SMS u otro proveedor
    PushService,          // nuevo: gestión de tokens push
  ],
  exports: [
    SmsService,  // ⬅️ importante para que AuthModule/OrdersModule pueda inyectarlo
    PushService, // para enviar notifs push desde otros módulos (Orders, etc.)
  ],
})
export class NotificationsModule {}
