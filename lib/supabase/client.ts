import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { storage } from '@/lib/storage';
import type { Database } from './database.types';

export type { Database };
export type { Tables, TablesInsert, TablesUpdate } from './database.types';

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

export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      storage: mmkvStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      // detectSessionInUrl must be false on native — window.location is unavailable.
      // Deep links are captured via Linking in root _layout.tsx and passed to
      // supabase.auth.exchangeCodeForSession (PKCE flow, default in v2).
      detectSessionInUrl: false,
    },
  },
);
