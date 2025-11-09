// frontend/app.config.ts
import 'dotenv/config';

export default () => {
  const profile = process.env.EAS_BUILD_PROFILE ?? 'production';
  const isDevBuild = profile === 'development';

  // Un solo bundle para iOS (Dev Client y TestFlight usarán el mismo):
  const bundleId = 'com.expolicores.app';

  return {
    expo: {
      // Mantener target/scheme estables
      name: 'Expolicores',            // ← nombre del target/scheme en Xcode
      slug: 'expolicores',
      scheme: 'expolicores',
      owner: 'expolicores',

      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'light',

      // Nueva Arquitectura (Turbo/Nitro) requerida por ActivityKit bridge
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
        buildNumber: isDevBuild ? '100' : '1.0.14',
        // Muestra un nombre distinto en el icono si quieres diferenciar builds
        infoPlist: {
          CFBundleDisplayName: isDevBuild ? 'Expolicores Dev' : 'Expolicores',
          UIBackgroundModes: ['remote-notification'],
          ITSAppUsesNonExemptEncryption: false,
          NSSupportsLiveActivities: true, // necesario para Live Activities
        },
        // APNs env según el tipo de build (solo indica el entitlement)
        entitlements: {
          'aps-environment': isDevBuild ? 'development' : 'production',
        },
      },

      android: {
        // Mismo identificador para Android (package)
        package: 'com.expolicores.app',
        versionCode: isDevBuild ? 100 : 14,
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
          { icon: './assets/notification-icon.png', color: '#D72638' },
        ],

        // Plugin nativo de ActivityKit (entitlements/bridges)
        '@kingstinct/react-native-activity-kit',

        // Propiedades nativas de build
        [
          'expo-build-properties',
          {
            ios: {
              // iOS 16.2+ requerido por Live Activities
              deploymentTarget: '26.0',
              useFrameworks: 'static',
            },
            android: {
              // Tu minSdk de Android permanece en 26 (no se toca)
              minSdkVersion: 26,
            },
          },
        ],
      ],

      extra: {
        EAS_BUILD_PROFILE: profile,
        eas: { projectId: '1d03fcea-24a8-42d2-b3d8-c1a50919ac11' },
      },
    },
  };
};
