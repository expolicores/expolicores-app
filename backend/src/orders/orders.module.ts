// backend/src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderNotificationsController } from './notifications.controller';

import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../notifications/whatsapp.module';
import { NotificationsModule } from '../notifications/notifications.module'; // ← exporta PushService

import { ConfigModule } from '@nestjs/config';
import shippingConfig from '../config/shipping';

@Module({
  imports: [
    PrismaModule,
    WhatsAppModule,
    NotificationsModule,                 // ← habilita inyección de PushService en OrdersService
    ConfigModule.forFeature(shippingConfig),
  ],
  controllers: [OrdersController, OrderNotificationsController],
  providers: [OrdersService],
})
export class OrdersModule {}
