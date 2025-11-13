// backend/src/notifications/push.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

export type PushPlatform = 'ios' | 'android';

export interface RegisterPushDto {
  token: string;          // ej: ExponentPushToken[XXXXXXXXXXXX]
  platform?: PushPlatform; // 'ios' | 'android' (default: 'android')
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo(); // Expo Push Service (usa FCM/APNs detrás)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra o re-asigna un token push al usuario (idempotente).
   * - `token` es UNIQUE en la tabla.
   * - Si ya existe, reasigna userId/plataforma y actualiza lastUsedAt.
   */
  async register(userId: number | string, dto: RegisterPushDto) {
    const token = this.normalizeToken(dto?.token);
    if (!token) {
      throw new Error('PUSH_TOKEN_MISSING');
    }

    // No bloqueamos tokens no-Expo (futuro FCM/APNs directos), pero dejamos advertencia.
    if (!Expo.isExpoPushToken(token)) {
      this.logger.warn(`Formato de token no-Expo: ${token}`);
    }

    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const platform = this.normalizePlatform(dto?.platform);

    const saved = await this.prisma.userPushToken.upsert({
      where: { token },
      update: {
        userId: uid,
        platform: platform as any,
        lastUsedAt: new Date(),
      },
      create: {
        userId: uid,
        token,
        platform: platform as any,
        lastUsedAt: new Date(),
      },
    });

    this.logger.log(`Token registrado/upsert user=${uid} platform=${platform} id=${saved.id}`);
    return { ok: true, id: saved.id };
  }

  /**
   * Desregistra un token específico del usuario (idempotente, seguro por user).
   */
  async unregister(userId: number | string, tokenRaw: string) {
    const token = this.normalizeToken(tokenRaw);
    if (!token) return { ok: true, removed: 0 };

    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    // Borrado seguro: sólo si pertenece al usuario
    const existing = await this.prisma.userPushToken.findUnique({ where: { token } });
    if (!existing || existing.userId !== uid) return { ok: true, removed: 0 };

    await this.prisma.userPushToken.delete({ where: { token } });
    this.logger.log(`Token eliminado user=${uid}`);
    return { ok: true, removed: 1 };
  }

  /**
   * Devuelve tokens activos para un usuario.
   */
  async tokensForUser(userId: number | string) {
    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    return this.prisma.userPushToken.findMany({ where: { userId: uid } });
  }

  /**
   * Envía una notificación a todos los tokens de un usuario.
   * Realiza limpieza de tokens inválidos (DeviceNotRegistered).
   */
  async sendToUser(
    userId: number | string,
    message: Omit<ExpoPushMessage, 'to'>,
  ): Promise<{ ok: true; sent: number; invalid: number; tokens: number }> {
    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const tokens = await this.prisma.userPushToken.findMany({ where: { userId: uid } });

    if (!tokens.length) {
      this.logger.log(`Sin tokens push para user=${uid}`);
      return { ok: true, sent: 0, invalid: 0, tokens: 0 };
    }

    const res = await this.sendToTokens(
      tokens.map((t) => t.token),
      message,
    );
    return { ...res, tokens: tokens.length };
  }

  /**
   * Envía a un conjunto arbitrario de tokens (útil para pruebas/broadcasts controlados).
   * Purga automáticamente tokens con error "DeviceNotRegistered".
   */
  async sendToTokens(
    tokens: string[],
    message: Omit<ExpoPushMessage, 'to'>,
  ): Promise<{ ok: true; sent: number; invalid: number }> {
    if (!tokens.length) return { ok: true, sent: 0, invalid: 0 };

    const payloads: ExpoPushMessage[] = tokens.map((t) => ({
      ...message,
      to: t,
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
            const details = (ticket as any)?.details;
            const msg = (ticket as any)?.message || 'unknown';
            this.logger.warn(`Expo ticket error: ${msg} ${details ? JSON.stringify(details) : ''}`);
            invalid++;

            // Limpieza conservadora: sólo cuando el error indica dispositivo no registrado
            if (details?.error === 'DeviceNotRegistered' && to) {
              await this.safeDeleteToken(to);
            }
          }
        }
      } catch (err) {
        // Error de red u otro: no contamos como inválidos específicos
        this.logger.error('Expo send error', err as any);
      }
    }

    return { ok: true, sent, invalid };
  }

  /**
   * Smoke interno: envía un push "test" al usuario.
   * Útil para /notifications/push/test del controlador.
   */
  async sendTestToUser(userId: number | string) {
    const title = '🔔 Test de notificaciones';
    const body = 'Si ves este mensaje, Android push está OK.';
    const data = { kind: 'test', ts: Date.now() };

    return this.sendToUser(userId, {
      title,
      body,
      data,
      sound: undefined, // personalizable
      priority: 'high',
      channelId: 'orders', // debe existir en Android
    });
  }

  // -------------------
  // Helpers
  // -------------------

  private normalizeToken(token?: string) {
    return (token || '').trim();
  }

  private normalizePlatform(p?: PushPlatform): PushPlatform {
    return p === 'ios' || p === 'android' ? p : 'android';
  }

  private async safeDeleteToken(token: string) {
    try {
      await this.prisma.userPushToken.deleteMany({ where: { token } });
      this.logger.log(`Token purgado por DeviceNotRegistered: ${token}`);
    } catch (e) {
      this.logger.warn(`No se pudo purgar token ${token}: ${(e as Error).message}`);
    }
  }
}
