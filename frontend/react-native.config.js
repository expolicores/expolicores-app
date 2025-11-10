// frontend/react-native.config.js
module.exports = {
  dependencies: {
    '@kingstinct/react-native-activity-kit': {
      platforms: {
        ios: {
          podspecPath:
            './node_modules/@kingstinct/react-native-activity-kit/NitroActivityKit.podspec',
        },
      },
    },
  },
};
