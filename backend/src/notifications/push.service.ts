import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { RegisterPushDto, PushPlatform } from './dto/register-push.dto';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo(); // Expo Push Service

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert de token push (unique por token, multi-dispositivo por usuario).
   */
  async register(userId: number | string, dto: RegisterPushDto) {
    const token = this.normalizeToken(dto?.token);
    if (!token) throw new Error('PUSH_TOKEN_MISSING');

    if (!Expo.isExpoPushToken(token)) {
      // Permitimos formatos no-Expo por si a futuro agregamos FCM directo,
      // pero dejamos advertencia para debug.
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

    this.logger.log(
      `Token registrado/upsert user=${uid} platform=${platform} id=${saved.id}`,
    );
    return { ok: true, id: saved.id };
  }

  /**
   * Desregistro seguro: sólo si el token pertenece al usuario.
   */
  async unregister(userId: number | string, tokenRaw: string) {
    const token = this.normalizeToken(tokenRaw);
    if (!token) return { ok: true, removed: 0 };

    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const existing = await this.prisma.userPushToken.findUnique({
      where: { token },
    });
    if (!existing || existing.userId !== uid) return { ok: true, removed: 0 };

    await this.prisma.userPushToken.delete({ where: { token } });
    this.logger.log(`Token eliminado user=${uid}`);
    return { ok: true, removed: 1 };
  }

  /**
   * Devuelve tokens para un usuario.
   */
  async tokensForUser(userId: number | string) {
    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    return this.prisma.userPushToken.findMany({ where: { userId: uid } });
  }

  /**
   * Envío a todos los tokens de un usuario (con purga de inválidos).
   */
  async sendToUser(
    userId: number | string,
    message: Omit<ExpoPushMessage, 'to'>,
  ): Promise<{ ok: true; sent: number; invalid: number; tokens: number }> {
    const uid = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const tokens = await this.prisma.userPushToken.findMany({
      where: { userId: uid },
    });

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
   * Envío a una lista de tokens (purga DeviceNotRegistered).
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
        const tickets: ExpoPushTicket[] =
          await this.expo.sendPushNotificationsAsync(chunk);

        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const to = (chunk[i] as any)?.to as string | undefined;

          if (ticket.status === 'ok') {
            sent++;
          } else {
            const details = (ticket as any)?.details;
            const msg = (ticket as any)?.message || 'unknown';
            this.logger.warn(
              `Expo ticket error: ${msg} ${details ? JSON.stringify(details) : ''}`,
            );
            invalid++;

            // Purga conservadora: sólo si es DeviceNotRegistered
            if (details?.error === 'DeviceNotRegistered' && to) {
              await this.safeDeleteToken(to);
            }
          }
        }
      } catch (err) {
        this.logger.error('Expo send error', err as any);
      }
    }

    return { ok: true, sent, invalid };
  }

  /**
   * Smoke: push de prueba al usuario actual.
   */
  async sendTestToUser(userId: number | string) {
    const title = '🔔 Test de notificaciones';
    const body = 'Si ves este mensaje, Android push está OK.';
    const data = { kind: 'test', ts: Date.now() };

    return this.sendToUser(userId, {
      title,
      body,
      data,
      sound: undefined, // o 'default'
      priority: 'high',
      channelId: 'orders', // debe existir en Android
    });
  }

  // Helpers
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
      this.logger.warn(
        `No se pudo purgar token ${token}: ${(e as Error).message}`,
      );
    }
  }
}
