import Constants from 'expo-constants';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

function resolveEnv(): Env {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const url = extra?.supabaseUrl;
  const anonKey = extra?.supabaseAnonKey;

  if (!url || typeof url !== 'string') {
    throw new Error(
      '[env] supabaseUrl is not configured.\n' +
        'Set EXPO_PUBLIC_SUPABASE_URL in .env and rebuild the dev client.',
    );
  }
  if (!anonKey || typeof anonKey !== 'string') {
    throw new Error(
      '[env] supabaseAnonKey is not configured.\n' +
        'Set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env and rebuild the dev client.',
    );
  }
  return { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey };
}

export const env = resolveEnv();
