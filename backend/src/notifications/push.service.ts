// backend/src/notifications/push.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

export type PushPlatform = 'ios' | 'android';

export interface RegisterPushDto {
  token: string;           // Expo push token, ej: ExponentPushToken[xxxxxxxxxxxxxx]
  platform: PushPlatform;  // 'ios' | 'android'
}

@Injectable()
export class PushService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(PushService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Registra o actualiza un token de notificaciones para el usuario.
   * - `token` es único a nivel de tabla (constraint UNIQUE).
   * - Si el token existe, se re-asigna al userId actual y se actualiza plataforma/lastUsedAt.
   */
  async register(userId: number, dto: RegisterPushDto) {
    const token = (dto.token || '').trim();

    // Validación mínima del formato de Expo Push Token (no bloqueante, solo warning)
    if (!token) {
      throw new Error('PUSH_TOKEN_MISSING');
    }
    if (!Expo.isExpoPushToken(token)) {
      this.logger.warn(`Token con formato no-Expo: ${token}`);
      // Permitimos continuar por si estás usando FCM/APNs directos más adelante.
    }

    // upsert por token único
    const saved = await this.prisma.userPushToken.upsert({
      where: { token },
      update: {
        userId,
        platform: dto.platform,
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        token,
        platform: dto.platform,
        lastUsedAt: new Date(),
      },
    });

    this.logger.log(`Push token registrado user=${userId} platform=${dto.platform}`);
    return { ok: true, id: saved.id };
  }

  /**
   * Envía notificaciones Expo a todos los tokens activos del usuario.
   * Limpia tokens inválidos (DeviceNotRegistered) inmediatamente.
   */
  async sendToUser(userId: string, message: Omit<ExpoPushMessage, 'to'>) {
    const uid = Number(userId);
    const tokens = await this.prisma.userPushToken.findMany({ where: { userId: uid } });
    if (!tokens.length) {
      this.logger.log(`No push tokens for user ${uid}`);
      return { ok: true, sent: 0, invalid: 0 };
    }

    const payloads: ExpoPushMessage[] = tokens.map((t) => ({
      ...message,
      to: t.token,
    }));

    const chunks = this.expo.chunkPushNotifications(payloads);

    let sent = 0;
    let invalid = 0;

    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const to = (chunk[i] as any)?.to as string | undefined;

          if (ticket.status === 'ok') {
            sent++;
          } else {
            invalid++;
            const details = (ticket as any)?.details;
            const message = (ticket as any)?.message || 'unknown';
            this.logger.warn(`Expo ticket error: ${message} ${JSON.stringify(details)}`);

            // Limpieza conservadora: solo tokens no registrados
            const fatal = details?.error === 'DeviceNotRegistered';
            if (fatal && to) {
              await this.prisma.userPushToken.deleteMany({ where: { token: to } });
            }
          }
        }
      } catch (err) {
        this.logger.error('Expo send error', err as any);
      }
    }

    return { ok: true, sent, invalid };
  }
}
