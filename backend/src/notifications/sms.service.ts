// backend/src/notifications/sms.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio as TwilioClient } from 'twilio';

/**
 * Servicio de SMS (Twilio) para OTP y textos simples.
 * - NO hace fallback a WhatsApp.
 * - Acepta TWILIO_MESSAGING_SERVICE_SID_SMS o TWILIO_MS_SID_SMS.
 * - Recorta espacios en blanco en variables (evita el clásico "SID inválido" por trailing spaces).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: TwilioClient | null = null;

  private featureSms = false;

  // Remitentes posibles (usa UNO: messagingServiceSid o from)
  private msidSms?: string; // Messaging Service SID (recomendado)
  private from?: string;    // Número SMS directo (si no usas MS)

  constructor(private readonly cfg: ConfigService) {
    const clean = (v?: string | null) => (v?.trim() ? v.trim() : undefined);

    const sid   = clean(this.cfg.get<string>('TWILIO_ACCOUNT_SID'));
    const token = clean(this.cfg.get<string>('TWILIO_AUTH_TOKEN'));

    this.featureSms =
      clean(this.cfg.get<string>('FEATURE_SMS_OTP'))?.toLowerCase() === 'true';

    // Acepta ambos nombres por compatibilidad
    this.msidSms =
      clean(this.cfg.get<string>('TWILIO_MESSAGING_SERVICE_SID_SMS')) ||
      clean(this.cfg.get<string>('TWILIO_MS_SID_SMS'));

    this.from = clean(this.cfg.get<string>('TWILIO_SMS_FROM'));

    try {
      this.client = sid && token ? twilio(sid, token) : null;
    } catch {
      this.client = null;
    }
  }

  /**
   * Envía un OTP por SMS con cuerpo plano (sin ContentSid).
   */
  async sendOtp(toE164: string, code: string, ttlMin = 10): Promise<string> {
    this.ensureReady(toE164);

    const body = `Tu código Expolicores es ${code}. Expira en ${ttlMin} min. No lo compartas.`;
    const payload = this.buildPayload(toE164, body);

    try {
      const res = await this.client!.messages.create(payload);
      this.logger.log(`OTP SMS sent: sid=${res?.sid} to=${toE164}`);
      return res?.sid as string;
    } catch (err: any) {
      this.logTwilioError('OTP', toE164, err);
      throw new BadRequestException('SMS_DELIVERY_FAILED');
    }
  }

  /**
   * Envía un texto plano por SMS.
   */
  async sendText(toE164: string, text: string): Promise<string> {
    this.ensureReady(toE164);

    const payload = this.buildPayload(toE164, text);

    try {
      const res = await this.client!.messages.create(payload);
      this.logger.log(`SMS sent: sid=${res?.sid} to=${toE164}`);
      return res?.sid as string;
    } catch (err: any) {
      this.logTwilioError('TEXT', toE164, err);
      throw new BadRequestException('SMS_DELIVERY_FAILED');
    }
  }

  // ===================== Helpers =====================

  /** Valida flags, cliente y formato del destino. */
  private ensureReady(toE164: string) {
    if (!this.featureSms) {
      throw new BadRequestException('SMS feature disabled (FEATURE_SMS_OTP=false)');
    }
    if (!this.client) {
      throw new BadRequestException(
        'Twilio client not configured (check TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)',
      );
    }
    if (!this.msidSms && !this.from) {
      throw new BadRequestException(
        'No SMS sender configured. Set TWILIO_MS_SID_SMS/TWILIO_MESSAGING_SERVICE_SID_SMS or TWILIO_SMS_FROM',
      );
    }
    // E.164: +<country><nsn>
    if (!/^\+\d{7,15}$/.test(toE164)) {
      throw new BadRequestException('Invalid E.164 phone format for SMS');
    }
  }

  /** Construye el payload para Twilio evitando “whatsapp:” y respetando MSID/from. */
  private buildPayload(to: string, body: string): {
    to: string;
    body: string;
    messagingServiceSid?: string;
    from?: string;
  } {
    const payload: {
      to: string;
      body: string;
      messagingServiceSid?: string;
      from?: string;
    } = { to, body };

    if (this.msidSms) payload.messagingServiceSid = this.msidSms;
    else payload.from = this.from!;

    return payload;
  }

  /** Log detallado de errores Twilio para diagnóstico. */
  private logTwilioError(kind: 'OTP' | 'TEXT', to: string, err: any) {
    const code = err?.code ?? err?.status ?? 'NA';
    const msg =
      typeof err?.message === 'string'
        ? err.message
        : 'Twilio SMS send failed';
    const more = err?.moreInfo ? ` moreInfo=${err.moreInfo}` : '';
    const sid = err?.twilioError?.code ? ` twilioCode=${err.twilioError.code}` : '';
    this.logger.error(`[Twilio][${kind}] to=${to} code=${code}${sid} msg=${msg}${more}`);
  }
}
