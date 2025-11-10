// frontend/app.config.ts
import 'dotenv/config';

export default () => {
  // Perfil que inyecta EAS (lo usamos para cambiar bundleId/scheme)
  const profile = process.env.EAS_BUILD_PROFILE ?? 'production';
  const isDevBuild = profile === 'development';

  // Identificadores separados por ambiente (iOS/Android) y scheme distinto para el QR
  const bundleId = isDevBuild ? 'com.expolicores.app.dev' : 'com.expolicores.app';
  const androidPackage = isDevBuild ? 'com.expolicores.app.dev' : 'com.expolicores.app';
  const scheme = isDevBuild ? 'expolicoresdev' : 'expolicores';
  const displayName = isDevBuild ? 'Expolicores Dev' : 'Expolicores';

  return {
    expo: {
      // Target/scheme estables por perfil
      name: displayName,
      slug: 'expolicores',
      scheme,
      owner: 'expolicores',

      version: '1.0.0',
      sdkVersion: "54.0.0",
      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'light',

      // Nueva Arquitectura (requerida por el bridge de ActivityKit / Nitro)
      newArchEnabled: true,
      experiments: { turboModules: true },

      splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },

      ios: {
        supportsTablet: false,
        bundleIdentifier: bundleId,
        // buildNumber se maneja con appVersionSource=remote desde eas.json (se ignora aquí)
        infoPlist: {
          CFBundleDisplayName: displayName,
          UIBackgroundModes: ['remote-notification'],
          ITSAppUsesNonExemptEncryption: false,
          NSSupportsLiveActivities: true, // Habilita Live Activities
        },
        // Entitlement para APNs por ambiente (dev/prod)
        entitlements: {
          'aps-environment': isDevBuild ? 'development' : 'production',
        },
      },

      android: {
        package: androidPackage,
        versionCode: isDevBuild ? 100 : 14,
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#ffffff',
        },
        permissions: ['POST_NOTIFICATIONS'],
      },

      web: {
        favicon: './assets/favicon.png',
      },

      plugins: [
        'expo-secure-store',
        [
          'expo-notifications',
          { icon: './assets/notification-icon.png', color: '#D72638' },
        ],

        // Plugin nativo para ActivityKit (entitlements/bridge)
        '@kingstinct/react-native-activity-kit',

        // Propiedades nativas de build
        [
          'expo-build-properties',
          {
            ios: {
              deploymentTarget: '26.1', // iOS 16.2+ requerido por Live Activities
              useFrameworks: 'static',
            },
            android: {
              minSdkVersion: 26,
            },
          },
        ],
      ],

      extra: {
        // Expuesto en el cliente para togglear comportamiento por perfil
        EAS_BUILD_PROFILE: profile,
        // ID del proyecto en EAS
        eas: { projectId: '1d03fcea-24a8-42d2-b3d8-c1a50919ac11' },
        // Variables públicas usadas en el front (se leen desde .env.*)
        EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
        EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS,
        EXPO_PUBLIC_FEATURE_B2B: process.env.EXPO_PUBLIC_FEATURE_B2B,
        EXPO_PUBLIC_FEATURE_SMS_OTP: process.env.EXPO_PUBLIC_FEATURE_SMS_OTP,
        EXPO_PUBLIC_FEATURE_GEOCODING: process.env.EXPO_PUBLIC_FEATURE_GEOCODING,
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEV: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEV,
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID,
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS,
      },
    },
  };
};
