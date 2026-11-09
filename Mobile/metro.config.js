const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const sharedRuntime = new Set(['react', 'react-dom', 'react-native', 'react-native-web']);

// The feed has a standalone preview installation. The app must use one runtime.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const packageName = moduleName.split('/')[0];
  return context.resolveRequest(sharedRuntime.has(packageName)
    ? { ...context, originModulePath: path.join(__dirname, 'index.js') }
    : context, moduleName, platform);
};

module.exports = config;
