// app.config.js
module.exports = () => ({
  expo: {
    name: "Expolicores",
    slug: "expolicores",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,

    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.expolicores.app",
      buildNumber: "1.0.10",
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        ITSAppUsesNonExemptEncryption: false,
        // Recomendado para Live Activities (el entitlement lo añade el plugin)
        NSSupportsLiveActivities: true,
      },
    },

    android: {
      package: "com.expolicores.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      permissions: ["POST_NOTIFICATIONS"],
      // Nota: icono y color de notificaciones se configuran en el plugin expo-notifications (abajo)
    },

    web: {
      favicon: "./assets/favicon.png",
    },

    plugins: [
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#D72638",
        },
      ],
      [
        "@kingstinct/react-native-activity-kit",
        {
          // Guarda este archivo en la RAÍZ del proyecto, no dentro de /ios
          activityAttributesFile: "./OrderActivityAttributes.swift",
          bundleIdentifier: "com.expolicores.app",
        },
      ],
      [
        "expo-build-properties",
        {
          ios: {
            // Importante: usar versiones reales de iOS SDK (no 26.x)
            deploymentTarget: "17.5",
            useFrameworks: "static",
          },
        },
      ],
    ],

    extra: {
      eas: {
        projectId: "1d03fcea-24a8-42d2-b3d8-c1a50919ac11",
      },
    },

    owner: "expolicores",
  },
});
