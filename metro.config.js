const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('sql', 'wasm');

// The ESM build of @supabase/supabase-js uses import(OTEL_PKG) with a variable,
// which Hermes rejects syntactically. Force CJS build (uses require(s) instead).
// Also stub @opentelemetry/api so the runtime require is a no-op.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@opentelemetry/api') {
    return { type: 'empty' };
  }
  if (moduleName === '@supabase/supabase-js') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('@supabase/supabase-js/dist/index.cjs'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
