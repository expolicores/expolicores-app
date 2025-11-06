// backend/src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderNotificationsController } from './notifications.controller';

import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../notifications/whatsapp.module';
import { NotificationsModule } from '../notifications/notifications.module'; // ← para inyectar PushService

import shippingConfig from '../config/shipping';

@Module({
  imports: [
    PrismaModule,
    WhatsAppModule,
    NotificationsModule,                 // ← expone PushService para OrdersService
    ConfigModule.forFeature(shippingConfig), // ← CONFIG(shipping) disponible
  ],
  controllers: [OrdersController, OrderNotificationsController],
  providers: [OrdersService],
})
export class OrdersModule {}
