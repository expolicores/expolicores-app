import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// Tipos típicos de Twilio para status callbacks de Messaging
type TwilioStatusPayload = {
  // campos frecuentes:
  MessageSid?: string;
  MessageStatus?: string;     // queued|sent|delivered|failed|undelivered|read|...
  ErrorCode?: string;         // ej. 63035
  ErrorMessage?: string;
  To?: string;                // whatsapp:+57...
  From?: string;              // whatsapp:+57...
  ChannelPrefix?: string;     // whatsapp
  // plus otros campos...
} & Record<string, any>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Maneja actualizaciones de estado de Twilio (idempotente por MessageSid si lo tenemos). */
  async handleStatus(payload: TwilioStatusPayload) {
    const sid = payload.MessageSid || payload.SmsSid;
    if (!sid) {
      this.logger.warn('Webhook sin MessageSid, ignorando.');
      return { ok: false };
    }

    const status = (payload.MessageStatus || '').toLowerCase();
    const ok =
      status === 'delivered' ||
      status === 'sent' ||
      status === 'read'; // delivered/read lo consideramos éxito

    // Intentamos empatar por messageSid si existe en NotificationLog
    const existing = await this.prisma.notificationLog.findFirst({
      where: { messageSid: sid },
      select: { id: true },
    });

    const data = {
      messageSid: sid,
      ok,
      errorCode: payload.ErrorCode ? String(payload.ErrorCode) : null,
      payload,
    } as any;

    if (existing) {
      await this.prisma.notificationLog.update({
        where: { id: existing.id },
        data,
      });
    } else {
      // Si no existe, creamos un registro “sueltico” (sin orderId) con el SID
      await this.prisma.notificationLog.create({
        data: {
          channel: 'whatsapp',
          type: 'STATUS_CALLBACK',
          to: payload.To || null,
          messageSid: sid,
          ok,
          errorCode: payload.ErrorCode ? String(payload.ErrorCode) : null,
          payload,
        } as any,
      });
    }

    this.logger.log(`Twilio status sid=${sid} status=${status} ok=${ok}`);
    return { ok: true };
  }
}
