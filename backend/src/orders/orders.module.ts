import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { PushService } from '../notifications/push.service'; // o donde lo tengas
import { LiveActivitiesModule } from '../live-activities/live-activities.module';

@Module({
  imports: [
    // Usa forwardRef si hay ciclo; si no hay ciclo, puedes dejar sólo LiveActivitiesModule
    forwardRef(() => LiveActivitiesModule),
  ],
  controllers: [OrdersController],
  // prettier-ignore
  providers: [
    OrdersService,
    PrismaService,
    WhatsAppService,
    PushService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
