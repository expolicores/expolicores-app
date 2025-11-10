// frontend/app.config.ts
import { config as loadEnv } from 'dotenv';

/**
 * Carga de variables de entorno determinística:
 * 1) Carga primero el archivo específico del perfil (.env.development | .env.production)
 * 2) Luego .env como base (solo rellena faltantes)
 */
const PROFILE = process.env.EAS_BUILD_PROFILE ?? 'development';
loadEnv({ path: PROFILE === 'development' ? '.env.development' : '.env.production' });
loadEnv();

export default () => {
  const isDev = PROFILE === 'development';

  // Identificadores por ambiente + scheme distinto para que el QR abra el Dev Client correcto
  const iosBundleId = isDev ? 'com.expolicores.app.dev' : 'com.expolicores.app';
  const androidPackage = isDev ? 'com.expolicores.app.dev' : 'com.expolicores.app';
  const scheme = isDev ? 'expolicoresdev' : 'expolicores';
  const displayName = isDev ? 'Expolicores Dev' : 'Expolicores';

  return {
    expo: {
      name: displayName,
      slug: 'expolicores',
      owner: 'expolicores',
      scheme,

      // La SDK real la define el paquete "expo" en package.json (no es necesario fijarla aquí)
      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'light',

      // New Architecture (Turbo/Fabric) – necesaria para módulos Nitro y buen soporte nativo
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
        // iOS mínimo requerido: Live Activities con updates por push desde 16.2
        deploymentTarget: '16.2',
        infoPlist: {
          CFBundleDisplayName: displayName,
          UIBackgroundModes: ['remote-notification'],
          ITSAppUsesNonExemptEncryption: false,
          NSSupportsLiveActivities: true, // Live Activities habilitadas
        },
        // ⚠️ No forzamos 'aps-environment' aquí; EAS lo gestiona según el perfil y la firma.
      },

      android: {
        package: androidPackage,
        // Usa tu estrategia de versionado; se deja un valor por defecto
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

        /**
         * Ruta C (proveedor: expo-live-activity)
         * - Genera la extensión de Live Activity sin abrir Xcode
         * - Si más adelante alternas a Kingstinct, bastará con cambiar el flag EXPO_PUBLIC_LA_PROVIDER
         *   y (si usas Ruta B) agregar el plugin de widget correspondiente.
         */
        ['expo-live-activity', { enablePushNotifications: true }],

        // Ajustes nativos del build
        [
          'expo-build-properties',
          {
            ios: {
              //la unica versión iOS despues de infinitas pruebas que fue aceptada fue la 26.0 y la 26.1
              deploymentTarget: '26.1',
              newArchitecture: true,
              useFrameworks: 'static',
            },
            android: {
              minSdkVersion: 26,
            },
          },
        ],
      ],

      // Exponer lo mínimo necesario; EXPO_PUBLIC_* ya viajan al cliente automáticamente
      extra: {
        EAS_BUILD_PROFILE: PROFILE,
        eas: { projectId: '1d03fcea-24a8-42d2-b3d8-c1a50919ac11' },

        // Flags negocio/funcionalidad
        EXPO_PUBLIC_LA_PROVIDER: process.env.EXPO_PUBLIC_LA_PROVIDER ?? 'expo', // "expo" | "kingstinct" | "none"

        EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
        EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS,

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
