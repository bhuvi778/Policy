const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      /android[\/\\]app[\/\\]\.cxx[\/\\].*/,
      /android[\/\\]build[\/\\].*/,
      /node_modules[\/\\].*[\/\\]android[\/\\]\.cxx[\/\\].*/,
      /node_modules[\/\\].*[\/\\]android[\/\\]build[\/\\].*/,
      /^C:[\/\\]bxcxx[\/\\].*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
