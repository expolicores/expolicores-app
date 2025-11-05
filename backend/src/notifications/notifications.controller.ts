// src/notifications/notifications.controller.ts
import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';

// ✅ Auth (paths según tu repo)
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// ✅ Prisma
import { PrismaService } from '../prisma/prisma.service';

// ✅ Expo Push
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

type ReqWithRaw = Request & { rawBody?: string | Buffer };

@Controller('notifications')
export class NotificationsController {
  private readonly expo = new Expo();

  constructor(
    private readonly cfg: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * --- WEBHOOK TWILIO ---
   * Mantiene la ruta original: /notifications/twilio/webhook
   */
  @Post('twilio/webhook')
  async webhook(
    @Headers('x-twilio-signature') signature: string | undefined,
    @Req() req: ReqWithRaw,
  ) {
    const authToken = this.cfg.get<string>('TWILIO_AUTH_TOKEN');
    if (!authToken) throw new BadRequestException('Twilio auth token no configurado');
    if (!signature) throw new BadRequestException('Falta header x-twilio-signature');

    const url =
      this.cfg.get<string>('TWILIO_WEBHOOK_PUBLIC_URL') ||
      `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    // Twilio SDK
    const twilio = require('twilio') as typeof import('twilio');
    // validateRequestBody no está tipada
    const webhooks: any = require('twilio/lib/webhooks/webhooks');

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    let valid = false;

    try {
      if (contentType.includes('application/x-www-form-urlencoded')) {
        valid = twilio.validateRequest(
          authToken,
          signature,
          url,
          req.body as Record<string, any>,
        );
      } else {
        const raw =
          typeof req.rawBody === 'string'
            ? req.rawBody
            : req.rawBody?.toString() || '';
        valid = webhooks.validateRequestBody(authToken, raw, signature, url);
      }
    } catch {
      valid = false;
    }

    if (!valid) {
      throw new BadRequestException('Firma Twilio inválida');
    }

    await this.notifications.handleStatus(req.body as any);
    return { ok: true };
  }

  /**
   * --- PUSH TEST (QA) ---
   * Envía una notificación push al usuario autenticado usando Expo Push.
   * Ruta: POST /notifications/push/test  (requiere JWT)
   *
   * Respuesta: { ok: true, sent, invalid }
   */
  @Post('push/test')
  @UseGuards(JwtAuthGuard)
  async pushTest(@CurrentUser() me: { id: string }) {
    // 1) Traer tokens del usuario
    const tokens = await this.prisma.userPushToken.findMany({
      where: { userId: me.id },
      select: { token: true },
    });

    if (!tokens.length) {
      return { ok: true, sent: 0, invalid: 0, reason: 'NO_TOKENS' };
    }

    // 2) Construir mensajes
    const base: Omit<ExpoPushMessage, 'to'> = {
      title: 'Expolicores',
      body: 'Prueba de notificaciones: ¡todo OK!',
      sound: 'default',
      priority: 'high',
      data: { type: 'TEST' },
    };

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      ...base,
      to: t.token,
    }));

    // 3) Enviar por chunks y limpiar tokens inválidos
    const chunks = this.expo.chunkPushNotifications(messages);
    let sent = 0;
    let invalid = 0;

    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const to = chunk[i]?.to as string | undefined;

          if (ticket.status === 'ok') {
            sent++;
          } else {
            invalid++;
            const details = (ticket as any)?.details;
            const error = (ticket as any)?.message || 'unknown';

            // Limpieza conservadora de tokens zombis
            if (details?.error === 'DeviceNotRegistered' && to) {
              await this.prisma.userPushToken.deleteMany({ where: { token: to } });
            }

            // Log opcional
            // console.warn('Expo ticket error', { error, details, to });
          }
        }
      } catch (err) {
        // Log opcional
        // console.error('Expo send error', err);
      }
    }

    return { ok: true, sent, invalid };
  }
}
