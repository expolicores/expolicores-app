// backend/src/notifications/push.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

export type PushPlatform = 'ios' | 'android';

export interface RegisterPushDto {
  token: string;          // ej: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  platform: PushPlatform; // 'ios' | 'android'
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra o reasigna un token push al usuario.
   * - `token` es UNIQUE en la tabla.
   * - Si existe, se actualiza userId/plataforma/lastUsedAt.
   */
  async register(userId: number | string, dto: RegisterPushDto) {
    const token = (dto.token || '').trim();
    if (!token) {
      throw new Error('PUSH_TOKEN_MISSING');
    }

    // No bloqueamos si no es formato Expo (permite FCM/APNs directos a futuro),
    // pero dejamos advertencia para visibilidad.
    if (!Expo.isExpoPushToken(token)) {
      this.logger.warn(`Formato de token no-Expo: ${token}`);
    }

    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const saved = await this.prisma.userPushToken.upsert({
      where: { token },
      update: {
        userId: uid,
        platform: dto.platform,
        lastUsedAt: new Date(),
      },
      create: {
        userId: uid,
        token,
        platform: dto.platform,
        lastUsedAt: new Date(),
      },
    });

    this.logger.log(`Token registrado user=${uid} platform=${dto.platform}`);
    return { ok: true, id: saved.id };
  }

  /**
   * Devuelve tokens activos para un usuario.
   */
  async tokensForUser(userId: number) {
    return this.prisma.userPushToken.findMany({ where: { userId } });
  }

  /**
   * Borra un token específico (idempotente).
   */
  async removeToken(token: string) {
    try {
      await this.prisma.userPushToken.delete({ where: { token } });
    } catch {
      // token no existe → ignorar
    }
  }

  /**
   * Envía una notificación a todos los tokens de un usuario.
   * Limpia tokens inválidos (DeviceNotRegistered).
   */
  async sendToUser(
    userId: number | string,
    message: Omit<ExpoPushMessage, 'to'>,
  ): Promise<{ ok: true; sent: number; invalid: number }> {
    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const tokens = await this.prisma.userPushToken.findMany({ where: { userId: uid } });
    if (!tokens.length) {
      this.logger.log(`Sin tokens push para user=${uid}`);
      return { ok: true, sent: 0, invalid: 0 };
    }
    return this.sendToTokens(
      tokens.map((t) => t.token),
      message,
    );
  }

  /**
   * Envía a un conjunto arbitrario de tokens (útil para pruebas/broadcasts controlados).
   * También realiza limpieza de tokens no válidos.
   */
  async sendToTokens(
    tokens: string[],
    message: Omit<ExpoPushMessage, 'to'>,
  ): Promise<{ ok: true; sent: number; invalid: number }> {
    if (!tokens.length) return { ok: true, sent: 0, invalid: 0 };

    const payloads: ExpoPushMessage[] = tokens.map((t) => ({ ...message, to: t }));

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
            const msg = (ticket as any)?.message || 'unknown';
            this.logger.warn(`Expo ticket error: ${msg} ${details ? JSON.stringify(details) : ''}`);

            // Limpieza conservadora: solo cuando es "DeviceNotRegistered"
            if (details?.error === 'DeviceNotRegistered' && to) {
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
