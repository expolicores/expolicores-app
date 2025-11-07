import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sendLiveActivityPush } from './live-apns';

@Injectable()
export class LiveActivitiesService {
  private logger = new Logger(LiveActivitiesService.name);

  constructor(private prisma: PrismaService) {}

  async register({ orderId, activityId, pushToken }: { orderId: number; activityId: string; pushToken: string; }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');

    const ola = await this.prisma.orderLiveActivity.upsert({
      where: { orderId },
      update: { activityId, pushToken, userId: order.userId, isEnded: false },
      create: { orderId, activityId, pushToken, userId: order.userId },
    });
    this.logger.log(`Registered LiveActivity for order ${orderId}`);
    return ola;
  }

  async update(orderId: number, state: Record<string, any>) {
    const ola = await this.prisma.orderLiveActivity.findUnique({ where: { orderId } });
    if (!ola || ola.isEnded) return;

    await sendLiveActivityPush(ola.pushToken, {
      aps: { event: 'update', 'content-state': state, timestamp: Math.floor(Date.now()/1000) }
    });
  }

  async end(orderId: number, finalStatus?: string) {
    const ola = await this.prisma.orderLiveActivity.findUnique({ where: { orderId } });
    if (!ola || ola.isEnded) return;

    await sendLiveActivityPush(ola.pushToken, {
      aps: {
        event: 'end',
        'content-state': { orderId, status: finalStatus ?? 'ENTREGADO' },
        timestamp: Math.floor(Date.now()/1000),
        'stale-date': Math.floor(Date.now()/1000) + 1800
      }
    });

    await this.prisma.orderLiveActivity.update({ where: { orderId }, data: { isEnded: true } });
  }
}