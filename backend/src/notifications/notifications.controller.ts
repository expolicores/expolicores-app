// src/notifications/notifications.controller.ts
import {
  Controller,
  Headers,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import type { Request } from 'express';

type ReqWithRaw = Request & { rawBody?: string | Buffer };

@Controller('notifications/twilio')
export class NotificationsController {
  constructor(
    private readonly cfg: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Webhook de Twilio para status de mensajes (Messaging Service / Senders). */
  @Post('webhook')
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
    // - validateRequest (para x-www-form-urlencoded)
    // - validateRequestBody (para JSON/raw) — no tipado en d.ts, así que lo tomamos desde el módulo interno
    const twilio = require('twilio') as typeof import('twilio');
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
        // Usamos la variante no tipada desde el módulo interno para JSON/raw
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
}
