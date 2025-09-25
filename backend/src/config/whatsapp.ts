// src/config/whatsapp.ts
import { registerAs } from '@nestjs/config';

export default registerAs('whatsapp', () => {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_NUMBER,
    SEND_WHATSAPP_NOTIFS,
    WHATSAPP_SEND_STATUS_UPDATES,
    WHATSAPP_USE_TEMPLATES,
    WHATSAPP_CONFIRMATION_CONTENT_SID,
    WHATSAPP_STATUS_CONTENT_SID,
  } = process.env;

  return {
    accountSid: TWILIO_ACCOUNT_SID ?? '',
    authToken: TWILIO_AUTH_TOKEN ?? '',
    from: TWILIO_WHATSAPP_NUMBER ?? '',
    enabled: String(SEND_WHATSAPP_NOTIFS).toLowerCase() === 'true',
    sendStatusUpdates: String(WHATSAPP_SEND_STATUS_UPDATES ?? 'true').toLowerCase() === 'true',

    // === nuevos (prod) ===
    useTemplates: String(WHATSAPP_USE_TEMPLATES ?? 'false').toLowerCase() === 'true',
    confirmationContentSid: WHATSAPP_CONFIRMATION_CONTENT_SID || '',
    statusContentSid: WHATSAPP_STATUS_CONTENT_SID || '',
  };
});
