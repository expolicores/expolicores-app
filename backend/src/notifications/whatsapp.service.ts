// src/notifications/whatsapp.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import whatsappConfig from '../config/whatsapp';
import { PrismaService } from '../prisma/prisma.service';

type ItemRow = { name: string; quantity: number; price: number };

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

  private cop(n: number) {
    return `$${Math.round(n).toLocaleString('es-CO')}`;
  }

  private async log(orderId: number, type: string, to: string, ok: boolean, sid?: string, error?: string) {
    try {
      await this.prisma.notificationLog.create({ data: { orderId, type, to, ok, sid, error } });
    } catch (e: any) {
      this.logger.error(`No se pudo registrar NotificationLog: ${e?.message ?? e}`);
    }
  }

  // === CONFIRMACIÓN PEDIDO ===
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
    if (!this.cfg.enabled) { await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'disabled'); return { ok:false }; }
    if (!this.client || !this.cfg.from) { await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'twilio_not_ready'); return { ok:false }; }

    // === RUTA PRODUCCIÓN (plantillas a través de Content SID) ===
    if (this.cfg.useTemplates && this.cfg.confirmationContentSid) {
      // Mapea variables de la plantilla (orden: {{1}}, {{2}}, …) tal como la definiste en Twilio Content
      const vars = {
        "1": String(params.orderId),
        "2": this.cop(params.subtotal),
        "3": this.cop(params.shipping),
        "4": this.cop(params.total),
        "5": params.paymentMethod === 'COD' ? 'Contraentrega' : params.paymentMethod,
        "6": `${params.addressLabel ?? ''} — ${params.addressLine ?? ''}`.trim(),
      };

      try {
        const res = await this.client.messages.create({
          from: this.cfg.from,
          to: `whatsapp:${params.toPhone}`,
          contentSid: this.cfg.confirmationContentSid,
          contentVariables: JSON.stringify(vars),
        });
        await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, true, res.sid);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, e?.message ?? String(e));
        return { ok: false };
      }
    }

    // === RUTA SANDBOX (cuerpo libre) ===
    const head = `*${params.tenant ?? 'Expolicores'}* ✅\nConfirmación de pedido #${params.orderId}`;
    const lines = params.items.slice(0, 8).map(i => `• ${i.quantity}× ${i.name}`);
    const more = params.items.length > 8 ? `…(+${params.items.length - 8} ítems)` : '';
    const addr = [params.addressLabel, params.addressLine].filter(Boolean).join(' — ');
    const obs  = params.notes ? `\n📝 Notas: ${params.notes}` : '';
    const body =
`${head}
${lines.join('\n')} ${more}
————————————
Subtotal: ${this.cop(params.subtotal)}
Envío:    ${this.cop(params.shipping)}
Total:    ${this.cop(params.total)}
Pago: ${params.paymentMethod === 'COD' ? 'Contraentrega' : params.paymentMethod}
Entrega a: ${addr || 'Dirección por defecto'}${obs}

¡Gracias por tu compra! 🥂
Consulta tus pedidos en la app: *Perfil → Mis pedidos*`;

    try {
      const res = await this.client.messages.create({
        from: this.cfg.from,
        to: `whatsapp:${params.toPhone}`,
        body,
      });
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, true, res.sid);
      return { ok: true, sid: res.sid };
    } catch (e: any) {
      await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, e?.message ?? String(e));
      return { ok: false };
    }
  }

  // === CAMBIO DE ESTADO ===
  async sendStatusUpdate(params: { toPhone: string; orderId: number; newStatus: 'EN_CAMINO'|'ENTREGADO'|'CANCELADO'; tenant?: string; }) {
    if (!this.cfg.enabled || !this.cfg.sendStatusUpdates) {
      await this.log(params.orderId, 'STATUS_UPDATE', params.toPhone, false, undefined, 'disabled');
      return { ok: false };
    }
    if (!this.client || !this.cfg.from) {
      await this.log(params.orderId, 'STATUS_UPDATE', params.toPhone, false, undefined, 'twilio_not_ready');
      return { ok: false };
    }

    // Producción con plantilla (si config disponible)
    if (this.cfg.useTemplates && this.cfg.statusContentSid) {
      const human =
        params.newStatus === 'EN_CAMINO' ? 'En camino' :
        params.newStatus === 'ENTREGADO' ? 'Entregado' : 'Cancelado';
      const vars = { "1": String(params.orderId), "2": human };

      try {
        const res = await this.client.messages.create({
          from: this.cfg.from,
          to: `whatsapp:${params.toPhone}`,
          contentSid: this.cfg.statusContentSid,
          contentVariables: JSON.stringify(vars),
        });
        await this.log(params.orderId, 'STATUS_UPDATE', params.toPhone, true, res.sid);
        return { ok: true, sid: res.sid };
      } catch (e: any) {
        await this.log(params.orderId, 'STATUS_UPDATE', params.toPhone, false, undefined, e?.message ?? String(e));
        return { ok: false };
      }
    }

    // Sandbox: texto libre
    const statusText =
      params.newStatus === 'EN_CAMINO' ? '🚚 Tu pedido va en camino.' :
      params.newStatus === 'ENTREGADO' ? '✅ Tu pedido fue entregado.' :
      '❌ Tu pedido fue cancelado.';
    const body =
`*${params.tenant ?? 'Expolicores'}* – Pedido #${params.orderId}
${statusText}
Gracias por comprar con nosotros.`;

    try {
      const res = await this.client.messages.create({
        from: this.cfg.from,
        to: `whatsapp:${params.toPhone}`,
        body,
      });
      await this.log(params.orderId, 'STATUS_UPDATE', params.toPhone, true, res.sid);
      return { ok: true, sid: res.sid };
    } catch (e: any) {
      await this.log(params.orderId, 'STATUS_UPDATE', params.toPhone, false, undefined, e?.message ?? String(e));
      return { ok: false };
    }
  }
}
