// src/notifications/whatsapp.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type Twilio from 'twilio';

type ItemRow = { name: string; quantity: number; price: number };
type Status = 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  // Twilio
  private twilioClient: Twilio.Twilio | null;

  // Flags (desde .env)
  private readonly featureOn: boolean;
  private readonly sendOn: boolean; // usamos el mismo flag para OTP en dev
  private readonly useTemplates: boolean;
  private readonly sendStatusUpdates: boolean;

  // Direcciones
  private readonly from: string | null;        // formato: whatsapp:+14155238886 (sandbox)
  private readonly toOverride: string | null;  // formato: whatsapp:+57XXXXXXXXXX (solo dev)

  constructor(
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // === Lee variables de entorno ===
    const sid   = this.cfg.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.cfg.get<string>('TWILIO_AUTH_TOKEN');

    this.featureOn         = this.bool(this.cfg.get('FEATURE_WHATSAPP_NOTIFICATIONS'));
    this.sendOn            = this.bool(this.cfg.get('SEND_WHATSAPP_NOTIFS')) || this.featureOn; // compat
    this.useTemplates      = this.bool(this.cfg.get('WHATSAPP_USE_TEMPLATES'));
    this.sendStatusUpdates = this.bool(this.cfg.get('WHATSAPP_SEND_STATUS_UPDATES'));

    this.from       = this.sanitizeWhatsAppAddr(this.cfg.get<string>('TWILIO_WHATSAPP_FROM'));
    // permitimos override explícito para pruebas
    this.toOverride = this.sanitizeWhatsAppAddr(this.cfg.get<string>('TWILIO_WHATSAPP_TO_OVERRIDE'));

    // === Instancia Twilio si hay credenciales ===
    try {
      // require dinámico para evitar problemas en compilación si faltan creds en build
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio: typeof Twilio = require('twilio');
      this.twilioClient = sid && token ? twilio(sid, token) : null;
    } catch {
      this.twilioClient = null;
    }

    // === Log de arranque para diagnóstico ===
    const mask = (s?: string | null) => (s ? s.replace(/(.{6}).+/, '$1…') : s);
    this.logger.log(
      `WA flags -> featureOn=${this.featureOn} sendOn=${this.sendOn} ` +
      `useTemplates=${this.useTemplates} sendStatus=${this.sendStatusUpdates} ` +
      `from=${JSON.stringify(this.from)} override=${JSON.stringify(this.toOverride)} ` +
      `sid=${mask(sid)} token=${mask(token)}`
    );

    if (!this.twilioClient) {
      this.logger.warn('Twilio client no inicializado (SID/TOKEN faltantes o require falló).');
    }
    if (!this.from) {
      this.logger.warn('TWILIO_WHATSAPP_FROM vacío o inválido. Debe ser "whatsapp:+14155238886" en sandbox.');
    }
  }

  // ================= Utilidades =================

  private bool(v: any): boolean {
    if (typeof v === 'boolean') return v;
    return String(v ?? '').trim().toLowerCase() === 'true';
  }

  /** Convierte a E.164; acepta '+57...', '57...', '03...' o '3...' */
  private toE164CO(phoneRaw?: string | null): string | null {
    const only = String(phoneRaw ?? '').trim();
    if (!only) return null;
    if (/^\+\d{6,15}$/.test(only)) return only; // ya E.164

    const digits = only.replace(/\D/g, '');
    if (!digits) return null;

    const withCountry = digits.startsWith('57') ? digits : `57${digits.replace(/^0+/, '')}`;
    const e164 = `+${withCountry}`;
    return /^\+\d{6,15}$/.test(e164) ? e164 : null;
  }

  /** Normaliza a 'whatsapp:+<E164>' y elimina comentarios inline/espacios del .env */
  private sanitizeWhatsAppAddr(raw?: string | null): string | null {
    if (!raw) return null;
    const cut = String(raw).split('#')[0].trim(); // corta comentarios inline
    if (!cut) return null;

    const lower = cut.toLowerCase();
    if (lower.startsWith('whatsapp:')) {
      const num = cut.slice('whatsapp:'.length).trim();
      const e164 = this.toE164CO(num);
      return e164 ? `whatsapp:${e164}` : null;
    }

    const e164 = this.toE164CO(cut);
    return e164 ? `whatsapp:${e164}` : null;
  }

  /** Aplica override si existe y devuelve 'whatsapp:+57...' */
  private resolveWhatsAppTo(phoneRaw?: string | null): string | null {
    const candidate = this.toOverride ?? (phoneRaw ? `whatsapp:${this.toE164CO(phoneRaw)}` : null);
    return this.sanitizeWhatsAppAddr(candidate);
  }

  /** Formatea $COP */
  private cop(n: number) {
    return `$${Math.round(n).toLocaleString('es-CO')}`;
  }

  // ================= Persistencia de logs =================

  private async log(
    orderId: number,
    type: string,
    to: string,
    ok: boolean,
    sid?: string,
    error?: string,
  ) {
    try {
      await this.prisma.notificationLog.create({
        data: { orderId, type, to, ok, sid, error },
      });
    } catch (e: any) {
      this.logger.error(`No se pudo registrar NotificationLog: ${e?.message ?? e}`);
    }
  }

  private async logOnce(
    orderId: number,
    type: string,
    to: string,
    sid?: string | null,
    error?: string | null,
  ) {
    try {
      await this.prisma.notificationLog.upsert({
        where: { orderId_type: { orderId, type } },
        create: { orderId, type, to, ok: !!sid, sid: sid ?? undefined, error: sid ? null : error ?? 'SEND_FAILED' },
        update: {}, // idempotente
      });
    } catch (e: any) {
      this.logger.error(`No se pudo upsert NotificationLog: ${e?.message ?? e}`);
    }
  }

  // ================= API PÚBLICA =================

  /**
   * Enviar texto libre por WhatsApp (sandbox/prod).
   * Respeta flags y valida configuración Twilio.
   */
  async sendMessage(toPhone: string, body: string): Promise<void> {
    if (!this.featureOn || !this.sendOn) {
      this.logger.debug(`[WA OFF] -> ${toPhone}: ${body}`);
      return;
    }
    if (!this.twilioClient || !this.from) {
      this.logger.warn(`Twilio no configurado correctamente. Mensaje NO enviado: ${body}`);
      return;
    }

    const to = this.resolveWhatsAppTo(toPhone);
    if (!to) {
      this.logger.warn(`Teléfono inválido para WhatsApp: "${toPhone}"`);
      return;
    }

    try {
      const res = await this.twilioClient.messages.create({ from: this.from, to, body });
      this.logger.log(`WhatsApp enviado OK sid=${res.sid} to=${to}`);
    } catch (err: any) {
      this.logger.error(`WhatsApp error to=${to}: ${err?.message || String(err)}`);
    }
  }

  /** Envío simple de OTP */
  async sendOtp(toPhone: string, code: string): Promise<void> {
    const text = `Tu código de verificación Expolicores es: *${code}*. Expira en 10 min.`;
    await this.sendMessage(toPhone, text);
  }

  /** Confirmación de pedido (texto o plantilla si está habilitada) */
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
    if (!this.featureOn) {
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'disabled');
      return { ok: false };
    }
    if (!this.twilioClient || !this.from) {
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'twilio_not_ready');
      return { ok: false };
    }

    const to = this.resolveWhatsAppTo(params.toPhone);
    if (!to) {
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'invalid_phone');
      return { ok: false };
    }

    const addressDisplay = [params.addressLabel, params.addressLine].filter(Boolean).join(' - ');

    const sendPlain = async () => {
      const header = `*${params.tenant ?? 'Expolicores'}*\nConfirmación de pedido #${params.orderId}`;
      const lineItems = params.items.slice(0, 8).map((i) => `- ${i.quantity}x ${i.name}`);
      const extra = params.items.length > 8 ? `-(+${params.items.length - 8} items)` : null;
      const itemsBlock = [...lineItems, ...(extra ? [extra] : [])].join('\n');
      const paymentLabel = params.paymentMethod === 'COD' ? 'Contraentrega' : params.paymentMethod;

      const body = [
        header,
        itemsBlock,
        '--------------',
        `Subtotal: ${this.cop(params.subtotal)}`,
        `Envío:    ${this.cop(params.shipping)}`,
        `Total:    ${this.cop(params.total)}`,
        `Pago: ${paymentLabel}`,
        `Entrega a: ${addressDisplay || 'Dirección registrada'}`,
        params.notes ? `Notas: ${params.notes}` : '',
        '',
        'Gracias por tu compra.',
        'Consulta tus pedidos en la app: Perfil -> Mis pedidos',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        const res = await this.twilioClient!.messages.create({ from: this.from!, to, body });
        await this.log(params.orderId, 'ORDER_CONFIRMATION', to, true, res.sid);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        await this.log(params.orderId, 'ORDER_CONFIRMATION', to, false, undefined, e?.message ?? String(e));
        return { ok: false };
      }
    };

    // Si usas Content API (plantillas), activa esto por .env:
    const contentSid = this.cfg.get<string>('WHATSAPP_CONFIRMATION_CONTENT_SID');
    if (this.useTemplates && contentSid) {
      const vars = {
        '1': String(params.orderId),
        '2': this.cop(params.subtotal),
        '3': this.cop(params.shipping),
        '4': this.cop(params.total),
        '5': params.paymentMethod === 'COD' ? 'Contraentrega' : params.paymentMethod,
        '6': addressDisplay || 'Dirección registrada',
      };
      try {
        const res = await this.twilioClient!.messages.create({
          from: this.from!,
          to,
          contentSid,
          contentVariables: JSON.stringify(vars),
        });
        await this.log(params.orderId, 'ORDER_CONFIRMATION', to, true, res.sid);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        this.logger.warn(`WhatsApp template confirmation failed; fallback a texto plano. ${msg}`);
        await this.log(params.orderId, 'ORDER_CONFIRMATION_TEMPLATE_FAIL', to, false, undefined, msg);
        return sendPlain();
      }
    }

    return sendPlain();
  }

  /** Cambio de estado (texto o plantilla) — idempotente por tipo */
  async sendStatusUpdate(params: {
    toPhone: string;
    orderId: number;
    newStatus: Status;
    tenant?: string;
  }) {
    if (!this.featureOn || !this.sendStatusUpdates) {
      await this.logOnce(params.orderId, 'STATUS_' + params.newStatus, params.toPhone, null, 'disabled');
      return { ok: false };
    }
    if (!this.twilioClient || !this.from) {
      await this.logOnce(params.orderId, 'STATUS_' + params.newStatus, params.toPhone, null, 'twilio_not_ready');
      return { ok: false };
    }

    const to = this.resolveWhatsAppTo(params.toPhone);
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
        const res = await this.twilioClient!.messages.create({ from: this.from!, to, body });
        await this.logOnce(params.orderId, type, to, res.sid, null);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        await this.logOnce(params.orderId, type, to, null, e?.message ?? String(e));
        return { ok: false };
      }
    };

    const statusContentSid = this.cfg.get<string>('WHATSAPP_STATUS_CONTENT_SID');
    if (this.useTemplates && statusContentSid) {
      const human =
        params.newStatus === 'EN_CAMINO' ? 'En camino' : params.newStatus === 'ENTREGADO' ? 'Entregado' : 'Cancelado';
      const vars = { '1': String(params.orderId), '2': human };

      try {
        const res = await this.twilioClient!.messages.create({
          from: this.from!,
          to,
          contentSid: statusContentSid,
          contentVariables: JSON.stringify(vars),
        });
        await this.logOnce(params.orderId, type, to, res.sid, null);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        this.logger.warn(`WhatsApp status template failed; fallback a texto plano. ${msg}`);
        await this.log(params.orderId, `${type}_TEMPLATE_FAIL`, to, false, undefined, msg);
        return sendPlain();
      }
    }

    return sendPlain();
  }
}
