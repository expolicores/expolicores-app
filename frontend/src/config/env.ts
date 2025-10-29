// frontend/src/config/env.ts
// Centraliza variables públicas de Expo (compatibles y sin bloquear flujos)

const bool = (v: any, fallback: boolean) => {
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  if (typeof v === 'boolean') return v;
  return fallback;
};

export const ENV = {
  // acepta EXPO_PUBLIC_API_URL o EXPO_PUBLIC_API_BASE_URL
  API_URL:
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'https://expolicores-app-production.up.railway.app',

  API_TIMEOUT_MS: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000),

  WABA_NUMBER: process.env.EXPO_PUBLIC_WABA_NUMBER ?? '',

  // Flags
  FEATURE_EMAIL_VERIFY: bool(process.env.EXPO_PUBLIC_FEATURE_EMAIL_VERIFY, false),

  // ✅ SMS: soporta ambos nombres y por defecto enciende (para que no bloquee)
  //    - EXPO_PUBLIC_FEATURE_SMS_OTP (recomendado)
  //    - EXPO_PUBLIC_FEATURE_SMS (legacy)
  FEATURE_SMS: bool(
    process.env.EXPO_PUBLIC_FEATURE_SMS_OTP ?? process.env.EXPO_PUBLIC_FEATURE_SMS,
    true // <- default ON para no obstaculizar
  ),
};


