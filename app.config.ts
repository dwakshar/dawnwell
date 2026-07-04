import type { ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext) => ({
  ...config,
  name: config.name ?? 'Dawnwell',
  slug: config.slug ?? 'dawnwell',
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: 'https://u.expo.dev/2097ad8d-d324-46a4-b358-0c32639a7505',
  },
  plugins: [...(config.plugins ?? []), 'expo-sharing'],
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: '2097ad8d-d324-46a4-b358-0c32639a7505',
    },
  },
});
