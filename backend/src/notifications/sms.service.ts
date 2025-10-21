// src/notifications/sms.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Twilio from 'twilio';

/**
 * Envío de OTP por SMS (Body plano), sin ContentSid y SIN fallback a WhatsApp.
 * Lee indistintamente TWILIO_MESSAGING_SERVICE_SID_SMS o TWILIO_MS_SID_SMS.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: Twilio.Twilio | null = null;

  private featureSms = false;

  // Sender para SMS (usar uno)
  private msidSms?: string;  // Messaging Service SID
  private from?: string;     // Número SMS directo

  constructor(private readonly cfg: ConfigService) {
    const sid   = cfg.get<string>('TWILIO_ACCOUNT_SID');
    const token = cfg.get<string>('TWILIO_AUTH_TOKEN');

    this.featureSms = (cfg.get<string>('FEATURE_SMS_OTP') ?? 'false').toLowerCase() === 'true';

    // 👇 Acepta ambos nombres de variable para evitar errores de .env
    this.msidSms =
      cfg.get<string>('TWILIO_MESSAGING_SERVICE_SID_SMS') ||
      cfg.get<string>('TWILIO_MS_SID_SMS') || // <— alias usado en tu .env
      undefined;

    this.from = cfg.get<string>('TWILIO_SMS_FROM') || undefined;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio: typeof Twilio = require('twilio');
      this.client = sid && token ? twilio(sid, token) : null;
    } catch {
      this.client = null;
    }
  }

  /**
   * Envía un OTP por SMS con cuerpo plano (sin ContentSid).
   */
  async sendOtp(toE164: string, code: string, ttlMin = 10): Promise<string> {
    if (!this.featureSms) {
      throw new BadRequestException('SMS feature disabled (FEATURE_SMS_OTP=false)');
    }
    if (!this.client) {
      throw new BadRequestException('Twilio client not configured (check TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)');
    }
    if (!this.msidSms && !this.from) {
      throw new BadRequestException(
        'No SMS sender configured. Configure TWILIO_MS_SID_SMS/TWILIO_MESSAGING_SERVICE_SID_SMS or TWILIO_SMS_FROM',
      );
    }
    if (!/^\+\d{7,15}$/.test(toE164)) {
      throw new BadRequestException('Invalid E.164 phone format for SMS');
    }

    const body = `Tu código Expolicores es ${code}. Expira en ${ttlMin} min. No lo compartas.`;

    const payload: {
      to: string;
      body: string;
      messagingServiceSid?: string;
      from?: string;
    } = {
      to: toE164, // **sin** prefijo "whatsapp:"
      body,
    };

    if (this.msidSms) payload.messagingServiceSid = this.msidSms;
    else payload.from = this.from!;

    try {
      const res = await (this.client as any).messages.create(payload);
      this.logger.log(`OTP SMS sent: sid=${res?.sid} to=${toE164}`);
      return res?.sid as string;
    } catch (err: any) {
      const code = err?.code ?? err?.status;
      const twMsg = typeof err?.message === 'string' ? err.message : 'Twilio SMS send failed';

      this.logger.error(`SMS OTP error to=${toE164} code=${code ?? 'NA'} msg=${twMsg}`);
      throw new BadRequestException('SMS_DELIVERY_FAILED');
    }
  }

  async sendText(toE164: string, text: string): Promise<string> {
    if (!this.featureSms) throw new BadRequestException('SMS feature disabled');
    if (!this.client) throw new BadRequestException('Twilio client not configured');
    if (!this.msidSms && !this.from) {
      throw new BadRequestException(
        'No SMS sender configured. Configure TWILIO_MS_SID_SMS/TWILIO_MESSAGING_SERVICE_SID_SMS or TWILIO_SMS_FROM',
      );
    }
    if (!/^\+\d{7,15}$/.test(toE164)) {
      throw new BadRequestException('Invalid E.164 phone format for SMS');
    }

    const payload: { to: string; body: string; messagingServiceSid?: string; from?: string } = {
      to: toE164,
      body: text,
    };

    if (this.msidSms) payload.messagingServiceSid = this.msidSms;
    else payload.from = this.from!;

    try {
      const res = await (this.client as any).messages.create(payload);
      this.logger.log(`SMS sent: sid=${res?.sid} to=${toE164}`);
      return res?.sid as string;
    } catch (err: any) {
      const code = err?.code ?? err?.status;
      this.logger.error(`SMS send error to=${toE164} code=${code ?? 'NA'} msg=${err?.message ?? 'unknown'}`);
      throw new BadRequestException('SMS_DELIVERY_FAILED');
    }
  }
}
