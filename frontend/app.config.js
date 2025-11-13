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

  // Para binarios “limpios” en DEV (evita reciclar instalación previa)
  const iosBundleId = isDev ? 'com.expolicores.app.dev54' : 'com.expolicores.app';
  const androidPackage = isDev ? 'com.expolicores.app.dev' : 'com.expolicores.app';
  const scheme = isDev ? 'expolicoresdev54' : 'expolicores';
  const displayName = isDev ? 'Expolicores Dev (NA54)' : 'Expolicores';

  // iOS buildNumber via ENV (evita autoIncrement con app.config)
  const IOS_BUILD_NUMBER = process.env.IOS_BUILD_NUMBER ?? (isDev ? '1' : '101');

  // Live Activities provider (si lo pausamos, deja "none")
  const LA_PROVIDER = (process.env.EXPO_PUBLIC_LA_PROVIDER ?? 'none').trim().toLowerCase(); // 'expo' | 'none'

  // 🔔 android.googleServicesFile:
  // - En EAS, usa la variable de archivo ANDROID_GOOGLE_SERVICES_JSON
  // - En local, usa ./android/google-services.json
  const androidGoogleServicesFile =
    process.env.ANDROID_GOOGLE_SERVICES_JSON || './android/google-services.json';

  // Plugins dinámicos (evita configurar Live Activities si está pausado)
  const plugins: any[] = [
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#0EA5E9',
        // sounds: [], // agrega si usas sonidos personalizados
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          newArchitecture: true,
          // ActivityKit requiere iOS 16.1+; si no usas LA, puedes bajar a 13.0 sin problema
          deploymentTarget: '26.0',
          // useFrameworks: 'static', // mantener desactivado salvo que un pod lo exija
        },
        android: {
          minSdkVersion: 24,
        },
      },
    ],
  ];

  if (LA_PROVIDER === 'expo') {
    plugins.push(['expo-live-activity', { enablePushNotifications: true }]);
  }

  return {
    expo: {
      name: displayName,
      slug: 'expolicores',
      owner: 'expolicores',
      scheme,

      version: '1.0.0',

      // Forzamos SDK 54 (si te quedas en 53, cambia a '53.0.0')
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
        // ActivityKit: start local (16.1+), push updates (16.2+)
        // deploymentTarget se fija vía expo-build-properties arriba
        infoPlist: {
          CFBundleDisplayName: displayName,
          UIBackgroundModes: ['remote-notification'],
          ITSAppUsesNonExemptEncryption: false,
          NSSupportsLiveActivities: LA_PROVIDER === 'expo',
        },
        // 'aps-environment' lo gestiona EAS (firma/entitlements)
      },

      android: {
        package: androidPackage,
        versionCode: isDev ? 100 : 14,
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#ffffff',
        },
        // 🔔 Requisito Android 13+ para notificaciones
        permissions: ['POST_NOTIFICATIONS'],
        // 🔔 FCM: referencia a google-services.json (desde ENV de archivo en EAS o local)
        googleServicesFile: androidGoogleServicesFile,
        // 🔔 Canal por defecto para heads-up (debe coincidir con el creado en App.tsx)
        notification: {
          icon: './assets/notification-icon.png',
          color: '#0EA5E9',
          defaultChannel: 'orders',
        },
      },

      web: { favicon: './assets/favicon.png' },

      plugins,

      extra: {
        // Visibles en el cliente (EXPO_PUBLIC_*)
        EAS_BUILD_PROFILE: PROFILE,
        eas: { projectId: '1d03fcea-24a8-42d2-b3d8-c1a50919ac11' },

        // Features negocio
        EXPO_PUBLIC_FEATURE_B2B: process.env.EXPO_PUBLIC_FEATURE_B2B,
        EXPO_PUBLIC_FEATURE_SMS_OTP: process.env.EXPO_PUBLIC_FEATURE_SMS_OTP,
        EXPO_PUBLIC_FEATURE_GEOCODING: process.env.EXPO_PUBLIC_FEATURE_GEOCODING,
        EXPO_PUBLIC_FEATURE_INAPP_ORDER_BANNER:
          process.env.EXPO_PUBLIC_FEATURE_INAPP_ORDER_BANNER ?? 'true',

        // Live Activities (control)
        EXPO_PUBLIC_LA_PROVIDER: LA_PROVIDER, // 'expo' | 'none'

        // API
        EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
        EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS,

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
