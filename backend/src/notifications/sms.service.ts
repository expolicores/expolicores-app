// sms.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Twilio from 'twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: Twilio.Twilio | null;
  private featureSms = false;
  private msidSms?: string;      // Messaging Service para SMS
  private from?: string;         // opcional: número SMS directo

  constructor(cfg: ConfigService) {
    const sid   = cfg.get<string>('TWILIO_ACCOUNT_SID');
    const token = cfg.get<string>('TWILIO_AUTH_TOKEN');

    this.featureSms = (cfg.get<string>('FEATURE_SMS_OTP') ?? 'false') === 'true';
    // Mantengo tu nombre de variable actual para no romper nada:
    this.msidSms = cfg.get<string>('TWILIO_MESSAGING_SERVICE_SID_SMS') || undefined;
    this.from    = cfg.get<string>('TWILIO_SMS_FROM') || undefined;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio: typeof Twilio = require('twilio');
      this.client = sid && token ? twilio(sid, token) : null;
    } catch {
      this.client = null;
    }
  }

  async sendOtp(toE164: string, code: string, ttlMin = 10) {
    if (!this.featureSms) throw new Error('SMS feature disabled');
    if (!this.client) throw new Error('Twilio client not configured');

    const body = `Tu código es ${code}. Vence en ${ttlMin} minutos. No lo compartas.`;

    const params: Record<string, string> = { to: toE164, body };
    if (this.msidSms) params.messagingServiceSid = this.msidSms;
    else if (this.from) params.from = this.from;
    else throw new Error('No SMS sender configured (TWILIO_MESSAGING_SERVICE_SID_SMS o TWILIO_SMS_FROM)');

    const res = await (this.client as any).messages.create(params);
    this.logger.log(`SMS OTP sent sid=${res.sid} to=${toE164}`);
    return res.sid;
  }
}
