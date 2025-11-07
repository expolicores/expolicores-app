"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WhatsAppService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
// backend/src/notifications/whatsapp.service.ts
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const twilio_1 = __importDefault(require("twilio"));
let WhatsAppService = WhatsAppService_1 = class WhatsAppService {
    constructor(cfg, prisma) {
        this.cfg = cfg;
        this.prisma = prisma;
        this.logger = new common_1.Logger(WhatsAppService_1.name);
        // Twilio client
        this.client = null;
        const clean = (v) => (v?.trim() ? v.trim() : undefined);
        const sid = clean(this.cfg.get('TWILIO_ACCOUNT_SID'));
        const token = clean(this.cfg.get('TWILIO_AUTH_TOKEN'));
        this.featureOn = (clean(this.cfg.get('FEATURE_WHATSAPP_NOTIFICATIONS')) ?? 'false').toLowerCase() === 'true';
        this.sendOn = (clean(this.cfg.get('SEND_WHATSAPP_NOTIFS')) ?? (this.featureOn ? 'true' : 'false')).toLowerCase() === 'true';
        this.useTemplates = (clean(this.cfg.get('WHATSAPP_USE_TEMPLATES')) ?? 'true').toLowerCase() === 'true';
        this.sendStatusUpdates = (clean(this.cfg.get('WHATSAPP_SEND_STATUS_UPDATES')) ?? 'true').toLowerCase() === 'true';
        // Enrutamiento: PRIORIDAD -> messagingServiceSid (msid) | from
        this.msid =
            clean(this.cfg.get('TWILIO_MESSAGING_SERVICE_SID_WA')) ||
                clean(this.cfg.get('TWILIO_MS_SID_WA')) || // alias usado por ti
                clean(this.cfg.get('TWILIO_MESSAGING_SERVICE_SID')) || // fallback genérico
                undefined;
        this.fromProd = this.sanitizeWhatsAppAddr(clean(this.cfg.get('TWILIO_WHATSAPP_FROM_PROD')));
        // Override (solo dev)
        this.toOverride = this.sanitizeWhatsAppAddr(clean(this.cfg.get('TWILIO_WHATSAPP_TO_OVERRIDE')));
        // Instancia Twilio (solo si hay credenciales)
        try {
            this.client = sid && token ? (0, twilio_1.default)(sid, token) : null;
        }
        catch {
            this.client = null;
        }
        const mask = (s) => (s ? s.replace(/(.{6}).+/, '$1…') : s);
        this.logger.log([
            `WA flags: feature=${this.featureOn} send=${this.sendOn} tmpl=${this.useTemplates} statusUpd=${this.sendStatusUpdates}`,
            `msid=${mask(this.msid)} from=${this.fromProd ?? null} override=${this.toOverride ?? null}`,
            `sid=${mask(sid)} token=${mask(token)}`,
        ].join(' | '));
        if (!this.client)
            this.logger.warn('Twilio client NO inicializado (SID/TOKEN faltantes).');
        if (!this.msid && !this.fromProd)
            this.logger.warn('Config WA incompleta: falta TWILIO_MS_SID_WA/TWILIO_MESSAGING_SERVICE_SID_WA (o genérico) y/o TWILIO_WHATSAPP_FROM_PROD.');
    }
    // ========================== Utils ==========================
    bool(v) {
        if (typeof v === 'boolean')
            return v;
        return String(v ?? '').trim().toLowerCase() === 'true';
    }
    /** Convierte a E.164; acepta '+57...', '57...', '03...' o '3...'. */
    toE164CO(phoneRaw) {
        const only = String(phoneRaw ?? '').trim();
        if (!only)
            return null;
        if (/^\+\d{6,15}$/.test(only))
            return only;
        const digits = only.replace(/\D/g, '');
        if (!digits)
            return null;
        const withCountry = digits.startsWith('57') ? digits : `57${digits.replace(/^0+/, '')}`;
        const e164 = `+${withCountry}`;
        return /^\+\d{6,15}$/.test(e164) ? e164 : null;
    }
    /** Normaliza a 'whatsapp:+<E164>' y limpia comentarios inline. */
    sanitizeWhatsAppAddr(raw) {
        if (!raw)
            return undefined;
        const cut = String(raw).split('#')[0].trim();
        if (!cut)
            return undefined;
        const lower = cut.toLowerCase();
        if (lower.startsWith('whatsapp:')) {
            const num = cut.slice('whatsapp:'.length).trim();
            const e164 = this.toE164CO(num);
            return e164 ? `whatsapp:${e164}` : undefined;
        }
        const e164 = this.toE164CO(cut);
        return e164 ? `whatsapp:${e164}` : undefined;
    }
    /** Aplica override dev si existe y devuelve 'whatsapp:+57...'. */
    resolveWhatsAppTo(phoneRaw) {
        if (this.toOverride)
            return this.toOverride;
        const e164 = this.toE164CO(phoneRaw);
        return e164 ? `whatsapp:${e164}` : undefined;
    }
    /** $COP amigable. */
    cop(n) {
        return `$${Math.round(n).toLocaleString('es-CO')}`;
    }
    /** Extrae código Twilio si existe. */
    errorCode(err) {
        const c = err?.code ?? err?.moreInfo ?? err?.status;
        return c != null ? String(c) : undefined;
    }
    /** Base params: usa MSID o FROM. */
    baseParams() {
        if (this.msid)
            return { messagingServiceSid: this.msid };
        if (this.fromProd)
            return { from: this.fromProd };
        return {};
    }
    /** Manejo unificado de error 63051 (WABA restringida). */
    handleWaError(context, err) {
        const code = this.errorCode(err);
        const msg = err?.message ?? String(err);
        if (code === '63051') {
            this.logger.warn(`[${context}] WABA_RESTRICTED (63051): ${msg}`);
            const e = new Error('WABA_RESTRICTED');
            // @ts-ignore
            e.code = 63051;
            throw e;
        }
        throw err;
    }
    // ========================== Persistencia de logs ==========================
    async log(orderId, type, to, ok, sid, error) {
        try {
            await this.prisma.notificationLog.create({
                data: { orderId, type, to, ok, sid, error },
            });
        }
        catch (e) {
            this.logger.error(`No se pudo registrar NotificationLog: ${e?.message ?? e}`);
        }
    }
    async logOnce(orderId, type, to, sid, error) {
        try {
            await this.prisma.notificationLog.upsert({
                where: { orderId_type: { orderId, type } },
                create: { orderId, type, to, ok: !!sid, sid: sid ?? undefined, error: sid ? null : error ?? 'SEND_FAILED' },
                update: {}, // idempotente
            });
        }
        catch (e) {
            this.logger.error(`No se pudo upsert NotificationLog: ${e?.message ?? e}`);
        }
    }
    // ========================== API pública ==========================
    /** Texto libre por WhatsApp. */
    async sendMessage(toPhone, body) {
        if (!this.featureOn || !this.sendOn) {
            this.logger.debug(`[WA OFF] -> ${toPhone}: ${body}`);
            return;
        }
        if (!this.client) {
            this.logger.warn(`Twilio no configurado. Mensaje NO enviado: ${body}`);
            return;
        }
        const to = this.resolveWhatsAppTo(toPhone);
        if (!to) {
            this.logger.warn(`Teléfono inválido para WhatsApp: "${toPhone}"`);
            return;
        }
        try {
            const res = await this.client.messages.create({ ...this.baseParams(), to, body });
            this.logger.log(`WhatsApp enviado OK sid=${res.sid} to=${to}`);
        }
        catch (err) {
            try {
                this.handleWaError('sendMessage', err);
            }
            catch (e) {
                this.logger.error(`WhatsApp error to=${to}: ${err?.message || String(err)}`);
                throw e;
            }
        }
    }
    /** Envío OTP (plantilla → fallback a texto). */
    async sendOtp(toPhone, code, ttlMin = 10) {
        if (!this.featureOn || !this.sendOn) {
            this.logger.debug(`[WA OFF][OTP] -> ${toPhone}: ${code}`);
            return;
        }
        if (!this.client) {
            this.logger.warn('Twilio no configurado (OTP).');
            return;
        }
        const to = this.resolveWhatsAppTo(toPhone);
        if (!to) {
            this.logger.warn(`Teléfono inválido para WhatsApp (OTP): "${toPhone}"`);
            return;
        }
        // Content SID para OTP
        const contentSid = (this.cfg.get('WHATSAPP_OTP_CONTENT_SID') || this.cfg.get('TWILIO_HX_SID_WA'))?.trim();
        // 1) Plantilla (si está habilitada y hay ContentSid)
        if (this.useTemplates && contentSid) {
            try {
                const res = await this.client.messages.create({
                    ...this.baseParams(),
                    to,
                    contentSid,
                    // Soporta {{1}},{{2}} y {{code}},{{expiration_minutes}}
                    contentVariables: JSON.stringify({
                        '1': code,
                        '2': String(ttlMin),
                        code,
                        expiration_minutes: String(ttlMin),
                    }),
                });
                this.logger.log(`OTP WA template sent: ${res.sid}`);
                return;
            }
            catch (err) {
                try {
                    this.handleWaError('sendOtp/template', err);
                }
                catch (e) {
                    if (e?.code === 63051)
                        throw e; // no continúes si WABA restringida
                    this.logger.warn(`OTP WA template failed; fallback a texto. ${err?.message ?? err}`);
                }
            }
        }
        // 2) Texto simple
        const text = `Tu código es *${code}*. Vence en ${ttlMin} minutos. No lo compartas.`;
        try {
            const res = await this.client.messages.create({ ...this.baseParams(), to, body: text });
            this.logger.log(`OTP WA text sent: ${res.sid}`);
        }
        catch (err) {
            this.handleWaError('sendOtp/text', err);
        }
    }
    /** Confirmación de pedido (plantilla → texto). */
    async sendOrderConfirmation(params) {
        if (!this.featureOn) {
            await this.log(params.orderId, 'ORDER_CONFIRMATION', params.toPhone, false, undefined, 'disabled');
            return { ok: false };
        }
        if (!this.client) {
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
                const res = await this.client.messages.create({ ...this.baseParams(), to, body });
                await this.log(params.orderId, 'ORDER_CONFIRMATION', to, true, res.sid);
                return { ok: true, sid: res.sid };
            }
            catch (err) {
                try {
                    this.handleWaError('order/plain', err);
                }
                catch (e) {
                    await this.log(params.orderId, 'ORDER_CONFIRMATION', to, false, undefined, err?.message ?? String(err));
                    return { ok: false };
                }
            }
        };
        const contentSid = (this.cfg.get('WHATSAPP_CONFIRMATION_CONTENT_SID') ?? '').trim();
        if (this.useTemplates && contentSid) {
            // Plantilla sugerida: {{1}} id, {{2}} total, {{3}} pago, {{4}} dirección
            const vars = {
                '1': String(params.orderId),
                '2': this.cop(params.total),
                '3': paymentLabel,
                '4': addressDisplay || 'Dirección registrada',
                total: this.cop(params.total),
                payment: paymentLabel,
                address: addressDisplay || 'Dirección registrada',
            };
            try {
                const res = await this.client.messages.create({
                    ...this.baseParams(),
                    to,
                    contentSid,
                    contentVariables: JSON.stringify(vars),
                });
                await this.log(params.orderId, 'ORDER_CONFIRMATION', to, true, res.sid);
                return { ok: true, sid: res.sid };
            }
            catch (err) {
                try {
                    this.handleWaError('order/template', err);
                }
                catch (e) {
                    if (e?.code === 63051) {
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
    /** Cambio de estado (plantilla → texto) — idempotente por tipo. */
    async sendStatusUpdate(params) {
        if (!this.featureOn || !this.sendStatusUpdates) {
            await this.logOnce(params.orderId, 'STATUS_' + params.newStatus, params.toPhone, null, 'disabled');
            return { ok: false };
        }
        if (!this.client) {
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
            return { ok: !!existing.ok, sid: existing.sid ?? undefined, skipped: true };
        }
        const sendPlain = async () => {
            const human = params.newStatus === 'EN_CAMINO' ? 'En camino' :
                params.newStatus === 'ENTREGADO' ? 'Entregado' : 'Cancelado';
            const body = `*${params.tenant ?? 'Atención al cliente'}* - Pedido #${params.orderId}
Estado: *${human}*.
Gracias por comprar con nosotros.`;
            try {
                const res = await this.client.messages.create({ ...this.baseParams(), to, body });
                await this.logOnce(params.orderId, type, to, res.sid, null);
                return { ok: true, sid: res.sid };
            }
            catch (err) {
                try {
                    this.handleWaError('status/plain', err);
                }
                catch (e) {
                    await this.logOnce(params.orderId, type, to, null, err?.message ?? String(err));
                    return { ok: false };
                }
            }
        };
        const statusContentSid = (this.cfg.get('WHATSAPP_STATUS_CONTENT_SID') ?? '').trim();
        if (this.useTemplates && statusContentSid) {
            const human = params.newStatus === 'EN_CAMINO' ? 'en camino' :
                params.newStatus === 'ENTREGADO' ? 'entregado' : 'cancelado';
            const vars = { '1': String(params.orderId), '2': human };
            try {
                const res = await this.client.messages.create({
                    ...this.baseParams(),
                    to,
                    contentSid: statusContentSid,
                    contentVariables: JSON.stringify(vars),
                });
                await this.logOnce(params.orderId, type, to, res.sid, null);
                return { ok: true, sid: res.sid };
            }
            catch (err) {
                try {
                    this.handleWaError('status/template', err);
                }
                catch (e) {
                    if (e?.code === 63051) {
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
};
exports.WhatsAppService = WhatsAppService;
exports.WhatsAppService = WhatsAppService = WhatsAppService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], WhatsAppService);
//# sourceMappingURL=whatsapp.service.js.map