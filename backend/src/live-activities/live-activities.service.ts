// src/live-activities/live-activities.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderLiveActivity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sendLiveActivityPush } from './live-apns';

type ContentState = Record<string, any>;

// Resultado mínimo que esperamos del push a APNs (Live Activities)
interface PushResult {
  status: number;
  apnsId?: string;
}

// Shape real que devuelve Prisma cuando usamos `select: { id, userId }`
type OrderLite = { id: number; userId: number };

const nowSeconds = () => Math.floor(Date.now() / 1000);

@Injectable()
export class LiveActivitiesService {
  private readonly logger = new Logger(LiveActivitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inicia/Registra una Live Activity para un pedido.
   * - Cierra (end) cualquier Live Activity previa del mismo usuario.
   * - Upsert del registro por orderId.
   */
  async register(params: {
    orderId: number;
    activityId: string;
    pushToken: string;
  }): Promise<OrderLiveActivity> {
    const { orderId, activityId, pushToken } = params;

    if (!orderId || !activityId || !pushToken) {
      this.logger.warn(
        `LA.start skipped (missing data) → order=${orderId} activityId=${activityId} token=${!!pushToken}`,
      );
      throw new Error('Missing required fields for Live Activity register');
    }

    const order: OrderLite | null = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    if (!order) throw new NotFoundException(`Order not found: ${orderId}`);

    // Cierra cualquier LA previa activa del mismo usuario
    const prevActives = await this.prisma.orderLiveActivity.findMany({
      where: { userId: order.userId, isEnded: false },
    });

    for (const prev of prevActives) {
      if (prev.orderId !== orderId) {
        this.logger.log(
          `LA.forceEnd (previous) → user=${order.userId} prevOrder=${prev.orderId}`,
        );
        await this.safeEnd(prev, 'REPLACED_BY_NEW');
      }
    }

    const ola = await this.prisma.orderLiveActivity.upsert({
      where: { orderId },
      update: {
        activityId,
        pushToken,
        userId: order.userId,
        isEnded: false,
        updatedAt: new Date(),
      },
      create: {
        orderId,
        activityId,
        pushToken,
        userId: order.userId,
        isEnded: false,
      },
    });

    this.logger.log(
      `LA.start → order=${orderId} user=${order.userId} activityId=${activityId}`,
    );

    return ola;
  }

  /**
   * Envía un update de Live Activity (no hace mutación de estado local salvo logging).
   * Si la LA no existe o está terminada, sale silenciosamente.
   */
  async update(orderId: number, state: ContentState): Promise<void> {
    const ola = await this.prisma.orderLiveActivity.findUnique({ where: { orderId } });
    if (!ola) {
      this.logger.warn(`LA.update skipped (not found) → order=${orderId}`);
      return;
    }
    if (ola.isEnded) {
      this.logger.warn(`LA.update skipped (already ended) → order=${orderId}`);
      return;
    }

    const payload = {
      aps: {
        event: 'update',
        'content-state': state ?? {},
        timestamp: nowSeconds(),
      },
    };

    try {
      // Forzamos el tipo esperado del resultado para evitar el "never"
      const res: PushResult = (await sendLiveActivityPush(
        ola.pushToken,
        payload,
      )) as any;

      this.logger.log(
        `LA.update sent → order=${orderId} status=${res?.status ?? 'unknown'} apns-id=${res?.apnsId ?? '-'}`,
      );
    } catch (err: any) {
      this.logger.error(
        `LA.update failed → order=${orderId} err=${err?.message ?? String(err)}`,
        err?.stack,
      );
    }
  }

  /**
   * Termina la Live Activity de un pedido.
   * - Marca la fila como isEnded=true.
   * - Envía push con event=end y stale-date.
   */
  async end(
    orderId: number,
    finalStatus = 'ENTREGADO',
    staleSeconds = 30 * 60,
  ): Promise<void> {
    const ola = await this.prisma.orderLiveActivity.findUnique({ where: { orderId } });
    if (!ola) {
      this.logger.warn(`LA.end skipped (not found) → order=${orderId}`);
      return;
    }
    if (ola.isEnded) {
      this.logger.log(`LA.end ignored (already ended) → order=${orderId}`);
      return;
    }

    const payload = {
      aps: {
        event: 'end',
        'content-state': { orderId, status: finalStatus },
        timestamp: nowSeconds(),
        'stale-date': nowSeconds() + Math.max(0, staleSeconds),
      },
    };

    try {
      const res: PushResult = (await sendLiveActivityPush(
        ola.pushToken,
        payload,
      )) as any;

      this.logger.log(
        `LA.end sent → order=${orderId} status=${res?.status ?? 'unknown'} apns-id=${res?.apnsId ?? '-'}`,
      );
    } catch (err: any) {
      // Incluso si falla el push, marcamos ended para no quedar colgados
      this.logger.error(
        `LA.end push failed → order=${orderId} err=${err?.message ?? String(err)}`,
        err?.stack,
      );
    } finally {
      await this.prisma.orderLiveActivity.update({
        where: { orderId },
        data: { isEnded: true, updatedAt: new Date() },
      });
    }
  }

  /**
   * Termina de forma segura un registro concreto (sin buscar por orderId).
   * Útil para “forzar cierre” de previas al registrar una nueva.
   */
  private async safeEnd(
    ola: Pick<OrderLiveActivity, 'orderId' | 'pushToken' | 'isEnded'>,
    reason = 'FORCED_END',
    staleSeconds = 10,
  ): Promise<void> {
    if (!ola || ola.isEnded) return;

    const payload = {
      aps: {
        event: 'end',
        'content-state': { orderId: ola.orderId, status: reason },
        timestamp: nowSeconds(),
        'stale-date': nowSeconds() + Math.max(0, staleSeconds),
      },
    };

    try {
      await sendLiveActivityPush(ola.pushToken, payload);
    } catch (err: any) {
      this.logger.warn(
        `LA.safeEnd push failed → order=${ola.orderId} err=${err?.message ?? String(err)}`,
      );
    } finally {
      await this.prisma.orderLiveActivity.update({
        where: { orderId: ola.orderId },
        data: { isEnded: true, updatedAt: new Date() },
      });
    }
  }
}
