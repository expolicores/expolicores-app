import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import shippingConfig from '../config/shipping';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { PushService } from '../notifications/push.service'; // ajusta la ruta si difiere
import { LiveActivitiesModule } from '../live-activities/live-activities.module';

@Module({
  imports: [
    // Hace disponible CONFIGURATION(shipping) dentro de OrdersModule
    ConfigModule.forFeature(shippingConfig),

    // Solo si Orders ↔ LiveActivities tienen dependencia mutua, deja forwardRef
    forwardRef(() => LiveActivitiesModule),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PrismaService,
    WhatsAppService,
    PushService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
