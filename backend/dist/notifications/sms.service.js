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
var SmsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
// backend/src/notifications/sms.service.ts
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const twilio_1 = __importDefault(require("twilio"));
/**
 * Servicio de SMS (Twilio) para OTP y textos simples.
 * - NO hace fallback a WhatsApp.
 * - Acepta TWILIO_MESSAGING_SERVICE_SID_SMS o TWILIO_MS_SID_SMS.
 * - Recorta espacios en blanco en variables (evita el clásico "SID inválido" por trailing spaces).
 */
let SmsService = SmsService_1 = class SmsService {
    constructor(cfg) {
        this.cfg = cfg;
        this.logger = new common_1.Logger(SmsService_1.name);
        this.client = null;
        this.featureSms = false;
        const clean = (v) => (v?.trim() ? v.trim() : undefined);
        const sid = clean(this.cfg.get('TWILIO_ACCOUNT_SID'));
        const token = clean(this.cfg.get('TWILIO_AUTH_TOKEN'));
        this.featureSms =
            clean(this.cfg.get('FEATURE_SMS_OTP'))?.toLowerCase() === 'true';
        // Acepta ambos nombres por compatibilidad
        this.msidSms =
            clean(this.cfg.get('TWILIO_MESSAGING_SERVICE_SID_SMS')) ||
                clean(this.cfg.get('TWILIO_MS_SID_SMS'));
        this.from = clean(this.cfg.get('TWILIO_SMS_FROM'));
        try {
            this.client = sid && token ? (0, twilio_1.default)(sid, token) : null;
        }
        catch {
            this.client = null;
        }
    }
    /**
     * Envía un OTP por SMS con cuerpo plano (sin ContentSid).
     */
    async sendOtp(toE164, code, ttlMin = 10) {
        this.ensureReady(toE164);
        const body = `Tu código Expolicores es ${code}. Expira en ${ttlMin} min. No lo compartas.`;
        const payload = this.buildPayload(toE164, body);
        try {
            const res = await this.client.messages.create(payload);
            this.logger.log(`OTP SMS sent: sid=${res?.sid} to=${toE164}`);
            return res?.sid;
        }
        catch (err) {
            this.logTwilioError('OTP', toE164, err);
            throw new common_1.BadRequestException('SMS_DELIVERY_FAILED');
        }
    }
    /**
     * Envía un texto plano por SMS.
     */
    async sendText(toE164, text) {
        this.ensureReady(toE164);
        const payload = this.buildPayload(toE164, text);
        try {
            const res = await this.client.messages.create(payload);
            this.logger.log(`SMS sent: sid=${res?.sid} to=${toE164}`);
            return res?.sid;
        }
        catch (err) {
            this.logTwilioError('TEXT', toE164, err);
            throw new common_1.BadRequestException('SMS_DELIVERY_FAILED');
        }
    }
    // ===================== Helpers =====================
    /** Valida flags, cliente y formato del destino. */
    ensureReady(toE164) {
        if (!this.featureSms) {
            throw new common_1.BadRequestException('SMS feature disabled (FEATURE_SMS_OTP=false)');
        }
        if (!this.client) {
            throw new common_1.BadRequestException('Twilio client not configured (check TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)');
        }
        if (!this.msidSms && !this.from) {
            throw new common_1.BadRequestException('No SMS sender configured. Set TWILIO_MS_SID_SMS/TWILIO_MESSAGING_SERVICE_SID_SMS or TWILIO_SMS_FROM');
        }
        // E.164: +<country><nsn>
        if (!/^\+\d{7,15}$/.test(toE164)) {
            throw new common_1.BadRequestException('Invalid E.164 phone format for SMS');
        }
    }
    /** Construye el payload para Twilio evitando “whatsapp:” y respetando MSID/from. */
    buildPayload(to, body) {
        const payload = { to, body };
        if (this.msidSms)
            payload.messagingServiceSid = this.msidSms;
        else
            payload.from = this.from;
        return payload;
    }
    /** Log detallado de errores Twilio para diagnóstico. */
    logTwilioError(kind, to, err) {
        const code = err?.code ?? err?.status ?? 'NA';
        const msg = typeof err?.message === 'string'
            ? err.message
            : 'Twilio SMS send failed';
        const more = err?.moreInfo ? ` moreInfo=${err.moreInfo}` : '';
        const sid = err?.twilioError?.code ? ` twilioCode=${err.twilioError.code}` : '';
        this.logger.error(`[Twilio][${kind}] to=${to} code=${code}${sid} msg=${msg}${more}`);
    }
};
exports.SmsService = SmsService;
exports.SmsService = SmsService = SmsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SmsService);
//# sourceMappingURL=sms.service.js.map