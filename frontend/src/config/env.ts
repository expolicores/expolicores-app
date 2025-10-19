// frontend/src/config/env.ts
// Centraliza variables públicas de Expo
export const ENV = {
  // acepta EXPO_PUBLIC_API_URL o EXPO_PUBLIC_API_BASE_URL
  API_URL:
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'http://192.168.1.31:3000',

  API_TIMEOUT_MS: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000),

  WABA_NUMBER: process.env.EXPO_PUBLIC_WABA_NUMBER ?? '',
  FEATURE_EMAIL_VERIFY:
    (process.env.EXPO_PUBLIC_FEATURE_EMAIL_VERIFY ?? 'false') === 'true',
  FEATURE_SMS:
    (process.env.EXPO_PUBLIC_FEATURE_SMS ?? 'false') === 'true',
};
