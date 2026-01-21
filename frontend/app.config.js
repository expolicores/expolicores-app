// frontend/app.config.ts
// Este es para ambiente de produccion (Play Store / TestFlight)

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
  // (el paquete puede seguir siendo com.expolicores.app, eso no le importa al usuario)
  const iosBundleId = isProd ? 'com.expolicores.app' : 'com.expolicores.app.dev54';
  const androidPackage = isProd ? 'com.expolicores.app' : 'com.expolicores.app.dev';

  const scheme = isProd ? 'expolicores' : 'expolicoresdev54';

  // *** Nombre visible en el dispositivo ***
  // En producción debe coincidir con la marca de la Play Store/App Store: ExpressApp
  const displayName = isProd ? 'ExpressApp' : 'ExpressApp Dev (NA54)';

  // Versionado de la app (usado también para sugerir/forzar updates)
  // APP_VERSION debe mantenerse sincronizada con /config/app/version en el backend
  const APP_VERSION = process.env.APP_VERSION ?? '1.0.0';

  // iOS buildNumber via ENV (no usar autoIncrement con app.config)
  const IOS_BUILD_NUMBER = process.env.IOS_BUILD_NUMBER ?? (isProd ? '202' : '4');

  // Live Activities (PAUSADO en iOS por decisión): default 'none' en producción
  const LA_PROVIDER = (process.env.EXPO_PUBLIC_LA_PROVIDER ?? (isProd ? 'none' : 'none'))
    .trim()
    .toLowerCase(); // 'expo' | 'none'

  // Plugins base
  const plugins: any[] = [
    'expo-secure-store',
    [
      'expo-notifications',
      {
        // Usa icono de ExpressApp para notificaciones
        icon: './assets/ios-icon.png',
        color: '#0EA5E9',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          newArchitecture: true,
          deploymentTarget: '26.0',
        },
        android: {
          minSdkVersion: 24,
        },
      },
    ],
  ];

  // Solo si Live Activities se reactivan en el futuro
  if (LA_PROVIDER === 'expo') {
    plugins.push(['expo-live-activity', { enablePushNotifications: true }]);
  }

  return {
    expo: {
      name: "ExpressApp",
      slug: 'expolicores',
      owner: 'expolicores',
      scheme,

      // Versionado app (leído en runtime por el front para chequear updates)
      version: APP_VERSION,

      // SDK objetivo (para compatibilidad)
      sdkVersion: '54.0.0',

      // Runtime para OTA: se agrupan por versión de app
      runtimeVersion: {
        policy: 'appVersion',
      },

      // OTA / EAS Update
      updates: {
        url: 'https://u.expo.dev/1d03fcea-24a8-42d2-b3d8-c1a50919ac11',
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
      },

      orientation: 'portrait',

      // Icono base. Usamos el mismo de iOS (ExpressApp).
      // Asegúrate de que ./assets/ios-icon.png sea el logo amarillo de ExpressApp.
      icon: './assets/ios-icon.png',

      userInterfaceStyle: 'light',

      // New Architecture ON
      newArchEnabled: true,
      experiments: { turboModules: true },

      splash: {
        // Recomendado: aquí también un splash con marca ExpressApp
        // Reemplaza splash-icon.png por una imagen correcta antes de build.
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },

      ios: {
        supportsTablet: false,
        bundleIdentifier: iosBundleId,
        buildNumber: IOS_BUILD_NUMBER,

        // Icono específico para iOS (mismo de ExpressApp)
        icon: './assets/ios-icon.png',

        infoPlist: {
          CFBundleDisplayName: displayName,
          UIBackgroundModes: ['remote-notification'],
          ITSAppUsesNonExemptEncryption: false,
          NSSupportsLiveActivities: LA_PROVIDER === 'expo',
        },
      },

      android: {
        package: androidPackage,
        versionCode: isProd ? 20 : 100,
        adaptiveIcon: {
          // Icono adaptable de ExpressApp
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#ffffff',
        },
        permissions: ['POST_NOTIFICATIONS'],
        notification: {
          // Usamos el mismo icono de marca;
          // si luego quieres uno monocromático, cambia el PNG manteniendo la ruta.
          icon: './assets/ios-icon.png',
          color: '#0EA5E9',
          defaultChannel: 'orders',
        },
      },

      web: { favicon: './assets/favicon.png' },

      plugins,

      extra: {
        EAS_BUILD_PROFILE: PROFILE,
        eas: { projectId: '1d03fcea-24a8-42d2-b3d8-c1a50919ac11' },

        EXPO_PUBLIC_APP_VERSION: APP_VERSION,

        EXPO_PUBLIC_FEATURE_B2B: process.env.EXPO_PUBLIC_FEATURE_B2B ?? 'true',
        EXPO_PUBLIC_FEATURE_SMS_OTP: process.env.EXPO_PUBLIC_FEATURE_SMS_OTP ?? 'true',
        EXPO_PUBLIC_FEATURE_GEOCODING: process.env.EXPO_PUBLIC_FEATURE_GEOCODING ?? 'true',
        EXPO_PUBLIC_FEATURE_INAPP_ORDER_BANNER:
          process.env.EXPO_PUBLIC_FEATURE_INAPP_ORDER_BANNER ?? 'true',

        EXPO_PUBLIC_LA_PROVIDER: LA_PROVIDER,

        EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
        EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? '30000',

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
