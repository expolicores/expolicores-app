// src/notifications/whatsapp.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import whatsappConfig from '../config/whatsapp';
import { PrismaService } from '../prisma/prisma.service';

type ItemRow = { name: string; quantity: number; price: number };
type Status = 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private client: any | null;

  constructor(
    @Inject(whatsappConfig.KEY) private readonly cfg: ConfigType<typeof whatsappConfig>,
    private readonly prisma: PrismaService,
  ) {
    if (this.cfg.accountSid && this.cfg.authToken) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Twilio = require('twilio');
      this.client = new Twilio(this.cfg.accountSid, this.cfg.authToken);
    } else {
      this.client = null;
    }
  }

  /** Formatea números a COP (entero redondeado) */
  private cop(n: number) {
    return `$${Math.round(n).toLocaleString('es-CO')}`;
  }

  /** Normaliza a E.164 CO para canal WhatsApp de Twilio */
  private toWhatsAppE164CO(phoneRaw?: string | null): string | null {
    const digits = (phoneRaw ?? '').replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.startsWith('57') ? digits : `57${digits}`;
    return `whatsapp:+${withCountry}`;
  }

  /** Log "create" básico (para confirmaciones donde se permite múltiples) */
  private async log(orderId: number, type: string, to: string, ok: boolean, sid?: string, error?: string) {
    try {
      await this.prisma.notificationLog.create({ data: { orderId, type, to, ok, sid, error } });
    } catch (e: any) {
      this.logger.error(`No se pudo registrar NotificationLog: ${e?.message ?? e}`);
    }
  }

  /** Log idempotente por tipo (STATUS_*) — usa upsert y NO reenvía si existe */
  private async logOnce(orderId: number, type: string, to: string, sid?: string | null, error?: string | null) {
    try {
      await this.prisma.notificationLog.upsert({
        where: { orderId_type: { orderId, type } },
        create: { orderId, type, to, ok: !!sid, sid: sid ?? undefined, error: sid ? null : error ?? 'SEND_FAILED' },
        update: {}, // idempotente: si ya existe, no lo modifica
      });
    } catch (e: any) {
      this.logger.error(`No se pudo upsert NotificationLog: ${e?.message ?? e}`);
    }
  }

  // === CONFIRMACION PEDIDO (US10) ===
  async sendOrderConfirmation(params: {
    toPhone: string;
    orderId: number;
    subtotal: number;
    shipping: number;
    total: number;
    paymentMethod: string;
    items: ItemRow[];
    addressLabel?: string;
    addressLine?: string;
    notes?: string;
    tenant?: string;
  }) {
    if (!this.cfg.enabled) {
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'disabled');
      return { ok: false };
    }
    if (!this.client || !this.cfg.from) {
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'twilio_not_ready');
      return { ok: false };
    }

    const to = this.toWhatsAppE164CO(params.toPhone);
    if (!to) {
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'invalid_phone');
      return { ok: false };
    }

    const addressDisplay = [params.addressLabel, params.addressLine].filter(Boolean).join(' - ');

    const sendPlain = async () => {
      const header = `*${params.tenant ?? 'Expolicores'}*\nConfirmacion de pedido #${params.orderId}`;
      const lineItems = params.items.slice(0, 8).map((i) => `- ${i.quantity}x ${i.name}`);
      const extra = params.items.length > 8 ? `-(+${params.items.length - 8} items)` : null;
      const itemsBlock = [...lineItems, ...(extra ? [extra] : [])].join('\n');
      const paymentLabel = params.paymentMethod === 'COD' ? 'Contraentrega' : params.paymentMethod;
      const bodyLines = [
        header,
        itemsBlock,
        '--------------',
        `Subtotal: ${this.cop(params.subtotal)}`,
        `Envio:    ${this.cop(params.shipping)}`,
        `Total:    ${this.cop(params.total)}`,
        `Pago: ${paymentLabel}`,
        `Entrega a: ${addressDisplay || 'Direccion por defecto'}`,
      ];
      if (params.notes) {
        bodyLines.push(`Notas: ${params.notes}`);
      }
      bodyLines.push('', 'Gracias por tu compra.', 'Consulta tus pedidos en la app: Perfil -> Mis pedidos');
      const body = bodyLines.join('\n');

      try {
        const res = await this.client.messages.create({
          from: this.cfg.from,
          to,
          body,
        });
        await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, true, res.sid);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        await this.log(
          params.orderId,
          'ORDER_CONFIRMATION',
          params.toPhone,
          false,
          undefined,
          e?.message ?? String(e),
        );
        return { ok: false };
      }
    };

    if (this.cfg.useTemplates && this.cfg.confirmationContentSid) {
      const vars = {
        '1': String(params.orderId),
        '2': this.cop(params.subtotal),
        '3': this.cop(params.shipping),
        '4': this.cop(params.total),
        '5': params.paymentMethod === 'COD' ? 'Contraentrega' : params.paymentMethod,
        '6': addressDisplay || 'Direccion registrada',
      };

      try {
        const res = await this.client.messages.create({
          from: this.cfg.from,
          to,
          contentSid: this.cfg.confirmationContentSid,
          contentVariables: JSON.stringify(vars),
        });
        await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, true, res.sid);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        this.logger.warn(
          `WhatsApp template confirmation failed for order ${params.orderId}; falling back to plain text. ${msg}`,
        );
        await this.log(
          params.orderId,
          'ORDER_CONFIRMATION_TEMPLATE_FAIL',
          params.toPhone,
          false,
          undefined,
          msg,
        );
        return sendPlain();
      }
    }

    return sendPlain();
  }

  // === CAMBIO DE ESTADO (US12) ===
  async sendStatusUpdate(params: {
    toPhone: string;
    orderId: number;
    newStatus: Status;
    tenant?: string;
  }) {
    if (!this.cfg.enabled || !this.cfg.sendStatusUpdates) {
      await this.logOnce(params.orderId, 'STATUS_' + params.newStatus, params.toPhone, null, 'disabled');
      return { ok: false };
    }
    if (!this.client || !this.cfg.from) {
      await this.logOnce(params.orderId, 'STATUS_' + params.newStatus, params.toPhone, null, 'twilio_not_ready');
      return { ok: false };
    }

    const to = this.toWhatsAppE164CO(params.toPhone);
    if (!to) {
      await this.logOnce(params.orderId, 'STATUS_' + params.newStatus, params.toPhone, null, 'invalid_phone');
      return { ok: false };
    }

    const type = `STATUS_${params.newStatus}`;
    const existing = await this.prisma.notificationLog.findUnique({
      where: { orderId_type: { orderId: params.orderId, type } },
      select: { sid: true, ok: true },
    });
    if (existing) {
      return { ok: !!existing.ok, sid: existing.sid ?? undefined, skipped: true as const };
    }

    const sendPlain = async () => {
      const statusText =
        params.newStatus === 'EN_CAMINO'
          ? 'Tu pedido va en camino.'
          : params.newStatus === 'ENTREGADO'
          ? 'Tu pedido fue entregado.'
          : 'Tu pedido fue cancelado.';

      const body = `*${params.tenant ?? 'Expolicores'}* - Pedido #${params.orderId}
${statusText}
Gracias por comprar con nosotros.`;

      try {
        const res = await this.client.messages.create({
          from: this.cfg.from,
          to,
          body,
        });
        await this.logOnce(params.orderId, type, params.toPhone, res.sid, null);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        await this.logOnce(params.orderId, type, params.toPhone, null, e?.message ?? String(e));
        return { ok: false };
      }
    };

    if (this.cfg.useTemplates && this.cfg.statusContentSid) {
      const human =
        params.newStatus === 'EN_CAMINO'
          ? 'En camino'
          : params.newStatus === 'ENTREGADO'
          ? 'Entregado'
          : 'Cancelado';
      const vars = { '1': String(params.orderId), '2': human };

      try {
        const res = await this.client.messages.create({
          from: this.cfg.from,
          to,
          contentSid: this.cfg.statusContentSid,
          contentVariables: JSON.stringify(vars),
        });
        await this.logOnce(params.orderId, type, params.toPhone, res.sid, null);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        this.logger.warn(
          `WhatsApp status template failed for order ${params.orderId} (${params.newStatus}); falling back to plain text. ${msg}`,
        );
        await this.log(params.orderId, `${type}_TEMPLATE_FAIL`, params.toPhone, false, undefined, msg);
        return sendPlain();
      }
    }

    return sendPlain();
  }
}

