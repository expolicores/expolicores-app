// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../notifications/whatsapp.module';
import { OrderNotificationsController } from './notifications.controller';

// 👇 agrega ConfigModule.forFeature(shippingConfig)
import { ConfigModule } from '@nestjs/config';
import shippingConfig from '../config/shipping';

@Module({
  imports: [
    PrismaModule,
    WhatsAppModule,
    ConfigModule.forFeature(shippingConfig), // <- hace visible CONFIGURATION(shipping)
  ],
  controllers: [OrdersController, OrderNotificationsController],
  providers: [OrdersService],
})
export class OrdersModule {}
