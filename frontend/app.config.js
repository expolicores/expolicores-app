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

  // ⚠️ Para forzar instalación “limpia” y evitar reciclar binarios viejos,
  // cambiamos temporalmente el bundle y nombre en DEV.
  const iosBundleId = isDev ? 'com.expolicores.app.dev54' : 'com.expolicores.app';
  const androidPackage = isDev ? 'com.expolicores.app.dev' : 'com.expolicores.app';
  const scheme = isDev ? 'expolicoresdev54' : 'expolicores';
  const displayName = isDev ? 'Expolicores Dev (NA54)' : 'Expolicores';

  // iOS buildNumber lo pasamos por ENV para evitar autoIncrement con app.config.js
  const IOS_BUILD_NUMBER = process.env.IOS_BUILD_NUMBER ?? (isDev ? '1' : '101');

  return {
    expo: {
      name: displayName,
      slug: 'expolicores',
      owner: 'expolicores',
      scheme,

      // Versión de la app
      version: '1.0.0',

      // 👇 Fuerza que el binario y el manifiesto sean SDK 54
      sdkVersion: '54.0.0',
      runtimeVersion: { policy: 'sdkVersion' },

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
        'expo-secure-store',
        [
          'expo-notifications',
          {
            icon: './assets/notification-icon.png',
            color: '#D72638',
          },
        ],
        // Ruta C (expo-live-activity): genera la extensión sin abrir Xcode
        ['expo-live-activity', { enablePushNotifications: true }],
        // New Architecture ON y target iOS correcto (sin useFrameworks para evitar issues de headers)
        [
          'expo-build-properties',
          {
            ios: {
              newArchitecture: true,
              deploymentTarget: '26.0',
              // useFrameworks: 'static', // (dejado fuera intencionalmente)
            },
            android: {
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
        EXPO_PUBLIC_LA_PROVIDER: (process.env.EXPO_PUBLIC_LA_PROVIDER ?? 'expo').trim(), // "expo" | "kingstinct" | "none"

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
