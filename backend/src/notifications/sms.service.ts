import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Twilio from 'twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: Twilio.Twilio | null;
  private from?: string;
  private featureSms: boolean;

  constructor(private readonly cfg: ConfigService) {
    const sid = cfg.get<string>('TWILIO_ACCOUNT_SID');
    const token = cfg.get<string>('TWILIO_AUTH_TOKEN');
    this.featureSms = (cfg.get<string>('FEATURE_SMS_OTP') ?? 'false') === 'true';
    this.from = cfg.get<string>('TWILIO_SMS_FROM') || undefined;

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
    if (!this.client || !this.from) throw new Error('Twilio SMS not configured');

    const body = `Tu código de Expolicores es ${code}. Vence en ${ttlMin} minutos. No lo compartas.`;
    const res = await this.client.messages.create({
      from: this.from!,
      to: toE164, // SMS usa E.164 (sin prefijo 'whatsapp:')
      body,
    });
    this.logger.log(`SMS OTP sent sid=${res.sid} to=${toE164}`);
    return res.sid;
  }
}
