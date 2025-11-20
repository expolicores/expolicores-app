// frontend/app.config.ts
// Este es para ambiente de produccion (TestFlight)
// npx -p eas-cli@latest eas build -p ios --profile production --clear-cache
// npx --yes eas-cli@latest submit -p ios --latest   <<< Aqui si se requiere Submit
import { config as loadEnv } from 'dotenv';

/**
 * Carga determinística de variables:
 * 1) Primero el archivo del perfil (.env.development | .env.production)
 * 2) Luego .env como base (rellena faltantes)
 */
const PROFILE = process.env.EAS_BUILD_PROFILE ?? 'production';
loadEnv({ path: PROFILE === 'development' ? '.env.development' : '.env.production' });
loadEnv();

export default () => {
  const isProd = PROFILE === 'production';

  // Identificadores y nombre por perfil
  const iosBundleId = isProd ? 'com.expolicores.app' : 'com.expolicores.app.dev54';
  const androidPackage = isProd ? 'com.expolicores.app' : 'com.expolicores.app.dev';
  const scheme = isProd ? 'expolicores' : 'expolicoresdev54';
  const displayName = isProd ? 'Expolicores' : 'Expolicores Dev (NA54)';

  // Versionado de la app (usado también para sugerir/forzar updates)
  // APP_VERSION debe mantenerse sincronizada con /config/app/version en el backend
  const APP_VERSION = process.env.APP_VERSION ?? '1.0.0';

  // iOS buildNumber via ENV (no usar autoIncrement con app.config)
  const IOS_BUILD_NUMBER = process.env.IOS_BUILD_NUMBER ?? (isProd ? '200' : '4');

  // Live Activities (PAUSADO en iOS por decisión): default 'none' en producción
  // Cambiar a 'expo' si se reanuda la Ruta C más adelante.
  const LA_PROVIDER = (process.env.EXPO_PUBLIC_LA_PROVIDER ?? (isProd ? 'none' : 'none'))
    .trim()
    .toLowerCase(); // 'expo' | 'none'

  // Plugins base
  const plugins: any[] = [
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#0EA5E9',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          newArchitecture: true,
          deploymentTarget: '26.0',
          // useFrameworks: 'static', // ← mantener desactivado salvo que un pod lo exija
        },
        android: {
          minSdkVersion: 24,
        },
      },
    ],
  ];

  // Solo si LA se reactivan en el futuro
  if (LA_PROVIDER === 'expo') {
    plugins.push(['expo-live-activity', { enablePushNotifications: true }]);
  }

  return {
    expo: {
      name: displayName,
      slug: 'expolicores',
      owner: 'expolicores',
      scheme,

      // Versionado app (leído en runtime por el front para chequear updates)
      version: APP_VERSION,

      // Forzar SDK 54 y runtime asociado
      sdkVersion: '54.0.0',
      runtimeVersion: { policy: 'sdkVersion' },

      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'light',

      // New Architecture ON
      newArchEnabled: true,
      experiments: { turboModules: true },

      splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },

      ios: {
        supportsTablet: false,
        bundleIdentifier: iosBundleId,
        buildNumber: IOS_BUILD_NUMBER,
        // deploymentTarget se fija vía expo-build-properties
        infoPlist: {
          CFBundleDisplayName: displayName,
          UIBackgroundModes: ['remote-notification'],
          ITSAppUsesNonExemptEncryption: false,
          // Live Activities pausadas en producción
          NSSupportsLiveActivities: LA_PROVIDER === 'expo',
        },
        // 'aps-environment' lo gestiona EAS según la firma (prod/sandbox)
      },

      android: {
        package: androidPackage,
        versionCode: isProd ? 14 : 100,
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#ffffff',
        },
        // Android 13+ requiere POST_NOTIFICATIONS
        permissions: ['POST_NOTIFICATIONS'],
        notification: {
          icon: './assets/notification-icon.png',
          color: '#0EA5E9',
          defaultChannel: 'orders',
        },
      },

      web: { favicon: './assets/favicon.png' },

      plugins,

      extra: {
        // Perfil de build visible en el cliente
        EAS_BUILD_PROFILE: PROFILE,
        eas: { projectId: '1d03fcea-24a8-42d2-b3d8-c1a50919ac11' },

        // Exponer versión al JS (además de Constants.expoConfig.version)
        EXPO_PUBLIC_APP_VERSION: APP_VERSION,

        // Feature flags negocio
        EXPO_PUBLIC_FEATURE_B2B: process.env.EXPO_PUBLIC_FEATURE_B2B ?? 'true',
        EXPO_PUBLIC_FEATURE_SMS_OTP: process.env.EXPO_PUBLIC_FEATURE_SMS_OTP ?? 'true',
        EXPO_PUBLIC_FEATURE_GEOCODING: process.env.EXPO_PUBLIC_FEATURE_GEOCODING ?? 'true',
        EXPO_PUBLIC_FEATURE_INAPP_ORDER_BANNER:
          process.env.EXPO_PUBLIC_FEATURE_INAPP_ORDER_BANNER ?? 'true',

        // Live Activities (control)
        EXPO_PUBLIC_LA_PROVIDER: LA_PROVIDER, // 'expo' | 'none'

        // API
        EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
        EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? '30000',

        // Google Maps
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEV:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEV,
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID,
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS,
      },
    },
  };
};
