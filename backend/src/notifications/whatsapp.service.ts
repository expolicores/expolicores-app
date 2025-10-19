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

  // Flags (.env)
  private readonly featureOn: boolean;
  private readonly sendOn: boolean; // compat: usa FEATURE si falta
  private readonly useTemplates: boolean;
  private readonly sendStatusUpdates: boolean;

  // Orígenes / destino
  private readonly fromProd: string | null;     // whatsapp:+57...
  private readonly msid: string | null;         // MG...
  private readonly toOverride: string | null;   // whatsapp:+57... (solo dev)

  constructor(
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const sid   = this.cfg.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.cfg.get<string>('TWILIO_AUTH_TOKEN');

    this.featureOn         = this.bool(this.cfg.get('FEATURE_WHATSAPP_NOTIFICATIONS'));
    this.sendOn            = this.bool(this.cfg.get('SEND_WHATSAPP_NOTIFS')) || this.featureOn;
    this.useTemplates      = this.bool(this.cfg.get('WHATSAPP_USE_TEMPLATES'));
    this.sendStatusUpdates = this.bool(this.cfg.get('WHATSAPP_SEND_STATUS_UPDATES'));

    this.fromProd   = this.sanitizeWhatsAppAddr(this.cfg.get<string>('TWILIO_WHATSAPP_FROM_PROD'));

    // Preferimos MSID específico de WA; compat: caer al genérico si existe
    const msWa = this.cfg.get<string>('TWILIO_MESSAGING_SERVICE_SID_WA');
    const msAny = this.cfg.get<string>('TWILIO_MESSAGING_SERVICE_SID');
    this.msid       = (msWa || msAny) ?? null;

    this.toOverride = this.sanitizeWhatsAppAddr(this.cfg.get<string>('TWILIO_WHATSAPP_TO_OVERRIDE'));

    // Instancia Twilio
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio: typeof Twilio = require('twilio');
      this.twilioClient = sid && token ? twilio(sid, token) : null;
    } catch {
      this.twilioClient = null;
    }

    const mask = (s?: string | null) => (s ? s.replace(/(.{6}).+/, '$1…') : s);
    this.logger.log(
      `WA flags -> featureOn=${this.featureOn} sendOn=${this.sendOn} templates=${this.useTemplates} statusUpd=${this.sendStatusUpdates} ` +
      `fromProd=${JSON.stringify(this.fromProd)} msid=${this.msid ? mask(this.msid) : null} override=${JSON.stringify(this.toOverride)} ` +
      `sid=${mask(sid)} token=${mask(token)}`
    );

    if (!this.twilioClient) this.logger.warn('Twilio client no inicializado (SID/TOKEN faltantes).');
    if (!this.msid && !this.fromProd) {
      this.logger.warn('No hay ni TWILIO_MESSAGING_SERVICE_SID_WA (o genérico) ni TWILIO_WHATSAPP_FROM_PROD configurados.');
    }
  }

  // =============== Utilidades ===============

  private bool(v: any): boolean {
    if (typeof v === 'boolean') return v;
    return String(v ?? '').trim().toLowerCase() === 'true';
  }

  /** Convierte a E.164; acepta '+57...', '57...', '03...' o '3...' */
  private toE164CO(phoneRaw?: string | null): string | null {
    const only = String(phoneRaw ?? '').trim();
    if (!only) return null;
    if (/^\+\d{6,15}$/.test(only)) return only;
    const digits = only.replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.startsWith('57') ? digits : `57${digits.replace(/^0+/, '')}`;
    const e164 = `+${withCountry}`;
    return /^\+\d{6,15}$/.test(e164) ? e164 : null;
  }

  /** Normaliza a 'whatsapp:+<E164>' y limpia comentarios inline */
  private sanitizeWhatsAppAddr(raw?: string | null): string | null {
    if (!raw) return null;
    const cut = String(raw).split('#')[0].trim();
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

  /** Aplica override dev si existe y devuelve 'whatsapp:+57...' */
  private resolveWhatsAppTo(phoneRaw?: string | null): string | null {
    const candidate = this.toOverride ?? (phoneRaw ? `whatsapp:${this.toE164CO(phoneRaw)}` : null);
    return this.sanitizeWhatsAppAddr(candidate);
  }

  /** Formatea $COP */
  private cop(n: number) {
    return `$${Math.round(n).toLocaleString('es-CO')}`;
  }

  /** Extrae código Twilio si existe */
  private errorCode(err: any): string | undefined {
    const c = err?.code ?? err?.moreInfo ?? err?.status;
    return c != null ? String(c) : undefined;
  }

  // ========== Persistencia de logs ==========

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

  // =============== Core envío ===============

  /** Construye el payload de Twilio escogiendo MSID o FROM */
  private baseParams() {
    if (this.msid) return { messagingServiceSid: this.msid } as const;
    if (this.fromProd) return { from: this.fromProd } as const;
    return {} as const;
  }

  /** Manejo unificado de error 63051 */
  private handleWaError(context: string, err: any) {
    const code = this.errorCode(err);
    const msg = err?.message ?? String(err);
    if (code === '63051') {
      // WABA bloqueada/restringida
      this.logger.warn(`[${context}] WABA_RESTRICTED (63051): ${msg}`);
      const e = new Error('WABA_RESTRICTED');
      // @ts-ignore
      (e as any).code = 63051;
      throw e;
    }
    // Otros errores, relanzo tal cual
    throw err;
  }

  // =============== API PÚBLICA ===============

  /** Enviar texto libre por WhatsApp (prod) */
  async sendMessage(toPhone: string, body: string): Promise<void> {
    if (!this.featureOn || !this.sendOn) {
      this.logger.debug(`[WA OFF] -> ${toPhone}: ${body}`);
      return;
    }
    if (!this.twilioClient) {
      this.logger.warn(`Twilio no configurado. Mensaje NO enviado: ${body}`);
      return;
    }

    const to = this.resolveWhatsAppTo(toPhone);
    if (!to) {
      this.logger.warn(`Teléfono inválido para WhatsApp: "${toPhone}"`);
      return;
    }

    try {
      const res = await this.twilioClient.messages.create({ ...this.baseParams(), to, body });
      this.logger.log(`WhatsApp enviado OK sid=${res.sid} to=${to}`);
    } catch (err: any) {
      try {
        this.handleWaError('sendMessage', err);
      } catch (e) {
        this.logger.error(`WhatsApp error to=${to}: ${err?.message || String(err)}`);
        throw e;
      }
    }
  }

  /** Envío de OTP (plantilla → texto dentro de WA) */
  async sendOtp(toPhone: string, code: string, ttlMin = 10): Promise<void> {
    if (!this.featureOn || !this.sendOn) {
      this.logger.debug(`[WA OFF][OTP] -> ${toPhone}: ${code}`);
      return;
    }
    if (!this.twilioClient) {
      this.logger.warn('Twilio no configurado (OTP).');
      return;
    }

    const to = this.resolveWhatsAppTo(toPhone);
    if (!to) {
      this.logger.warn(`Teléfono inválido para WhatsApp (OTP): "${toPhone}"`);
      return;
    }

    const contentSid = this.cfg.get<string>('WHATSAPP_OTP_CONTENT_SID');

    // 1) Intento por plantilla
    if (this.useTemplates && contentSid) {
      try {
        const res = await this.twilioClient.messages.create({
          ...this.baseParams(),
          to,
          contentSid,
          // Soportamos tanto {{1}},{{2}} como {{code}},{{expiration_minutes}}
          contentVariables: JSON.stringify({
            '1': code,
            '2': String(ttlMin),
            code,
            expiration_minutes: String(ttlMin),
          }),
        });
        this.logger.log(`OTP WA template sent: ${res.sid}`);
        return;
      } catch (err: any) {
        try {
          this.handleWaError('sendOtp/template', err);
        } catch (e) {
          // si es 63051 no seguimos con texto; propagamos
          if ((e as any)?.code === 63051) throw e;
          this.logger.warn(`OTP WA template failed; fallback a texto. ${(err?.message ?? err)}`);
        }
      }
    }

    // 2) Texto
    const text = `Tu código es *${code}*. Vence en ${ttlMin} minutos. No lo compartas.`;
    try {
      const res = await this.twilioClient.messages.create({ ...this.baseParams(), to, body: text });
      this.logger.log(`OTP WA text sent: ${res.sid}`);
    } catch (err: any) {
      this.handleWaError('sendOtp/text', err);
    }
  }

  /** Confirmación de pedido (plantilla → texto) */
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
    if (!this.twilioClient) {
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'twilio_not_ready');
      return { ok: false };
    }

    const to = this.resolveWhatsAppTo(params.toPhone);
    if (!to) {
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'invalid_phone');
      return { ok: false };
    }

    const addressDisplay = [params.addressLabel, params.addressLine].filter(Boolean).join(' - ');
    const paymentLabel = params.paymentMethod === 'COD' ? 'Contraentrega' : params.paymentMethod;

    const sendPlain = async () => {
      const header = `*${params.tenant ?? 'Atención al cliente'}*\nConfirmación de pedido #${params.orderId}`;
      const lineItems = params.items.slice(0, 8).map((i) => `- ${i.quantity}x ${i.name}`);
      const extra = params.items.length > 8 ? `-(+${params.items.length - 8} items)` : null;
      const itemsBlock = [...lineItems, ...(extra ? [extra] : [])].join('\n');

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
        'Consulta tus pedidos en la app: Perfil → Mis pedidos',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        const res = await this.twilioClient!.messages.create({ ...this.baseParams(), to, body });
        await this.log(params.orderId, 'ORDER_CONFIRMATION', to, true, res.sid);
        return { ok: true, sid: res.sid };
      } catch (err: any) {
        try {
          this.handleWaError('order/plain', err);
        } catch (e: any) {
          await this.log(params.orderId, 'ORDER_CONFIRMATION', to, false, undefined, err?.message ?? String(err));
          return { ok: false };
        }
      }
    };

    const contentSid = this.cfg.get<string>('WHATSAPP_CONFIRMATION_CONTENT_SID');
    if (this.useTemplates && contentSid) {
      // Plantilla sugerida: {{1}} id, {{2}} total, {{3}} pago, {{4}} direccion
      const vars = {
        '1': String(params.orderId),
        '2': this.cop(params.total),
        '3': paymentLabel,
        '4': addressDisplay || 'Dirección registrada',
        total: this.cop(params.total),
        payment: paymentLabel,
        address: addressDisplay || 'Dirección registrada',
      } as Record<string, string>;

      try {
        const res = await this.twilioClient!.messages.create({
          ...this.baseParams(),
          to,
          contentSid,
          contentVariables: JSON.stringify(vars),
        });
        await this.log(params.orderId, 'ORDER_CONFIRMATION', to, true, res.sid);
        return { ok: true, sid: res.sid };
      } catch (err: any) {
        try {
          this.handleWaError('order/template', err);
        } catch (e: any) {
          if ((e as any)?.code === 63051) {
            await this.log(params.orderId, 'ORDER_CONFIRMATION', to, false, undefined, 'WABA_RESTRICTED');
            throw e; // no seguimos a texto si WABA está bloqueada
          }
          this.logger.warn(`WA template confirmation failed; fallback a texto. ${err?.message ?? err}`);
          await this.log(params.orderId, 'ORDER_CONFIRMATION_TEMPLATE_FAIL', to, false, undefined, err?.message ?? String(err));
          return sendPlain();
        }
      }
    }

    return sendPlain();
  }

  /** Cambio de estado (plantilla → texto) — idempotente por tipo */
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
    if (!this.twilioClient) {
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
      const human =
        params.newStatus === 'EN_CAMINO' ? 'En camino' :
        params.newStatus === 'ENTREGADO' ? 'Entregado' : 'Cancelado';

      const body = `*${params.tenant ?? 'Atención al cliente'}* - Pedido #${params.orderId}
Estado: *${human}*.
Gracias por comprar con nosotros.`;

      try {
        const res = await this.twilioClient!.messages.create({ ...this.baseParams(), to, body });
        await this.logOnce(params.orderId, type, to, res.sid, null);
        return { ok: true, sid: res.sid };
      } catch (err: any) {
        try {
          this.handleWaError('status/plain', err);
        } catch (e: any) {
          await this.logOnce(params.orderId, type, to, null, err?.message ?? String(err));
          return { ok: false };
        }
      }
    };

    const statusContentSid = this.cfg.get<string>('WHATSAPP_STATUS_CONTENT_SID');
    if (this.useTemplates && statusContentSid) {
      const human =
        params.newStatus === 'EN_CAMINO' ? 'en camino' :
        params.newStatus === 'ENTREGADO' ? 'entregado' : 'cancelado';

      const vars = { '1': String(params.orderId), '2': human };

      try {
        const res = await this.twilioClient!.messages.create({
          ...this.baseParams(),
          to,
          contentSid: statusContentSid,
          contentVariables: JSON.stringify(vars),
        });
        await this.logOnce(params.orderId, type, to, res.sid, null);
        return { ok: true, sid: res.sid };
      } catch (err: any) {
        try {
          this.handleWaError('status/template', err);
        } catch (e: any) {
          if ((e as any)?.code === 63051) {
            await this.logOnce(params.orderId, type, to, null, 'WABA_RESTRICTED');
            throw e;
          }
          this.logger.warn(`WA status template failed; fallback a texto. ${err?.message ?? err}`);
          await this.log(params.orderId, `${type}_TEMPLATE_FAIL`, to, false, undefined, err?.message ?? String(err));
          return sendPlain();
        }
      }
    }

    return sendPlain();
  }
}
