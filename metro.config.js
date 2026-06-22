// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package exports to fix general ESM package resolution issues in Metro
config.resolver.unstable_enablePackageExports = true;

// Define the alias for tslib to force it to use its ES6 version
const ALIASES = {
  'tslib': require.resolve('tslib/tslib.es6.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (ALIASES[moduleName]) {
    return {
      filePath: ALIASES[moduleName],
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
