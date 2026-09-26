const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const sharedSrc = path.resolve(__dirname, '../../packages/shared/src');
const SHARED = '@travely/shared';
const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === SHARED || moduleName.startsWith(`${SHARED}/`)) {
    const sub = moduleName.slice(SHARED.length).replace(/^\//, '') || 'index';
    const filePath = [path.join(sharedSrc, `${sub}.ts`), path.join(sharedSrc, sub, 'index.ts')].find(
      (candidate) => fs.existsSync(candidate),
    );
    if (filePath) return { type: 'sourceFile', filePath };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
