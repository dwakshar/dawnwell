import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { storage } from '@/lib/storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Sync MMKV wrapped in a Promise-based interface Supabase expects
const mmkvStorageAdapter = {
  getItem: (key: string): Promise<string | null> =>
    Promise.resolve(storage.getString(key) ?? null),
  setItem: (key: string, value: string): Promise<void> => {
    storage.setString(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    storage.delete(key);
    return Promise.resolve();
  },
};

// supabase is null when env vars are absent — app runs in local-only mode.
// Auth flows check for null and show a friendly empty state.
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: mmkvStorageAdapter,
          autoRefreshToken: true,
          persistSession: true,
          // detectSessionInUrl must be false on native — window.location is not
          // available. Deep links are captured via Linking in root _layout.tsx and
          // passed to supabase.auth.exchangeCodeForSession (PKCE flow, default in v2).
          detectSessionInUrl: false,
        },
      })
    : null;
