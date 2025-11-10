// frontend/app.config.ts
import { config as loadEnv } from 'dotenv';

/**
 * Carga determinística de variables:
 * 1) Primero el archivo del perfil (.env.development | .env.production)
 * 2) Luego .env como base (rellena faltantes)
 */
const PROFILE = process.env.EAS_BUILD_PROFILE ?? 'development';
loadEnv({ path: PROFILE === 'development' ? '.env.development' : '.env.production' });
loadEnv();

export default () => {
  const isDev = PROFILE === 'development';

  // Identificadores y naming por ambiente
  const iosBundleId = isDev ? 'com.expolicores.app.dev' : 'com.expolicores.app';
  const androidPackage = isDev ? 'com.expolicores.app.dev' : 'com.expolicores.app';
  const scheme = isDev ? 'expolicoresdev' : 'expolicores';
  const displayName = isDev ? 'Expolicores Dev' : 'Expolicores';

  /**
   * IMPORTANTE: iOS buildNumber lo pasamos por ENV para evitar "autoIncrement no soportado con app.config.js"
   * - En CMD (Windows):
   *   set IOS_BUILD_NUMBER=7 && npx -p eas-cli@latest eas build -p ios --profile development --clear-cache
   * - En prod cambia a un número mayor (p.ej. 101)
   */
  const IOS_BUILD_NUMBER = process.env.IOS_BUILD_NUMBER ?? (isDev ? '7' : '101');

  return {
    expo: {
      name: displayName,
      slug: 'expolicores',
      owner: 'expolicores',
      scheme,

      // La SDK se fija con "expo" en package.json (54.0.0). No se declara aquí.
      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'light',

      splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },

      ios: {
        supportsTablet: false,
        bundleIdentifier: iosBundleId,
        buildNumber: IOS_BUILD_NUMBER,
        /**
         * ActivityKit:
         * - Start local: iOS 16.1+
         * - Push updates: iOS 16.2+  ✅
         */
        deploymentTarget: '26.0',
        infoPlist: {
          CFBundleDisplayName: displayName,
          UIBackgroundModes: ['remote-notification'],
          ITSAppUsesNonExemptEncryption: false,
          NSSupportsLiveActivities: true,
        },
        // 'aps-environment' lo gestiona EAS según firma y perfil (sandbox/production)
      },

      runtimeVersion: { policy: 'sdkVersion' }, // usa "exposdk:54.0.0" en tiempo de ejecución

      android: {
        package: androidPackage,
        versionCode: isDev ? 100 : 14,
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#ffffff',
        },
        permissions: ['POST_NOTIFICATIONS'],
      },

      web: { favicon: './assets/favicon.png' },

      plugins: [
        // Secure storage (opcional)
        'expo-secure-store',

        // Notificaciones (Expo Push / APNs / FCM)
        [
          'expo-notifications',
          {
            icon: './assets/notification-icon.png',
            color: '#D72638',
          },
        ],

        /**
         * Ruta C (proveedor: expo-live-activity)
         * Genera extensión de Live Activity sin Xcode y habilita push-to-activity.
         */
        ['expo-live-activity', { enablePushNotifications: true }],

        // Propiedades nativas del build
        [
          'expo-build-properties',
          {
            ios: {
              // New Architecture ON para Nitro/ActivityKit
              newArchitecture: true,
              // iOS mínimo requerido por Live Activities (push updates)
              deploymentTarget: '26.0',
              // Recomendado para varias libs nativas en EAS
              useFrameworks: 'static',
            },
            android: {
              // Valor estándar; puede ser 24 o 26 según tus dispositivos objetivo
              minSdkVersion: 24,
            },
          },
        ],
      ],

      // EXPO_PUBLIC_* pasa automático al cliente
      extra: {
        EAS_BUILD_PROFILE: PROFILE,
        eas: { projectId: '1d03fcea-24a8-42d2-b3d8-c1a50919ac11' },

        // Flags negocio/funcionalidad
        EXPO_PUBLIC_LA_PROVIDER: process.env.EXPO_PUBLIC_LA_PROVIDER ?? 'expo', // "expo" | "kingstinct" | "none"

        // API
        EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
        EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS,

        // Features
        EXPO_PUBLIC_FEATURE_B2B: process.env.EXPO_PUBLIC_FEATURE_B2B,
        EXPO_PUBLIC_FEATURE_SMS_OTP: process.env.EXPO_PUBLIC_FEATURE_SMS_OTP,
        EXPO_PUBLIC_FEATURE_GEOCODING: process.env.EXPO_PUBLIC_FEATURE_GEOCODING,

        // Google
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEV: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEV,
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID,
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS,
      },
    },
  };
};
