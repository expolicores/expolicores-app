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
      buildNumber: "1.0.14",
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        ITSAppUsesNonExemptEncryption: false,
        NSSupportsLiveActivities: true,
      },
      // Fuerza APNs prod para TestFlight y Live Activities por push
      entitlements: {
        "aps-environment": "production",
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
    },

    web: { favicon: "./assets/favicon.png" },

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
          activityAttributesFile: "./ios/OrderActivityAttributes.swift",
          bundleIdentifier: "com.expolicores.app",
        },
      ],
      [
        "expo-build-properties",
        {
          ios: {
            // ⬆️ Sube target para NitroActivityKit
            deploymentTarget: "26.0",
            useFrameworks: "static",
          },
        },
      ],
    ],

    extra: {
      eas: { projectId: "1d03fcea-24a8-42d2-b3d8-c1a50919ac11" },
    },

    owner: "expolicores",
  },
});
