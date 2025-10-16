export const ENV = {
  API_URL:
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'http://192.168.1.38:3000',
  API_TIMEOUT_MS: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 15000),

  // NUEVO: flags de debug
  DEBUG_HTTP: (process.env.EXPO_PUBLIC_DEBUG_HTTP ?? 'false') === 'true',
  DEBUG_HTTP_VERBOSITY: String(process.env.EXPO_PUBLIC_DEBUG_HTTP_LEVEL ?? 'normal'), // normal|verbose

  WABA_NUMBER: process.env.EXPO_PUBLIC_WABA_NUMBER ?? '',
  FEATURE_EMAIL_VERIFY:
    (process.env.EXPO_PUBLIC_FEATURE_EMAIL_VERIFY ?? 'false') === 'true',
  FEATURE_SMS:
    (process.env.EXPO_PUBLIC_FEATURE_SMS ?? 'false') === 'true',
};
